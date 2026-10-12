# Aria Support Line

AI-powered voice customer support built with TanStack Start, React, Supabase, and an OpenAI-compatible AI gateway.

## Development

```sh
npm i
npm run dev
```

Required environment variables:

- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server)
- `AI_API_KEY` (or `OPENAI_API_KEY`). OpenRouter keys are routed to `https://openrouter.ai/api/v1` and use Gemini for chat, transcription, and speech.
- Optional overrides: `AI_GATEWAY_URL`, `AI_CHAT_MODEL`, `AI_TRANSCRIBE_MODEL`, `AI_TTS_MODEL`, `AI_TTS_VOICE`, `AI_TTS_FORMAT`

## Stack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase