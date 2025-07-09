# Railway Deployment Guide

This guide covers how to deploy the Cartesia Voice Agent to Railway.

## Prerequisites

Before deploying to Railway, you need:
1. A Railway account
2. API keys for all required services
3. A LiveKit Cloud account or self-hosted LiveKit server

## Required Environment Variables

### For the Agent (Backend)
Set these environment variables in your Railway project:

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
CARTESIA_API_KEY=your-cartesia-api-key
OPENAI_API_KEY=your-openai-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
```

### For the Frontend (if deploying separately)
```
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

## Deployment Steps

### Option 1: Deploy Agent Only (Recommended)
1. Connect your GitHub repository to Railway
2. Set the root directory to `agent/`
3. Railway will automatically detect the Dockerfile
4. Set all required environment variables in the Railway dashboard
5. Deploy

### Option 2: Deploy Both Frontend and Agent
1. Create two Railway services:
   - One for the agent (root directory: `agent/`)
   - One for the frontend (root directory: `frontend/`)
2. Set the appropriate environment variables for each service
3. Deploy both services

## Health Check

The agent includes a built-in health check endpoint at `/health` on port 8080. Railway will automatically use this to monitor your deployment.

## Troubleshooting

### Common Issues

1. **Port Configuration**: The agent is configured to use port 8080 by default, which Railway requires.

2. **Environment Variables**: Ensure all required environment variables are set in the Railway dashboard.

3. **Build Issues**: If the Docker build fails, check the logs. The `.dockerignore` file excludes unnecessary files to speed up builds.

4. **Memory Usage**: The agent loads several models on startup. If you encounter memory issues, consider upgrading your Railway plan.

### Logs

Check the Railway logs for:
- Model loading progress during startup
- API key validation
- Connection issues with external services

## Service Dependencies

The agent requires the following external services:
- **LiveKit**: For real-time communication
- **Cartesia**: For text-to-speech synthesis
- **OpenAI**: For LLM (GPT-4o-mini)
- **Deepgram**: For speech-to-text

Ensure all API keys are valid and services are accessible.

## Performance Optimization

The agent includes model prewarming in the `prewarm` function to reduce cold start times. This loads:
- Silero VAD model
- Cartesia voice list

## Security Notes

- Never commit `.env` files to version control
- Use Railway's environment variable management for secrets
- The `.dockerignore` file excludes sensitive files from the Docker build
- Environment variables are securely managed by Railway