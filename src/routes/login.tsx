import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Lock, User, LogIn } from "lucide-react";
import { unlockSite } from "@/lib/gate.functions";
import mainLogo from "@/assets/axon-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso restrito — Passômetro UTI" },
      {
        name: "description",
        content: "Área restrita à equipe assistencial da UTI. Informe usuário e senha para acessar o painel.",
      },
      { property: "og:title", content: "Acesso restrito — Passômetro UTI" },
      {
        property: "og:description",
        content: "Área restrita à equipe assistencial da UTI.",
      },
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Cabeçalho com o mesmo logo do painel principal */}
        <div
          className="flex items-center justify-center rounded-t-md border-2 border-b-0 border-strong px-6 py-6"
          style={{
            background:
              "linear-gradient(100deg, color-mix(in oklab, oklch(0.5 0.16 155) 72%, transparent), color-mix(in oklab, oklch(0.35 0.05 240) 30%, transparent) 45%, color-mix(in oklab, oklch(0.5 0.16 235) 72%, transparent))",
            backdropFilter: "blur(14px) saturate(150%)",
          }}
        >
          <img
            src={mainLogo.url}
            alt="Passômetro UTI"
            className="h-auto w-auto max-w-full object-contain"
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
            Acesso restrito
          </h1>
          <p className="f-fixed mt-1 text-xs text-muted-foreground">
            Uso exclusivo da equipe assistencial da UTI.
          </p>

          <label className="f-fixed mt-5 block text-xs font-semibold uppercase tracking-wide text-foreground">
            Usuário
          </label>
          <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              name="user"
              autoComplete="username"
              autoFocus
              className="f-var w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="Usuário"
            />
          </div>

          <label className="f-fixed mt-4 block text-xs font-semibold uppercase tracking-wide text-foreground">
            Senha
          </label>
          <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              type="password"
              autoComplete="current-password"
              className="f-var w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="Senha"
            />
          </div>

          {error && (
            <p className="f-fixed mt-4 border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              Usuário ou senha inválidos.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="f-fixed mt-6 flex w-full items-center justify-center gap-2 border-2 border-strong bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
