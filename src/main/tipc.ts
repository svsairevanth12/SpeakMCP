import fs from "fs"
import { getRendererHandlers, tipc } from "@egoist/tipc/main"
import { showPanelWindow, WINDOWS } from "./window"
import {
  app,
  clipboard,
  Menu,
  shell,
  systemPreferences,
  dialog,
} from "electron"
import path from "path"
import { configStore, recordingsFolder } from "./config"
import { Config, RecordingHistoryItem } from "../shared/types"
import { RendererHandlers } from "./renderer-handlers"
import { postProcessTranscript, processTranscriptWithTools } from "./llm"
import { mcpService, MCPToolResult } from "./mcp-service"
import { state } from "./state"
import { updateTrayIcon } from "./tray"
import { isAccessibilityGranted, isMacSilicon } from "./utils"
import { writeText } from "./keyboard"
import { transcribeWithLightningWhisper, checkLightningWhisperDependencies, installLightningWhisperDependencies } from "./lightning-whisper-service"

const t = tipc.create()

const getRecordingHistory = () => {
  try {
    const history = JSON.parse(
      fs.readFileSync(path.join(recordingsFolder, "history.json"), "utf8"),
    ) as RecordingHistoryItem[]

    // sort desc by createdAt
    return history.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

const saveRecordingsHitory = (history: RecordingHistoryItem[]) => {
  fs.writeFileSync(
    path.join(recordingsFolder, "history.json"),
    JSON.stringify(history),
  )
}

export const router = {
  restartApp: t.procedure.action(async () => {
    app.relaunch()
    app.quit()
  }),

  getUpdateInfo: t.procedure.action(async () => {
    const { getUpdateInfo } = await import("./updater")
    return getUpdateInfo()
  }),

  quitAndInstall: t.procedure.action(async () => {
    const { quitAndInstall } = await import("./updater")

    quitAndInstall()
  }),

  checkForUpdatesAndDownload: t.procedure.action(async () => {
    const { checkForUpdatesAndDownload } = await import("./updater")

    return checkForUpdatesAndDownload()
  }),

  openMicrophoneInSystemPreferences: t.procedure.action(async () => {
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
    )
  }),

  hidePanelWindow: t.procedure.action(async () => {
    const panel = WINDOWS.get("panel")

    panel?.hide()
  }),

  showContextMenu: t.procedure
    .input<{ x: number; y: number; selectedText?: string }>()
    .action(async ({ input, context }) => {
      const items: Electron.MenuItemConstructorOptions[] = []

      if (input.selectedText) {
        items.push({
          label: "Copy",
          click() {
            clipboard.writeText(input.selectedText || "")
          },
        })
      }

      if (import.meta.env.DEV) {
        items.push({
          label: "Inspect Element",
          click() {
            context.sender.inspectElement(input.x, input.y)
          },
        })
      }

      const panelWindow = WINDOWS.get("panel")
      const isPanelWindow = panelWindow?.webContents.id === context.sender.id

      if (isPanelWindow) {
        items.push({
          label: "Close",
          click() {
            panelWindow?.hide()
          },
        })
      }

      const menu = Menu.buildFromTemplate(items)
      menu.popup({
        x: input.x,
        y: input.y,
      })
    }),

  getMicrophoneStatus: t.procedure.action(async () => {
    return systemPreferences.getMediaAccessStatus("microphone")
  }),

  isAccessibilityGranted: t.procedure.action(async () => {
    return isAccessibilityGranted()
  }),

  isMacSilicon: t.procedure.action(async () => {
    return isMacSilicon()
  }),

  checkLightningWhisperDependencies: t.procedure.action(async () => {
    return checkLightningWhisperDependencies()
  }),

  installLightningWhisperDependencies: t.procedure.action(async () => {
    return installLightningWhisperDependencies()
  }),

  requestAccesssbilityAccess: t.procedure.action(async () => {
    if (process.platform === "win32") return true

    return systemPreferences.isTrustedAccessibilityClient(true)
  }),

  requestMicrophoneAccess: t.procedure.action(async () => {
    return systemPreferences.askForMediaAccess("microphone")
  }),

  showPanelWindow: t.procedure.action(async () => {
    showPanelWindow()
  }),

  displayError: t.procedure
    .input<{ title?: string; message: string }>()
    .action(async ({ input }) => {
      dialog.showErrorBox(input.title || "Error", input.message)
    }),

  createRecording: t.procedure
    .input<{
      recording: ArrayBuffer
      duration: number
    }>()
    .action(async ({ input }) => {

      fs.mkdirSync(recordingsFolder, { recursive: true })

      const config = configStore.get()
      let transcript: string

      if (config.sttProviderId === "lightning-whisper-mlx") {
        // Use lightning-whisper-mlx for transcription
        try {
          const result = await transcribeWithLightningWhisper(input.recording, {
            model: config.lightningWhisperMlxModel || "distil-medium.en",
            batchSize: config.lightningWhisperMlxBatchSize || 12,
            quant: config.lightningWhisperMlxQuant || null,
          })

          if (!result.success) {
            throw new Error(result.error || "Lightning Whisper MLX transcription failed")
          }

          transcript = await postProcessTranscript(result.text || "")
        } catch (error) {
          console.error("Lightning Whisper MLX failed, falling back to OpenAI:", error)

          // Fallback to OpenAI if lightning-whisper-mlx fails
          const form = new FormData()
          form.append(
            "file",
            new File([input.recording], "recording.webm", { type: "audio/webm" }),
          )
          form.append("model", "whisper-1")
          form.append("response_format", "json")

          const openaiBaseUrl = config.openaiBaseUrl || "https://api.openai.com/v1"

          const transcriptResponse = await fetch(
            `${openaiBaseUrl}/audio/transcriptions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.openaiApiKey}`,
              },
              body: form,
            },
          )

          if (!transcriptResponse.ok) {
            const message = `Fallback transcription failed: ${transcriptResponse.statusText} ${(await transcriptResponse.text()).slice(0, 300)}`
            throw new Error(message)
          }

          const json: { text: string } = await transcriptResponse.json()
          transcript = await postProcessTranscript(json.text)
        }
      } else {
        // Use OpenAI or Groq for transcription
        const form = new FormData()
        form.append(
          "file",
          new File([input.recording], "recording.webm", { type: "audio/webm" }),
        )
        form.append(
          "model",
          config.sttProviderId === "groq" ? "whisper-large-v3" : "whisper-1",
        )
        form.append("response_format", "json")

        // Add prompt parameter for Groq if provided
        if (config.sttProviderId === "groq" && config.groqSttPrompt?.trim()) {
          form.append("prompt", config.groqSttPrompt.trim())
        }

        const groqBaseUrl = config.groqBaseUrl || "https://api.groq.com/openai/v1"
        const openaiBaseUrl = config.openaiBaseUrl || "https://api.openai.com/v1"

        const transcriptResponse = await fetch(
          config.sttProviderId === "groq"
            ? `${groqBaseUrl}/audio/transcriptions`
            : `${openaiBaseUrl}/audio/transcriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.sttProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
            },
            body: form,
          },
        )

        if (!transcriptResponse.ok) {
          const message = `${transcriptResponse.statusText} ${(await transcriptResponse.text()).slice(0, 300)}`

          throw new Error(message)
        }

        const json: { text: string } = await transcriptResponse.json()
        transcript = await postProcessTranscript(json.text)
      }

      const history = getRecordingHistory()
      const item: RecordingHistoryItem = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        duration: input.duration,
        transcript,
      }
      history.push(item)
      saveRecordingsHitory(history)

      fs.writeFileSync(
        path.join(recordingsFolder, `${item.id}.webm`),
        Buffer.from(input.recording),
      )

      const main = WINDOWS.get("main")
      if (main) {
        getRendererHandlers<RendererHandlers>(
          main.webContents,
        ).refreshRecordingHistory.send()
      }

      const panel = WINDOWS.get("panel")
      if (panel) {
        panel.hide()
      }

      // paste
      clipboard.writeText(transcript)
      if (isAccessibilityGranted()) {
        try {
          await writeText(transcript)
        } catch (error) {
          console.error(`Failed to write text:`, error)
          // Don't throw here, just log the error so the recording still gets saved
        }
      }
    }),

  createMcpRecording: t.procedure
    .input<{
      recording: ArrayBuffer
      duration: number
    }>()
    .action(async ({ input }) => {
      console.log(`[MCP-DEBUG] 🎬 Starting MCP recording processing, duration: ${input.duration}ms, audio size: ${input.recording.byteLength} bytes`)

      fs.mkdirSync(recordingsFolder, { recursive: true })

      const config = configStore.get()
      let transcript: string

      // Initialize MCP service if not already done
      console.log("[MCP-DEBUG] Initializing MCP service...")
      await mcpService.initialize()

      // First, transcribe the audio using the same logic as regular recording
      console.log(`[MCP-DEBUG] 🎤 Starting transcription using provider: ${config.sttProviderId}`)

      if (config.sttProviderId === "lightning-whisper-mlx") {
        try {
          console.log("[MCP-DEBUG] Using Lightning Whisper MLX for transcription")
          const result = await transcribeWithLightningWhisper(input.recording, {
            model: config.lightningWhisperMlxModel || "distil-medium.en",
            batchSize: config.lightningWhisperMlxBatchSize || 12,
            quant: config.lightningWhisperMlxQuant || null,
          })

          if (!result.success) {
            throw new Error(result.error || "Lightning Whisper MLX transcription failed")
          }

          transcript = result.text || ""
          console.log(`[MCP-DEBUG] ✅ Lightning Whisper transcription successful: "${transcript}"`)
        } catch (error) {
          console.error("[MCP-DEBUG] ❌ Lightning Whisper MLX failed, falling back to OpenAI:", error)

          // Fallback to OpenAI if lightning-whisper-mlx fails
          const form = new FormData()
          form.append(
            "file",
            new File([input.recording], "recording.webm", { type: "audio/webm" }),
          )
          form.append("model", "whisper-1")
          form.append("response_format", "json")

          const openaiBaseUrl = config.openaiBaseUrl || "https://api.openai.com/v1"

          const transcriptResponse = await fetch(
            `${openaiBaseUrl}/audio/transcriptions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.openaiApiKey}`,
              },
              body: form,
            },
          )

          if (!transcriptResponse.ok) {
            const message = `Fallback transcription failed: ${transcriptResponse.statusText} ${(await transcriptResponse.text()).slice(0, 300)}`
            throw new Error(message)
          }

          const json: { text: string } = await transcriptResponse.json()
          transcript = json.text
          console.log(`[MCP-DEBUG] ✅ Fallback OpenAI transcription successful: "${transcript}"`)
        }
      } else {
        // Use OpenAI or Groq for transcription
        console.log(`[MCP-DEBUG] Using ${config.sttProviderId} for transcription`)
        const form = new FormData()
        form.append(
          "file",
          new File([input.recording], "recording.webm", { type: "audio/webm" }),
        )
        form.append(
          "model",
          config.sttProviderId === "groq" ? "whisper-large-v3" : "whisper-1",
        )
        form.append("response_format", "json")

        if (config.sttProviderId === "groq" && config.groqSttPrompt?.trim()) {
          form.append("prompt", config.groqSttPrompt.trim())
        }

        const groqBaseUrl = config.groqBaseUrl || "https://api.groq.com/openai/v1"
        const openaiBaseUrl = config.openaiBaseUrl || "https://api.openai.com/v1"

        const transcriptResponse = await fetch(
          config.sttProviderId === "groq"
            ? `${groqBaseUrl}/audio/transcriptions`
            : `${openaiBaseUrl}/audio/transcriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.sttProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
            },
            body: form,
          },
        )

        if (!transcriptResponse.ok) {
          const message = `${transcriptResponse.statusText} ${(await transcriptResponse.text()).slice(0, 300)}`
          throw new Error(message)
        }

        const json: { text: string } = await transcriptResponse.json()
        transcript = json.text
        console.log(`[MCP-DEBUG] ✅ ${config.sttProviderId} transcription successful: "${transcript}"`)
      }

      // Process transcript with MCP tools
      console.log("[MCP-DEBUG] 🔧 Getting available tools and processing with LLM...")
      const availableTools = mcpService.getAvailableTools()
      const llmResponse = await processTranscriptWithTools(transcript, availableTools)
      console.log("[MCP-DEBUG] 📝 LLM processing completed:", llmResponse)

      let finalResponse = ""

      // Execute tool calls if any
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        console.log(`[MCP-DEBUG] 🔧 Executing ${llmResponse.toolCalls.length} tool calls:`,
          llmResponse.toolCalls.map(tc => tc.name))

        const toolResults: MCPToolResult[] = []

        for (const toolCall of llmResponse.toolCalls) {
          console.log(`[MCP-DEBUG] Executing tool: ${toolCall.name}`)
          const result = await mcpService.executeToolCall(toolCall)
          toolResults.push(result)
        }

        // Combine tool results into final response
        const toolResultTexts = toolResults.map(result =>
          result.content.map(c => c.text).join('\n')
        ).join('\n\n')

        finalResponse = llmResponse.content
          ? `${llmResponse.content}\n\n${toolResultTexts}`
          : toolResultTexts

        console.log(`[MCP-DEBUG] ✅ Tool execution completed, final response: "${finalResponse}"`)
      } else {
        console.log("[MCP-DEBUG] No tool calls needed, using LLM response or original transcript")
        finalResponse = llmResponse.content || transcript
      }

      // Save to history (optional - we might want to track MCP recordings separately)
      console.log("[MCP-DEBUG] 💾 Saving MCP recording to history...")
      const history = getRecordingHistory()
      const item: RecordingHistoryItem = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        duration: input.duration,
        transcript: finalResponse,
      }
      history.push(item)
      saveRecordingsHitory(history)

      console.log(`[MCP-DEBUG] Saving audio file: ${item.id}.webm`)
      fs.writeFileSync(
        path.join(recordingsFolder, `${item.id}.webm`),
        Buffer.from(input.recording),
      )

      console.log("[MCP-DEBUG] Refreshing UI and hiding panel...")
      const main = WINDOWS.get("main")
      if (main) {
        getRendererHandlers<RendererHandlers>(
          main.webContents,
        ).refreshRecordingHistory.send()
      }

      const panel = WINDOWS.get("panel")
      if (panel) {
        panel.hide()
      }

      console.log("[MCP-DEBUG] ✅ MCP recording processing completed successfully!")

      // Copy final response to clipboard and paste
      clipboard.writeText(finalResponse)
      if (isAccessibilityGranted()) {
        try {
          await writeText(finalResponse)
        } catch (error) {
          console.error(`Failed to write text:`, error)
        }
      }
    }),

  getRecordingHistory: t.procedure.action(async () => getRecordingHistory()),

  deleteRecordingItem: t.procedure
    .input<{ id: string }>()
    .action(async ({ input }) => {
      const recordings = getRecordingHistory().filter(
        (item) => item.id !== input.id,
      )
      saveRecordingsHitory(recordings)
      fs.unlinkSync(path.join(recordingsFolder, `${input.id}.webm`))
    }),

  deleteRecordingHistory: t.procedure.action(async () => {
    fs.rmSync(recordingsFolder, { force: true, recursive: true })
  }),

  getConfig: t.procedure.action(async () => {
    return configStore.get()
  }),

  saveConfig: t.procedure
    .input<{ config: Config }>()
    .action(async ({ input }) => {
      configStore.save(input.config)
    }),

  recordEvent: t.procedure
    .input<{ type: "start" | "end" }>()
    .action(async ({ input }) => {
      if (input.type === "start") {
        state.isRecording = true
      } else {
        state.isRecording = false
      }
      updateTrayIcon()
    }),
}

export type Router = typeof router
