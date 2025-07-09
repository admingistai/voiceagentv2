# Railway Deployment Guide

## Required Environment Variables

Configure these environment variables in your Railway project settings:

### LiveKit Configuration
- `LIVEKIT_URL` - Your LiveKit server URL (e.g., `wss://your-project.livekit.cloud`)
- `LIVEKIT_API_KEY` - Your LiveKit API key
- `LIVEKIT_API_SECRET` - Your LiveKit API secret

### AI Service API Keys
- `CARTESIA_API_KEY` - Cartesia API key for text-to-speech (sonic-2 model)
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o-mini language model
- `DEEPGRAM_API_KEY` - Deepgram API key for speech-to-text

### Railway Configuration
- `PORT` - Port for health check endpoint (automatically set by Railway, defaults to 8080)

## Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Add Railway deployment files"
   git push origin main
   ```

2. **Create Railway Project**
   - Go to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Railway will automatically detect the Dockerfile

3. **Set Environment Variables**
   - In Railway dashboard, go to your project
   - Click "Variables" tab
   - Add all the required environment variables listed above

4. **Deploy**
   - Railway will automatically build and deploy your Docker container
   - The health check endpoint will be available at `https://your-app.railway.app/health`
   - The agent will connect to LiveKit and be ready to handle voice conversations

## How It Works

1. **Health Check**: Railway pings `/health` endpoint to ensure the service is running
2. **Voice Agent**: The Python agent connects to LiveKit and waits for users to join rooms
3. **Auto-Join**: The agent automatically joins rooms when users connect through your frontend

## Connecting Frontend Projects

To connect your frontend projects to the Railway-deployed agent:

1. **No changes needed** - The agent connects directly to LiveKit
2. **Frontend setup**: Your Next.js frontends just need the same LiveKit credentials
3. **Room Creation**: When users join, the agent automatically handles the voice conversation

## Monitoring

- Check Railway logs for agent status and errors
- Monitor health endpoint: `https://your-app.railway.app/health`
- LiveKit dashboard shows active connections and rooms

## Troubleshooting

### Common Issues:
- **Agent not connecting**: Check LiveKit credentials in Railway environment variables
- **Health check failing**: Ensure PORT environment variable is set correctly
- **Audio not working**: Verify Cartesia and Deepgram API keys are valid
- **No responses**: Check OpenAI API key and account limits

### Debug Steps:
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Test health endpoint responds with "OK"
4. Check LiveKit dashboard for agent connection status