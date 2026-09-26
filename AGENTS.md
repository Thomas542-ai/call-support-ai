<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Voice pipeline lives in `src/lib/voice.server.ts` (Lovable AI Gateway calls: transcription, chat reply, speech) and is exposed only through auth-protected server functions in `src/lib/voice.functions.ts` — keeps the API key and prompts server-side.
- Client call orchestration (mic capture, silence detection, barge-in, playback) lives in `src/hooks/useVoiceCall.ts`; route components stay presentational.
- Signed-in pages live under `src/routes/_authenticated/`, which holds the single session gate — one place to protect all customer pages.
- Roles are stored in `public.user_roles` and checked via the `has_role` / `is_staff` security-definer functions, never on profiles — prevents privilege escalation.
