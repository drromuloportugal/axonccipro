import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, User, LogIn, UserPlus, Mail, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import mainLogo from "@/assets/axon-critical-care-logo.jpeg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" && s.next.startsWith("/") ? { next: s.next } : {},
  head: () => ({
    meta: [
      { title: "Acesso da equipe — Passômetro UTI" },
      {
        name: "description",
        content:
          "Entre com sua conta individual para acessar o painel de passagem de plantão da UTI.",
      },
      { property: "og:title", content: "Acesso da equipe — Passômetro UTI" },
      {
        property: "og:description",
        content: "Área restrita à equipe assistencial da UTI.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  // Depois de entrar, volta para o destino original (ex.: consentimento OAuth).
  const goNext = async () => {
    if (next) window.location.href = next;
    else await router.navigate({ to: "/" });
  };
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Se já existe sessão, segue direto para o painel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) await goNext();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, next]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setInfo("Enviamos um link para seu e-mail. Abra a mensagem para criar uma nova senha.");
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin,
            data: { nome: nome.trim() },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          await goNext();
          router.invalidate();
        } else {
          setInfo("Conta criada. Confirme o e-mail recebido para entrar.");
          setMode("login");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        await goNext();
        router.invalidate();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha na autenticação";
      setError(
        /invalid login/i.test(message)
          ? "E-mail ou senha inválidos."
          : /already registered/i.test(message)
            ? "Este e-mail já possui conta. Faça login."
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
            {mode === "login"
              ? "Entrar"
              : mode === "signup"
                ? "Criar conta"
                : "Esqueci minha senha"}
          </h1>
          <p className="f-fixed mt-1 text-xs text-muted-foreground">
            {mode === "reset"
              ? "Informe seu e-mail cadastrado. Enviaremos um link para você criar uma nova senha."
              : "Conta individual da equipe assistencial. Os dados dos pacientes são compartilhados entre todos os profissionais."}
          </p>

          {mode === "signup" && (
            <>
              <label className="f-fixed mt-5 block text-xs font-semibold uppercase tracking-wide text-foreground">
                Nome
              </label>
              <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  name="nome"
                  autoComplete="name"
                  className="f-var w-full bg-transparent text-sm text-foreground outline-none"
                  placeholder="Nome do profissional"
                />
              </div>
            </>
          )}

          <label className="f-fixed mt-4 block text-xs font-semibold uppercase tracking-wide text-foreground">
            E-mail
          </label>
          <div className="mt-1 flex items-center gap-2 border-2 border-strong bg-background px-3 py-2">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="f-var w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="nome@instituicao.com"
            />
          </div>

          {mode !== "reset" && (
            <>
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
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="f-var w-full bg-transparent text-sm text-foreground outline-none"
                  placeholder="Senha"
                />
              </div>
            </>
          )}

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
            disabled={loading}
            className="f-fixed mt-6 flex w-full items-center justify-center gap-2 border-2 border-strong bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {mode === "login" ? (
              <LogIn className="h-4 w-4" aria-hidden />
            ) : mode === "signup" ? (
              <UserPlus className="h-4 w-4" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {loading
              ? "Processando..."
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link de redefinição"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            className="f-fixed mt-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground underline"
          >
            {mode === "login" ? "Não tenho conta — criar acesso" : "Já tenho conta — entrar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setError(null);
              setInfo(null);
            }}
            className="f-fixed mt-2 w-full text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground underline"
          >
            {mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
