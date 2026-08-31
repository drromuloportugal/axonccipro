import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";
import axonLogo from "@/assets/axon-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso — UTIFLOW Passômetro" },
      { name: "description", content: "Área restrita da equipe: entre com suas credenciais para acessar o painel da UTI." },
      { property: "og:title", content: "Acesso — UTIFLOW Passômetro" },
      { property: "og:description", content: "Área restrita da equipe do painel clínico da UTI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await unlock({ data: { user, password } });
      if (res.ok) {
        await router.navigate({ to: "/" });
        router.invalidate();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background p-6"
        style={{
          boxShadow:
            "0 18px 45px -18px color-mix(in oklab, var(--clinical-resp) 35%, transparent), 0 8px 24px -12px color-mix(in oklab, var(--clinical-stable) 30%, transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
          style={{ background: "linear-gradient(90deg, var(--clinical-resp), var(--clinical-stable))" }}
        />
        <div className="mb-6 flex flex-col items-center">
          <img
            src={axonLogo.url}
            alt="AXON — Critical Care Intelligence"
            className="w-full max-w-[320px] rounded-lg"
            style={{
              boxShadow:
                "0 14px 38px -10px color-mix(in oklab, var(--clinical-resp) 45%, transparent), 0 6px 22px -8px color-mix(in oklab, var(--clinical-stable) 40%, transparent)",
            }}
          />
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Usuário
        </label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Senha
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        {error && (
          <p className="mb-3 text-sm font-medium text-destructive">Usuário ou senha inválidos.</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
