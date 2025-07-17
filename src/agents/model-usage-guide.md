# AI Model Usage Guide for Lead-Miner Agents

## Model Selection Guidelines

### o4-mini (Reasoning Model)
Use for tasks that require:
- **Complex Analysis**: Classification of content, determining relevance
- **Decision Making**: Evaluating if content meets multiple criteria
- **Logical Reasoning**: Self-consistency checks, confidence scoring
- **Pattern Recognition**: Identifying auction/travel/nonprofit patterns
- **Contextual Understanding**: Understanding relationships between data points

Examples:
```typescript
// Classification task - requires reasoning
const response = await openai.chat.completions.create({
  model: 'o4-mini',
  messages: [{
    role: 'system',
    content: 'Analyze if this content describes a nonprofit travel auction...'
  }],
  temperature: 0.1 // Low temperature for consistent reasoning
});

// Self-consistency check - requires reasoning
const consistencyCheck = await openai.chat.completions.create({
  model: 'o4-mini',
  messages: [{
    role: 'system',
    content: 'Verify if this classification is consistent...'
  }]
});
```

### gpt-4.1-mini (No-Reasoning & Vision Model)
Use for tasks that are:
- **Simple Text Generation**: Creating formatted output from templates
- **Data Transformation**: Converting data from one format to another
- **Text Extraction**: Pulling specific information from structured text
- **Basic Summarization**: Creating simple summaries without analysis
- **Template Filling**: Filling in predefined templates with data
- **Image Analysis**: Analyzing images and extracting text/information

Examples:
```typescript
// Simple formatting task - no reasoning needed
const response = await openai.chat.completions.create({
  model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
  messages: [{
    role: 'system',
    content: 'Format this data as a CSV row: ' + JSON.stringify(data)
  }],
  temperature: 0 // Zero temperature for deterministic output
});

// Template-based response - no reasoning needed
const emailTemplate = await openai.chat.completions.create({
  model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
  messages: [{
    role: 'system',
    content: 'Fill in this email template with the provided data...'
  }]
});
```

## Cost Optimization Strategy

1. **Default to Simple Model**: Always start by asking "Does this task require reasoning?"
2. **Use Reasoning Model Only When Necessary**: Reserve o4-mini for tasks that genuinely need analysis
3. **Cache Results**: Both models' outputs should be cached when possible
4. **Batch Processing**: Group similar tasks together to optimize API calls

## Implementation Pattern

```typescript
// Example: Choosing the right model
async function processContent(content: string, taskType: 'classify' | 'format' | 'extract') {
  let model: string;
  let temperature: number;
  
  switch (taskType) {
    case 'classify':
      // Classification requires reasoning
      model = 'o4-mini';
      temperature = 0.1;
      break;
      
    case 'format':
    case 'extract':
      // Simple tasks don't require reasoning
      model = config.apis.openai.simpleModel || 'gpt-4.1-mini';
      temperature = 0;
      break;
      
    default:
      // When in doubt, use the simple model
      model = config.apis.openai.simpleModel || 'gpt-4.1-mini';
      temperature = 0;
  }
  
  return await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: `Process this content: ${content}` }],
    temperature
  });
}
```

## Current Usage in Lead-Miner

| Agent | Task | Model | Reasoning |
|-------|------|-------|-----------|
| ClassifierAgent | Content classification | o4-mini | ✅ Requires analysis of multiple criteria |
| ClassifierAgent | Self-consistency check | o4-mini | ✅ Requires logical verification |
| ClassifierAgent | Human review flag | o4-mini | ✅ Requires decision making |
| EnrichmentAgent | Contact extraction | regex/parsing | N/A - No AI needed |
| HelloWorldAgent | Test responses | gpt-4.1-mini | ❌ Simple template responses |

## Environment Configuration

Set these environment variables:
```bash
OPENAI_MODEL=o4-mini          # Primary reasoning model
OPENAI_SIMPLE_MODEL=gpt-4.1-mini  # Simple generation model
OPENAI_VISION_MODEL=gpt-4.1-mini  # Image analysis model
```

## Future Considerations

- Monitor costs between models to validate savings
- Consider fine-tuning for specific tasks if volume increases
- Evaluate newer models as they become available
- Track performance differences between models for quality assurance 