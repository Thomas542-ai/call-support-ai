import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AlertTriangle, Mic, PhoneCall, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceCall, type CallStatus } from "@/hooks/useVoiceCall";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/call")({
  head: () => ({
    meta: [
      { title: "Live call with Aria — Aria Support Line" },
      {
        name: "description",
        content:
          "Start a live voice conversation with Aria, the AI support agent. Speak naturally, interrupt any time, and see the transcript as you talk.",
      },
      { property: "og:title", content: "Live call with Aria" },
      {
        property: "og:description",
        content: "Start a live voice conversation with Aria, the AI support agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallPage,
});

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Ready to call",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Aria is speaking",
  ended: "Call ended",
};

function CallPage() {
  const { fullName } = useAuth();
  const { status, turns, level, error, startCall, endCall } = useVoiceCall(fullName);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const active = status !== "idle" && status !== "ended";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="panel flex flex-col items-center justify-center gap-8 p-10 text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full bg-primary/25 blur-2xl",
              active && "animate-orb",
            )}
            style={{ transform: `scale(${1 + level * 0.5})` }}
          />
          <span className="absolute inset-6 rounded-full border border-primary/40" />
          <span
            className="absolute inset-10 rounded-full bg-primary/20"
            style={{ transform: `scale(${1 + level})` }}
          />
          <Mic className="relative h-10 w-10 text-primary" />
        </div>

        <div>
          <p className="font-display text-xl font-semibold">{STATUS_LABEL[status]}</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {active
              ? "Speak naturally. Pause when you're done and Aria will answer — interrupt her any time."
              : "Aria answers instantly, remembers the whole conversation, and hands you to a human when needed."}
          </p>
        </div>

        {active ? (
          <Button size="lg" variant="destructive" onClick={() => void endCall()}>
            <PhoneOff className="mr-2 h-4 w-4" />
            End call
          </Button>
        ) : (
          <Button size="lg" onClick={() => void startCall()}>
            <PhoneCall className="mr-2 h-4 w-4" />
            {status === "ended" ? "Start a new call" : "Start call"}
          </Button>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-left text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </section>

      <section className="panel flex min-h-[26rem] flex-col p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Live transcript
        </h2>
        <div ref={transcriptRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {turns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing yet — the conversation appears here as it happens.
            </p>
          )}
          {turns.map((turn, index) => (
            <div
              key={`${index}-${turn.role}`}
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                turn.role === "assistant"
                  ? "bg-secondary text-secondary-foreground"
                  : "ml-auto bg-primary text-primary-foreground",
              )}
            >
              <span className="mb-0.5 block text-[0.65rem] uppercase tracking-widest opacity-70">
                {turn.role === "assistant" ? "Aria" : "You"}
              </span>
              {turn.content}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
