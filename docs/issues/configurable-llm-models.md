# 🧠 Make Transcript Post-Processing LLM Model Configurable

**Status:** Proposed  
**Priority:** Medium  
**Labels:** enhancement, configuration, llm, user-experience  

## Overview

Make the transcript post-processing LLM model configurable through the user interface settings instead of being hard-coded. This will give users more control over the quality, speed, and cost of their transcript enhancement.

## Background

Currently, the LLM models used for transcript post-processing are hard-coded in the application:
- OpenAI: `gpt-4o-mini` (default)
- Groq: `gemma2-9b-it` (default)  
- Gemini: `gemini-1.5-flash-002` (default)

Users should be able to choose from available models based on their needs for speed, quality, and cost.

## Current Implementation

In `src/main/llm.ts`:
```typescript
model:
  chatProviderId === "groq"
    ? config.transcriptPostProcessingGroqModel || "gemma2-9b-it"
    : config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini",
```

The configuration types exist in `src/shared/types.ts` but the UI doesn't expose them.

## Requirements

### UI Enhancements
- [ ] Add model selection dropdowns in settings for each LLM provider
- [ ] Display model capabilities (speed, quality, cost indicators)
- [ ] Show model descriptions and recommended use cases
- [ ] Validate model availability with provider APIs

### Configuration Updates
- [ ] Extend settings UI to include model selection
- [ ] Add model validation and error handling
- [ ] Provide sensible defaults for each provider
- [ ] Support for custom/fine-tuned models

### Model Options

#### OpenAI Models
- [ ] `gpt-4o` - Highest quality, slower, more expensive
- [ ] `gpt-4o-mini` - Balanced quality/speed/cost (current default)
- [ ] `gpt-3.5-turbo` - Faster, lower cost, good quality
- [ ] `gpt-4-turbo` - High quality, moderate speed

#### Groq Models  
- [ ] `gemma2-9b-it` - Balanced performance (current default)
- [ ] `llama-3.1-70b-versatile` - Highest quality
- [ ] `llama-3.1-8b-instant` - Fastest response
- [ ] `mixtral-8x7b-32768` - Large context window

#### Gemini Models
- [ ] `gemini-1.5-flash` - Fast and efficient (current default)
- [ ] `gemini-1.5-pro` - Highest quality
- [ ] `gemini-1.0-pro` - Balanced option

## Technical Implementation

### Settings UI Updates

Add to `src/renderer/src/pages/settings-general.tsx`:

```typescript
// OpenAI Model Selection
<Control label="OpenAI Model" className="px-3">
  <Select
    value={config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini"}
    onValueChange={(value) => saveConfig({ transcriptPostProcessingOpenaiModel: value })}
  >
    <SelectItem value="gpt-4o">GPT-4o (Highest Quality)</SelectItem>
    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Recommended)</SelectItem>
    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Economical)</SelectItem>
  </Select>
</Control>
```

### Model Information Display

```typescript
interface ModelInfo {
  id: string
  name: string
  description: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'good' | 'high' | 'excellent'
  cost: 'low' | 'medium' | 'high'
  contextWindow: number
}
```

### Configuration Schema Updates

The types already exist in `src/shared/types.ts`:
```typescript
transcriptPostProcessingOpenaiModel?: string
transcriptPostProcessingGroqModel?: string  
transcriptPostProcessingGeminiModel?: string
```

## User Experience Improvements

### Model Recommendations
- [ ] Show recommended models for different use cases
- [ ] Display cost estimates and speed indicators
- [ ] Provide tooltips with model descriptions
- [ ] Add "Test Model" functionality

### Smart Defaults
- [ ] Set appropriate defaults based on provider selection
- [ ] Remember user preferences across sessions
- [ ] Provide quick preset configurations (Fast, Balanced, Quality)

### Validation & Error Handling
- [ ] Validate model availability with provider APIs
- [ ] Show clear error messages for unsupported models
- [ ] Graceful fallback to default models
- [ ] Real-time model status checking

## Implementation Plan

### Phase 1: Basic Model Selection
- [ ] Add model dropdown for each provider in settings
- [ ] Update configuration handling
- [ ] Implement basic validation
- [ ] Test with existing models

### Phase 2: Enhanced UX
- [ ] Add model information and recommendations
- [ ] Implement speed/quality/cost indicators
- [ ] Add model testing functionality
- [ ] Create preset configurations

### Phase 3: Advanced Features
- [ ] Real-time model availability checking
- [ ] Usage analytics and recommendations
- [ ] Custom model support
- [ ] Model performance monitoring

## Acceptance Criteria

- [ ] Users can select LLM models for each provider in settings
- [ ] Model selection is persisted in configuration
- [ ] Clear model descriptions and recommendations are shown
- [ ] Invalid model selections show appropriate error messages
- [ ] Default models are set appropriately for new users
- [ ] Model changes take effect immediately for new transcriptions

## Benefits

### For Users
- **Cost Control**: Choose cheaper models for basic corrections
- **Quality Control**: Select high-quality models for important content
- **Speed Optimization**: Pick faster models for real-time use
- **Flexibility**: Adapt to different use cases and requirements

### For Developers
- **Future-Proofing**: Easy to add new models as they become available
- **User Satisfaction**: More control leads to better user experience
- **Debugging**: Easier to test different models for quality comparison

## Related Issues

- MCP tools integration (will need model selection for tool calling)
- Performance optimization
- Cost tracking and analytics
- Model usage statistics

## Notes

- Should maintain backward compatibility with existing configurations
- Consider adding usage analytics to help users choose optimal models
- May want to add cost estimation features in the future
- Should validate model availability before saving configuration
