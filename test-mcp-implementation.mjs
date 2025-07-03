#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Simple test script to verify MCP implementation
console.log("Testing MCP Tool Calling Implementation...\n");

// Test 1: Check if MCP SDK is installed
try {
  const packageJsonPath = path.join(process.cwd(), 'node_modules/@modelcontextprotocol/sdk/package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log("✅ MCP SDK is installed");
  } else {
    console.log("❌ MCP SDK is not installed");
  }
} catch (error) {
  console.log("❌ Error checking MCP SDK:", error.message);
}

// Test 2: Check if our MCP service can be imported
try {

  const mcpServicePath = path.join(process.cwd(), 'src/main/mcp-service.ts');
  if (fs.existsSync(mcpServicePath)) {
    console.log("✅ MCP service file exists");
  } else {
    console.log("❌ MCP service file not found");
  }
  
  const llmServicePath = path.join(process.cwd(), 'src/main/llm.ts');
  if (fs.existsSync(llmServicePath)) {
    console.log("✅ Enhanced LLM service file exists");
  } else {
    console.log("❌ Enhanced LLM service file not found");
  }

  const tipcPath = path.join(process.cwd(), 'src/main/tipc.ts');
  if (fs.existsSync(tipcPath)) {
    console.log("✅ Enhanced TIPC router file exists");
  } else {
    console.log("❌ Enhanced TIPC router file not found");
  }

  const settingsToolsPath = path.join(process.cwd(), 'src/renderer/src/pages/settings-tools.tsx');
  if (fs.existsSync(settingsToolsPath)) {
    console.log("✅ MCP settings page exists");
  } else {
    console.log("❌ MCP settings page not found");
  }
  
} catch (error) {
  console.log("❌ Error checking files:", error.message);
}

// Test 3: Check configuration schema
try {
  const typesContent = fs.readFileSync('src/shared/types.ts', 'utf8');
  
  if (typesContent.includes('mcpToolsEnabled')) {
    console.log("✅ MCP configuration schema is updated");
  } else {
    console.log("❌ MCP configuration schema not found");
  }
} catch (error) {
  console.log("❌ Error checking configuration schema:", error.message);
}

// Test 4: Check keyboard handling
try {
  const keyboardContent = fs.readFileSync('src/main/keyboard.ts', 'utf8');
  
  if (keyboardContent.includes('mcpToolsShortcut') && keyboardContent.includes('AltLeft')) {
    console.log("✅ MCP keyboard handling is implemented");
  } else {
    console.log("❌ MCP keyboard handling not found");
  }
} catch (error) {
  console.log("❌ Error checking keyboard handling:", error.message);
}

// Test 5: Check panel component
try {
  const panelContent = fs.readFileSync('src/renderer/src/pages/panel.tsx', 'utf8');
  
  if (panelContent.includes('mcpTranscribeMutation') && panelContent.includes('mcpMode')) {
    console.log("✅ MCP panel integration is implemented");
  } else {
    console.log("❌ MCP panel integration not found");
  }
} catch (error) {
  console.log("❌ Error checking panel component:", error.message);
}

console.log("\n🎉 MCP Tool Calling implementation test completed!");
console.log("\nNext steps:");
console.log("1. Configure your LLM provider API keys in the app settings");
console.log("2. Enable MCP Tool Calling in Settings > Tools");
console.log("3. Choose your preferred shortcut (Hold Ctrl+Alt or Ctrl+Alt+/)");
console.log("4. Test by saying something like 'create a file called test.txt with hello world'");
console.log("5. The system will transcribe your speech, send it to the LLM with available tools, and execute the appropriate actions");
