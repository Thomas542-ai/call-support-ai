const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const CHAT_MODEL = "openai/gpt-6-astra";
const TRANSCRIBE_MODEL = "google/gemini-3.5-transcribe";
const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The AI voice service is not configured yet.");
  return key;
}

function friendlyError(status: number, body: string): Error {
  if (status === 402) {
    return new Error("The AI workspace is out of credits. Add credits to keep taking calls.");
  }
  if (status === 429) {
    return new Error("The AI service is busy right now. Please try again in a moment.");
  }
  if (status === 401 || status === 403) {
    return new Error("The AI service rejected this request. Access needs to be restored.");
  }
  console.error(`AI gateway error [${status}]: ${body}`);
  return new Error("The AI service could not complete this request.");
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

async function* sseEvents(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as Record<string, unknown>;
        } catch {
          // ignore keep-alives and partial frames
        }
      }
    }
  }
}

/** Transcribe a short recorded utterance. */
export async function transcribeUtterance(audioBase64: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([base64ToBytes(audioBase64)], { type: "audio/webm" }), "utterance.webm");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("stream", "true");

  const response = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });

  if (!response.ok) throw friendlyError(response.status, await response.text());

  let text = "";
  let final: string | null = null;
  for await (const event of sseEvents(response)) {
    const type = event["type"];
    if (type === "transcript.text.delta" && typeof event["delta"] === "string") {
      text += event["delta"];
    }
    if (type === "transcript.text.done" && typeof event["text"] === "string") {
      final = event["text"];
    }
  }
  return (final ?? text).trim();
}

export type AgentTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are Aria, a warm, highly competent voice support agent for a customer support line.

Rules for speaking:
- You are on a live phone call. Keep replies short and conversational: one to three sentences, no lists, no markdown, no emoji.
- Speak naturally, use contractions, and never read out URLs or long reference codes unless asked.
- Ask one clarifying question at a time when you need more detail.
- Remember everything said earlier in this call and refer back to it naturally.
- You currently have no access to live business systems. Never claim an action such as changing an appointment, issuing a refund, or updating an account was completed. Instead explain what you can do: gather the details, confirm them back, and tell the customer it will be passed to the support team.
- If the customer asks for something sensitive, irreversible, or beyond your knowledge, say so plainly and offer a handover to a human representative.
- If you did not understand, say so and ask them to repeat.`;

/** Generate the agent's next spoken reply. */
export async function generateAgentReply(
  history: AgentTurn[],
  customerName: string | null,
): Promise<string> {
  const instructions = customerName
    ? `${SYSTEM_PROMPT}\n\nThe caller's name is ${customerName}. Greet them by first name on the first turn only.`
    : SYSTEM_PROMPT;

  const input =
    history.length === 0
      ? [
          {
            role: "user" as const,
            content: "[The call has just connected. Greet the caller and ask how you can help.]",
          },
        ]
      : history.map((turn) => ({ role: turn.role, content: turn.content }));

  const response = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      instructions,
      input,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });

  if (!response.ok) throw friendlyError(response.status, await response.text());

  let text = "";
  for await (const event of sseEvents(response)) {
    if (event["type"] === "response.output_text.delta" && typeof event["delta"] === "string") {
      text += event["delta"];
    }
  }
  const reply = text.trim();
  if (!reply) throw new Error("The AI agent could not produce a reply.");
  return reply;
}

/** Turn the agent's reply into spoken audio (WAV, base64). */
export async function synthesizeSpeech(text: string): Promise<string> {
  const response = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: `Say in a warm, calm, helpful support-agent voice: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    }),
  });

  if (!response.ok) throw friendlyError(response.status, await response.text());

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("The AI voice service returned no audio.");
  return bytesToBase64(bytes);
}
