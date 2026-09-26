import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const transcribeInput = z.object({
  audioBase64: z.string().min(16).max(24_000_000),
});

export const transcribeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => transcribeInput.parse(data))
  .handler(async ({ data }) => {
    const { transcribeUtterance } = await import("./voice.server");
    const text = await transcribeUtterance(data.audioBase64);
    return { text };
  });

const replyInput = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(120),
  customerName: z.string().max(120).nullable().optional(),
});

export const agentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => replyInput.parse(data))
  .handler(async ({ data }) => {
    const { generateAgentReply } = await import("./voice.server");
    const text = await generateAgentReply(data.history, data.customerName ?? null);
    return { text };
  });

const speakInput = z.object({ text: z.string().min(1).max(2000) });

export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => speakInput.parse(data))
  .handler(async ({ data }) => {
    const { synthesizeSpeech } = await import("./voice.server");
    const audioBase64 = await synthesizeSpeech(data.text);
    return { audioBase64 };
  });
