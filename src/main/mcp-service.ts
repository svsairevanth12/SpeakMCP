import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { configStore } from "./config"

export interface MCPTool {
  name: string
  description: string
  inputSchema: any
}

export interface MCPToolCall {
  name: string
  arguments: any
}

export interface MCPToolResult {
  content: Array<{
    type: "text"
    text: string
  }>
  isError?: boolean
}

export interface LLMToolCallResponse {
  content?: string
  toolCalls?: MCPToolCall[]
}

class MCPService {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private availableTools: MCPTool[] = []

  async initialize(): Promise<void> {
    // For now, we'll implement a simple in-memory tool registry
    // In the future, this could connect to actual MCP servers
    this.availableTools = [
      {
        name: "create_file",
        description: "Create a new file with the specified content",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The file path to create"
            },
            content: {
              type: "string",
              description: "The content to write to the file"
            }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "read_file",
        description: "Read the contents of a file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The file path to read"
            }
          },
          required: ["path"]
        }
      },
      {
        name: "list_files",
        description: "List files in a directory",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The directory path to list"
            }
          },
          required: ["path"]
        }
      },
      {
        name: "send_notification",
        description: "Send a system notification to the user",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The notification title"
            },
            message: {
              type: "string",
              description: "The notification message"
            }
          },
          required: ["title", "message"]
        }
      }
    ]
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools
  }

  async executeToolCall(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (toolCall.name) {
        case "create_file":
          return await this.createFile(toolCall.arguments.path, toolCall.arguments.content)
        
        case "read_file":
          return await this.readFile(toolCall.arguments.path)
        
        case "list_files":
          return await this.listFiles(toolCall.arguments.path)
        
        case "send_notification":
          return await this.sendNotification(toolCall.arguments.title, toolCall.arguments.message)
        
        default:
          return {
            content: [{
              type: "text",
              text: `Unknown tool: ${toolCall.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      }
    }
  }

  private async createFile(path: string, content: string): Promise<MCPToolResult> {
    const fs = await import("fs/promises")
    const pathModule = await import("path")
    
    try {
      // Ensure directory exists
      await fs.mkdir(pathModule.dirname(path), { recursive: true })
      await fs.writeFile(path, content, "utf8")
      
      return {
        content: [{
          type: "text",
          text: `Successfully created file: ${path}`
        }]
      }
    } catch (error) {
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async readFile(path: string): Promise<MCPToolResult> {
    const fs = await import("fs/promises")
    
    try {
      const content = await fs.readFile(path, "utf8")
      return {
        content: [{
          type: "text",
          text: `File content of ${path}:\n\n${content}`
        }]
      }
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async listFiles(path: string): Promise<MCPToolResult> {
    const fs = await import("fs/promises")
    
    try {
      const files = await fs.readdir(path, { withFileTypes: true })
      const fileList = files.map(file => 
        file.isDirectory() ? `${file.name}/` : file.name
      ).join("\n")
      
      return {
        content: [{
          type: "text",
          text: `Files in ${path}:\n\n${fileList}`
        }]
      }
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async sendNotification(title: string, message: string): Promise<MCPToolResult> {
    const { Notification } = await import("electron")
    
    try {
      new Notification({
        title,
        body: message
      }).show()
      
      return {
        content: [{
          type: "text",
          text: `Notification sent: ${title}`
        }]
      }
    } catch (error) {
      throw new Error(`Failed to send notification: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
  }
}

export const mcpService = new MCPService()
