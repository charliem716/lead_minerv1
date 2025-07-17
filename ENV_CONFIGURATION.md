# Environment Configuration Guide

## OpenAI Configuration

### Model Selection
```bash
# Reasoning model for complex tasks (classification, analysis)
OPENAI_MODEL=o4-mini

# No-reasoning model for simple tasks (formatting, templates)
OPENAI_SIMPLE_MODEL=gpt-4.1-mini

# Vision model for image analysis tasks
OPENAI_VISION_MODEL=gpt-4.1-mini
```

### API Key
```bash
OPENAI_API_KEY=your-openai-api-key-here
```

## Other Configuration

### SerpAPI
```bash
SERPAPI_KEY=your-serpapi-key-here
```

### Google Sheets
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-google-sheet-id-here
```

### Database
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/leadminer
```

### Application Settings
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## Model Usage Guidelines

### When to Use Each Model

**o4-mini** (Reasoning Model):
- Content classification
- Pattern recognition
- Decision making
- Self-consistency checks
- Complex analysis

**gpt-4.1-mini** (No-Reasoning Model):
- Data formatting
- Template filling
- Simple text generation
- Basic extraction
- Straightforward transformations

### Cost Optimization

The no-reasoning model (gpt-4.1-mini) is significantly cheaper than the reasoning model. Always evaluate if your task truly requires reasoning before defaulting to o4-mini.

## Example .env File

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
OPENAI_MODEL=o4-mini
OPENAI_SIMPLE_MODEL=gpt-4.1-mini

# SerpAPI Configuration
SERPAPI_KEY=xxxxxxxxxxxxxxxx

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=lead-miner@myproject.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1234567890abcdef

# Database Configuration
DATABASE_URL=postgresql://leadminer:password@localhost:5432/leadminer_db

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
``` 