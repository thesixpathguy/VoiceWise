# Live Call Audio Playback Feature

## Overview

This feature enables users to listen to live call audio directly from the Live Call modal in the VoiceWise dashboard.

## How It Works

### Architecture

```
User clicks "Play" button in LiveCall modal
        ↓
Frontend calls Bland.ai's /listen endpoint (POC - direct)
        ↓
Bland.ai returns WebSocket URL
        ↓
Frontend creates WebSocket connection
        ↓
Audio streams in real-time via WebSocket
        ↓
Audio is decoded (WAV or PCM16LE) and resampled
        ↓
Audio is played through browser speaker
```

### Supported Formats

- **WAV** (with RIFF header detection)
- **PCM16LE** (16-bit PCM Little-Endian at 16kHz sample rate)

Both formats are automatically detected and resampled to the browser's audio context sample rate if needed.

## Setup Instructions

### 1. Get Your Bland AI API Key

1. Go to: https://account.bland.ai/account/settings
2. Copy your API key
3. Add it to your `.env` file in the frontend directory:

```bash
VITE_BLAND_AI_API_KEY=your-bland-ai-api-key-here
```

### 2. Verify Backend Changes

The backend already includes:

- ✅ Updated `LiveCall` schema with `call_id` field
- ✅ Updated call service to include `call_id` in live call cache

No database migrations needed (cache structure only).

### 3. Test the Feature

1. Start backend:

   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Start frontend:

   ```bash
   cd frontend
   npm run dev
   ```

3. Initiate a live call
4. Open the Live Call modal
5. Click the **"Play"** button (🔊)
6. Audio should start playing immediately
7. Click **"Stop"** (⏹️) to stop playback

## UI Components

### LiveCallModal Audio Controls

Located in the header of the Live Call modal:

- **Play Button**: Shows when not playing

  - Click to start audio streaming
  - Shows connection status

- **Stop Button**: Shows when playing

  - Click to stop audio and close WebSocket

- **Status Indicator**: Shows when playing

  - Animated audio bars
  - "Connecting..." or "Playing" status

- **Error Display**: Shows if something goes wrong
  - Displays error message

## Code Structure

### Frontend Files Modified/Created

#### New Files:

- `frontend/src/services/audioService.js` - Main audio playback logic
  - WebSocket connection management
  - Audio decoding (WAV and PCM16LE)
  - Audio resampling
  - Playback queue management

#### Modified Files:

- `frontend/src/components/LiveCallModal.jsx`

  - Added audio player state management
  - Added Play/Stop buttons
  - Added status indicators
  - Added error handling

- `frontend/src/api/api.js`

  - Added `getLiveCallAudio()` endpoint

- `frontend/.env.example`
  - Added `VITE_BLAND_AI_API_KEY` configuration

### Backend Files Modified/Created

#### Modified:

- `backend/app/schemas/schemas.py`

  - Added `call_id` field to `LiveCall` schema

- `backend/app/services/call_service.py`
  - Updated `process_live_call_conversation_turn()` to include `call_id` when creating LiveCall

## Security Notes (POC vs Production)

### Current Setup (POC)

- ⚠️ **Frontend directly calls Bland.ai**
- ⚠️ **API key exposed in client-side code**
- ✅ **Quick to test**
- ✅ **Works for development**

### Recommended for Production

```
Frontend → Backend → Bland.ai
```

1. Create endpoint: `POST /api/calls/{call_id}/listen`
2. Backend validates call exists
3. Backend calls Bland.ai's `/listen` endpoint with API key
4. Backend returns WebSocket URL to frontend
5. Frontend connects directly to WebSocket

This keeps the API key secure on the server.

## Troubleshooting

### Audio Not Playing

1. Check that `VITE_BLAND_AI_API_KEY` is set in `.env`
2. Check browser console for errors
3. Verify Bland AI API key is valid
4. Ensure the call is actually active in Bland.ai

### WebSocket Connection Error

1. Check browser Network tab → WS filter
2. Verify the WebSocket URL is valid
3. Check for CORS issues
4. Verify Bland.ai service status

### Audio Decoding Error

1. Check console for "Failed to decode" message
2. Verify audio format (WAV vs PCM16LE)
3. Check if resampling is working

### No Audio Output

1. Check browser volume
2. Check system volume
3. Check browser microphone/speaker permissions
4. Try in a different browser

## File Locations

```
frontend/
├── src/
│   ├── services/
│   │   └── audioService.js          (NEW)
│   ├── components/
│   │   └── LiveCallModal.jsx         (MODIFIED)
│   └── api/
│       └── api.js                    (MODIFIED)
└── .env.example                      (MODIFIED)

backend/
├── app/
│   ├── schemas/
│   │   └── schemas.py                (MODIFIED)
│   └── services/
│       └── call_service.py           (MODIFIED)
```
