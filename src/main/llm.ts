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
  console.log(`[MCP-DEBUG] 🧠 Processing transcript with tools: "${transcript}"`)
  console.log(`[MCP-DEBUG] Available tools: ${availableTools.length}`, availableTools.map(t => t.name))

  const config = configStore.get()

  if (!config.mcpToolsEnabled) {
    console.log("[MCP-DEBUG] MCP tools disabled, returning transcript as-is")
    return { content: transcript }
  }

  const chatProviderId = config.mcpToolsProviderId || "openai"
  console.log(`[MCP-DEBUG] Using LLM provider: ${chatProviderId}`)

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

  console.log(`[MCP-DEBUG] System prompt created with ${availableTools.length} tools`)

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
    console.log("[MCP-DEBUG] Using Gemini for LLM processing")
    if (!config.geminiApiKey) throw new Error("Gemini API key is required")

    const gai = new GoogleGenerativeAI(config.geminiApiKey)
    const geminiModel = config.mcpToolsGeminiModel || "gemini-1.5-flash-002"
    console.log(`[MCP-DEBUG] Using Gemini model: ${geminiModel}`)
    const gModel = gai.getGenerativeModel({ model: geminiModel })

    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    console.log(`[MCP-DEBUG] Sending prompt to Gemini:`, prompt)

    const result = await gModel.generateContent([prompt], {
      baseUrl: config.geminiBaseUrl,
    })

    const responseText = result.response.text().trim()
    console.log(`[MCP-DEBUG] Gemini response:`, responseText)

    try {
      const parsed = JSON.parse(responseText)
      console.log(`[MCP-DEBUG] ✅ Successfully parsed Gemini JSON response:`, parsed)
      return parsed
    } catch (error) {
      console.log(`[MCP-DEBUG] ⚠️ Failed to parse Gemini response as JSON, returning as content:`, error)
      return { content: responseText }
    }
  }

  console.log(`[MCP-DEBUG] Using ${chatProviderId} for LLM processing`)

  const chatBaseUrl =
    chatProviderId === "groq"
      ? config.groqBaseUrl || "https://api.groq.com/openai/v1"
      : config.openaiBaseUrl || "https://api.openai.com/v1"

  const model = chatProviderId === "groq"
    ? config.mcpToolsGroqModel || "gemma2-9b-it"
    : config.mcpToolsOpenaiModel || "gpt-4o-mini"

  console.log(`[MCP-DEBUG] Using model: ${model}`)
  console.log(`[MCP-DEBUG] Sending request to: ${chatBaseUrl}/chat/completions`)

  const chatResponse = await fetch(`${chatBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chatProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature: 0,
      model,
      messages,
    }),
  })

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text()
    const message = `${chatResponse.statusText} ${errorText.slice(0, 300)}`
    console.error(`[MCP-DEBUG] ❌ LLM API error:`, message)
    throw new Error(message)
  }

  const chatJson = await chatResponse.json()
  console.log("[MCP-DEBUG] 📝 LLM API response:", chatJson)

  const responseContent = chatJson.choices[0].message.content.trim()
  console.log(`[MCP-DEBUG] Response content: "${responseContent}"`)

  try {
    const parsed = JSON.parse(responseContent)
    console.log(`[MCP-DEBUG] ✅ Successfully parsed LLM JSON response:`, parsed)
    return parsed
  } catch (error) {
    console.log(`[MCP-DEBUG] ⚠️ Failed to parse LLM response as JSON, returning as content:`, error)
    return { content: responseContent }
  }
}
