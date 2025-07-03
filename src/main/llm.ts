import { GoogleGenerativeAI } from "@google/generative-ai"
import { configStore } from "./config"
import { MCPTool, MCPToolCall, LLMToolCallResponse } from "./mcp-service"

export async function postProcessTranscript(transcript: string) {
  const config = configStore.get()

  if (
    !config.transcriptPostProcessingEnabled ||
    !config.transcriptPostProcessingPrompt
  ) {
    return transcript
  }

  const prompt = config.transcriptPostProcessingPrompt.replace(
    "{transcript}",
    transcript,
  )

  const chatProviderId = config.transcriptPostProcessingProviderId

  if (chatProviderId === "gemini") {
    if (!config.geminiApiKey) throw new Error("Gemini API key is required")

    const gai = new GoogleGenerativeAI(config.geminiApiKey)
    const geminiModel = config.transcriptPostProcessingGeminiModel || "gemini-1.5-flash-002"
    const gModel = gai.getGenerativeModel({ model: geminiModel })

    const result = await gModel.generateContent([prompt], {
      baseUrl: config.geminiBaseUrl,
    })
    return result.response.text().trim()
  }

  const chatBaseUrl =
    chatProviderId === "groq"
      ? config.groqBaseUrl || "https://api.groq.com/openai/v1"
      : config.openaiBaseUrl || "https://api.openai.com/v1"

  const chatResponse = await fetch(`${chatBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chatProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature: 0,
      model:
        chatProviderId === "groq"
          ? config.transcriptPostProcessingGroqModel || "gemma2-9b-it"
          : config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    }),
  })

  if (!chatResponse.ok) {
    const message = `${chatResponse.statusText} ${(await chatResponse.text()).slice(0, 300)}`

    throw new Error(message)
  }

  const chatJson = await chatResponse.json()
  console.log(chatJson)
  return chatJson.choices[0].message.content.trim()
}

export async function processTranscriptWithTools(
  transcript: string,
  availableTools: MCPTool[]
): Promise<LLMToolCallResponse> {
  const config = configStore.get()

  if (!config.mcpToolsEnabled) {
    return { content: transcript }
  }

  const chatProviderId = config.mcpToolsProviderId || "openai"

  // Create system prompt with available tools
  const systemPrompt = config.mcpToolsSystemPrompt || `You are a helpful assistant that can execute tools based on user requests.

Available tools:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

When the user's request requires using a tool, respond with a JSON object in this format:
{
  "toolCalls": [
    {
      "name": "tool_name",
      "arguments": { "param1": "value1", "param2": "value2" }
    }
  ],
  "content": "Optional explanation of what you're doing"
}

If no tools are needed, respond with:
{
  "content": "Your response text here"
}

Always respond with valid JSON only.`

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: transcript
    }
  ]

  if (chatProviderId === "gemini") {
    if (!config.geminiApiKey) throw new Error("Gemini API key is required")

    const gai = new GoogleGenerativeAI(config.geminiApiKey)
    const geminiModel = config.mcpToolsGeminiModel || "gemini-1.5-flash-002"
    const gModel = gai.getGenerativeModel({ model: geminiModel })

    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    const result = await gModel.generateContent([prompt], {
      baseUrl: config.geminiBaseUrl,
    })

    const responseText = result.response.text().trim()
    try {
      return JSON.parse(responseText)
    } catch {
      return { content: responseText }
    }
  }

  const chatBaseUrl =
    chatProviderId === "groq"
      ? config.groqBaseUrl || "https://api.groq.com/openai/v1"
      : config.openaiBaseUrl || "https://api.openai.com/v1"

  const chatResponse = await fetch(`${chatBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chatProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature: 0,
      model:
        chatProviderId === "groq"
          ? config.mcpToolsGroqModel || "gemma2-9b-it"
          : config.mcpToolsOpenaiModel || "gpt-4o-mini",
      messages,
    }),
  })

  if (!chatResponse.ok) {
    const message = `${chatResponse.statusText} ${(await chatResponse.text()).slice(0, 300)}`
    throw new Error(message)
  }

  const chatJson = await chatResponse.json()
  console.log("MCP Tool Response:", chatJson)

  const responseContent = chatJson.choices[0].message.content.trim()

  try {
    return JSON.parse(responseContent)
  } catch {
    return { content: responseContent }
  }
}
