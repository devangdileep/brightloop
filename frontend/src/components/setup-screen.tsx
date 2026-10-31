import Link from "next/link";
import { Database, KeyRound, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center px-6 py-16">
      <Card className="w-full">
        <CardContent className="space-y-6 p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="size-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Connect Supabase to get started</h1>
            <p className="text-sm text-muted-foreground">
              Brightloop runs entirely on Supabase. Add your project credentials to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code>, then apply the
              migrations and seed data.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4 font-mono text-xs">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Terminal className="size-3.5" /> terminal
            </p>
            <p>cp .env.example .env.local</p>
            <p>npx supabase link --project-ref YOUR_PROJECT_REF</p>
            <p>npx supabase db push</p>
            <p>psql &quot;$DATABASE_URL&quot; -f supabase/seed.sql</p>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <p>
              Never expose the service-role key to the browser. Only{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> belongs in client code.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/">Back to home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="https://supabase.com/dashboard" target="_blank">
                Open Supabase
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
