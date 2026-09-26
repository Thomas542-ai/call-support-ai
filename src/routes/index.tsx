import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Headphones, PhoneCall, ShieldCheck, UserCheck, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aria Support Line — AI voice support that actually listens" },
      {
        name: "description",
        content:
          "Call Aria, an AI support agent you can talk to in real time. Natural speech, full call memory, live transcripts and a handover to a human whenever it matters.",
      },
      { property: "og:title", content: "Aria Support Line — AI voice support that actually listens" },
      {
        property: "og:description",
        content:
          "Talk to an AI support agent in real time: natural speech, full call memory and live transcripts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Waves,
    title: "Real-time voice",
    body: "Speak normally, pause, or cut in mid-sentence. Aria hears you, answers out loud, and keeps the flow of a real conversation.",
  },
  {
    icon: Brain,
    title: "Remembers the whole call",
    body: "Context carries across every turn, so you never repeat your order number, your problem, or what you already tried.",
  },
  {
    icon: ShieldCheck,
    title: "Honest by design",
    body: "Aria never claims an action was completed unless it was. Anything sensitive gets confirmed or passed to a person.",
  },
  {
    icon: UserCheck,
    title: "Built for handover",
    body: "Every call is transcribed and stored, so a human representative can pick up with the full picture.",
  },
];

function Landing() {
  const { session, loading } = useAuth();
  const target = session ? "/call" : "/auth";

  return (
    <div className="min-h-screen bg-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" />
          Aria Support Line
        </span>
        <Button asChild variant="ghost" size="sm" disabled={loading}>
          <Link to={target}>{session ? "Go to your call" : "Sign in"}</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
          Live AI voice support
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Support that <span className="text-gradient-brand">talks back</span> — instantly, and
          actually understands you.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Aria picks up straight away, listens to you speak, and answers out loud in a natural
          conversation. No menus, no hold music, no repeating yourself.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to={target}>
              <PhoneCall className="mr-2 h-4 w-4" />
              Start a call
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Works in your browser — just allow the microphone.
          </span>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="panel p-6">
            <feature.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        Aria Support Line · AI voice support with human handover
      </footer>
    </div>
  );
}
