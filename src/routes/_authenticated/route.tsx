import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Headphones, History, LogOut, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, fullName } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, navigate, session]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your account…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-sm font-semibold">
            <Headphones className="h-4 w-4 text-primary" />
            Aria Support Line
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/call">
                <PhoneCall className="mr-1.5 h-4 w-4" />
                Call
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/history">
                <History className="mr-1.5 h-4 w-4" />
                History
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="mb-6 text-sm text-muted-foreground">
          Signed in as {fullName ?? session.user.email}
        </p>
        <Outlet />
      </main>
    </div>
  );
}
