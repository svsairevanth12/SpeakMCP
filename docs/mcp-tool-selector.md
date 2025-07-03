# MCP Tool Selector Enhancement

## Overview

This enhancement adds a manual tool selection interface to complement the existing automatic MCP processing in Whispo. While the existing MCP integration automatically processes transcripts with configured tools, this new feature allows users to manually select specific tools and configure their arguments.

## Features

### Manual Tool Selection
- **Tool Browser**: Browse all available tools from all connected MCP servers
- **Server Context**: See which server each tool belongs to
- **Tool Information**: View tool descriptions and input schemas
- **Argument Configuration**: Manually configure tool arguments via JSON input

### Enhanced User Control
- **Selective Processing**: Choose specific tools instead of automatic processing
- **Custom Arguments**: Add custom arguments beyond the transcript
- **Result Inspection**: View detailed tool execution results
- **Error Handling**: Clear error messages for failed tool calls

## Usage

### Accessing the Tool Selector
1. Record audio and generate a transcript
2. Look for the tool icon (🔧) next to each transcript item
3. Click the tool selector button (separate from the automatic MCP button)

### Using the Tool Selector
1. **Select Tool**: Choose from dropdown showing `Server → Tool - Description`
2. **Review Information**: See tool details including description and schema
3. **Configure Arguments**: Add custom JSON arguments (transcript is auto-included)
4. **Execute**: Click "Execute Tool" to run the selected tool
5. **View Results**: Results are displayed in an alert dialog

### Example Workflow
```
1. Record: "Create a new file called test.txt with hello world"
2. Click tool selector button
3. Select: "filesystem → write_file - Write content to a file"
4. Add arguments: {"path": "test.txt", "content": "hello world"}
5. Execute tool
6. View success/error result
```

## Technical Implementation

### Component Structure
- **McpToolSelector**: Main React component with dialog interface
- **Tool Discovery**: Uses existing `getMcpTools()` TIPC procedure
- **Tool Execution**: Uses existing `callMcpTool()` TIPC procedure
- **State Management**: React hooks for dialog state and form data

### Integration Points
- **Transcript Items**: Added alongside existing MCP button
- **TIPC Client**: Reuses existing MCP procedures
- **UI Components**: Uses existing dialog, button, and input components
- **Error Handling**: Consistent with existing error patterns

### Data Flow
```
1. User clicks tool selector button
2. Component queries available tools via TIPC
3. User selects tool and configures arguments
4. Component calls tool via TIPC with transcript + arguments
5. Results displayed to user
```

## Differences from Automatic Processing

| Feature | Automatic Processing | Manual Tool Selector |
|---------|---------------------|---------------------|
| **Trigger** | Automatic on transcript | Manual button click |
| **Tool Selection** | All configured tools | Single selected tool |
| **Arguments** | Predefined/automatic | User-configurable |
| **Control** | Hands-off | Full user control |
| **Use Case** | Batch processing | Targeted operations |

## Benefits

### For Users
- **Precision**: Execute specific tools for specific tasks
- **Learning**: Understand what each tool does
- **Debugging**: Test tools with custom arguments
- **Flexibility**: Mix automatic and manual processing

### For Developers
- **Testing**: Easy way to test MCP tools during development
- **Debugging**: Inspect tool inputs/outputs
- **Experimentation**: Try different argument combinations
- **Integration**: Gradual adoption of MCP tools

## Future Enhancements

### Planned Features
- **Result Display**: Rich UI for tool results instead of alert dialogs
- **Argument Templates**: Pre-configured argument templates for common tools
- **Tool Favorites**: Save frequently used tool configurations
- **Batch Execution**: Run multiple tools on the same transcript

### Possible Integrations
- **Workflow Builder**: Chain multiple tool calls together
- **Result Processing**: Further process tool results with other tools
- **History**: Track tool execution history and results
- **Sharing**: Share tool configurations between users

## Configuration

The tool selector respects the existing MCP configuration:
- **Enable/Disable**: Controlled by `mcpToolCallingEnabled` setting
- **Server Configuration**: Uses existing MCP server settings
- **Tool Availability**: Shows tools from all connected servers
- **Permissions**: Same security model as automatic processing

## Troubleshooting

### Tool Not Available
- Ensure MCP is enabled in settings
- Check that the MCP server is connected
- Verify the tool is available in the server

### Tool Call Fails
- Check the JSON syntax in additional arguments
- Verify the tool arguments match the expected schema
- Check console for detailed error messages

### No Tools Showing
- Ensure at least one MCP server is configured and connected
- Check the MCP settings page for server status
- Try refreshing the page or restarting the application

This enhancement provides a powerful complement to the existing automatic MCP processing, giving users fine-grained control over tool execution while maintaining the simplicity of the automatic workflow for common use cases.
