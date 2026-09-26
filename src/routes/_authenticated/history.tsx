import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, PhoneCall } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Your call history — Aria Support Line" },
      {
        name: "description",
        content: "Review every previous voice conversation with Aria, including the full transcript of each call.",
      },
      { property: "og:title", content: "Your call history" },
      {
        property: "og:description",
        content: "Review every previous voice conversation with Aria, transcript included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const calls = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, status, started_at, ended_at, agent_name")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["call-messages", openId],
    enabled: Boolean(openId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_messages")
        .select("id, role, content, created_at")
        .eq("call_id", openId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Your calls</h1>

      {calls.isLoading && <p className="text-sm text-muted-foreground">Loading your calls…</p>}
      {calls.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No calls yet. Start one from the Call tab and it will show up here.
        </p>
      )}

      {calls.data?.map((call) => (
        <div key={call.id} className="panel overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenId(openId === call.id ? null : call.id)}
            className="flex w-full items-center justify-between gap-4 p-5 text-left"
          >
            <span className="flex items-center gap-3">
              <PhoneCall className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-sm font-medium">{formatWhen(call.started_at)}</span>
                <span className="block text-xs text-muted-foreground">
                  {call.agent_name} · {call.status === "active" ? "in progress" : "completed"}
                </span>
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openId === call.id && "rotate-180",
              )}
            />
          </button>

          {openId === call.id && (
            <div className="space-y-3 border-t border-border px-5 py-5">
              {messages.isLoading && (
                <p className="text-sm text-muted-foreground">Loading transcript…</p>
              )}
              {messages.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No transcript for this call.</p>
              )}
              {messages.data?.map((message) => (
                <div key={message.id} className="text-sm">
                  <span className="mr-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    {message.role === "assistant" ? call.agent_name : "You"}
                  </span>
                  {message.content}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Button asChild variant="secondary">
        <a href="/call">Start a new call</a>
      </Button>
    </div>
  );
}
