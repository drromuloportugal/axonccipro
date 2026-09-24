import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import mainLogo from "@/assets/axon-critical-care-logo-transparent.png";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar nova senha — Passômetro UTI" },
      {
        name: "description",
        content:
          "Defina uma nova senha para sua conta individual de acesso ao painel de passagem de plantão da UTI.",
      },
      { property: "og:title", content: "Criar nova senha — Passômetro UTI" },
      {
        property: "og:description",
        content: "Redefinição de senha da equipe assistencial da UTI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  // O link do e-mail cria uma sessão de recuperação temporária.
  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setReady(true);
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) setReady(true);
    })();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!mounted) return <div className="min-h-screen bg-background" />;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setInfo("Senha atualizada. Abrindo o painel...");
      await router.navigate({ to: "/" });
      router.invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar a senha";
      setError(
        /session|jwt|expired/i.test(message)
          ? "O link expirou. Peça um novo link de redefinição na tela de acesso."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div
          className="flex items-center justify-center rounded-t-md border-2 border-b-0 border-strong px-6 py-6"
          style={{
            background:
              "linear-gradient(100deg, color-mix(in oklab, oklch(0.5 0.16 155) 72%, transparent), color-mix(in oklab, oklch(0.35 0.05 240) 30%, transparent) 45%, color-mix(in oklab, oklch(0.5 0.16 235) 72%, transparent))",
            backdropFilter: "blur(14px) saturate(150%)",
          }}
        >
          <img
            src={mainLogo}
            alt="Axon Critical Care Intelligence"
            className="h-auto w-auto max-w-full rounded-md object-contain"
            style={{
              maxHeight: "4.5rem",
              filter:
                "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 22px rgba(74, 222, 128, 0.35))",
            }}
          />
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-b-md border-2 border-strong bg-card p-6 shadow-lg"
        >
          <h1 className="f-fixed text-lg font-bold uppercase tracking-wide text-foreground">
            Criar nova senha
          </h1>
          <p className="f-fixed mt-1 text-xs text-muted-foreground">
            {ready
              ? "Digite a nova senha duas vezes para confirmar."
              : "Abra esta página pelo link enviado ao seu e-mail para redefinir a senha."}
          </p>

          <label className="f-fixed mt-5 block text-xs font-semibold uppercase tracking-wide text-foreground">
            Nova senha
          </label>
          <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
              className="f-var w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="Nova senha"
            />
          </div>

          <label className="f-fixed mt-4 block text-xs font-semibold uppercase tracking-wide text-foreground">
            Confirmar senha
          </label>
          <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="f-var w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="Repita a nova senha"
            />
          </div>

          {error && (
            <p className="f-fixed mt-4 border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p className="f-fixed mt-4 border-2 border-strong bg-primary/10 px-3 py-2 text-xs font-semibold text-foreground">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="f-fixed mt-6 flex w-full items-center justify-center gap-2 border-2 border-strong bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>

          <button
            type="button"
            onClick={() => router.navigate({ to: "/auth" })}
            className="f-fixed mt-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground underline"
          >
            Voltar para a tela de acesso
          </button>
        </form>
      </div>
    </div>
  );
}
