import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OAuthAuthorization {
  client?: { name?: string; client_id?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
}

interface OAuthApi {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthAuthorization | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthAuthorization | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthAuthorization | null; error: { message: string } | null }>;
}

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const SCOPE_LABEL: Record<string, string> = {
  openid: "Confirmar sua identidade",
  email: "Compartilhar seu e-mail",
  profile: "Compartilhar seu perfil básico",
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar aplicativo — Axon Pro" },
      {
        name: "description",
        content: "Autorize um aplicativo externo a usar o Axon Pro com sua conta.",
      },
      { property: "og:title", content: "Autorizar aplicativo — Axon Pro" },
      {
        property: "og:description",
        content: "Tela de autorização de acesso externo à sua conta do Axon Pro.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: session } = await supabase.auth.getSession();
    return { details: data, email: session.session?.user?.email ?? null };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="f-fixed max-w-md border-2 border-destructive/60 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
        Não foi possível carregar este pedido de autorização:{" "}
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "aplicativo externo";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border-2 border-strong bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="f-fixed text-lg font-bold uppercase tracking-wide text-foreground">
            Conectar {clientName} ao Axon Pro
          </h1>
        </div>

        <p className="f-fixed mt-3 text-sm text-foreground">
          Isso permite que {clientName} use este aplicativo como você.
        </p>
        {email && (
          <p className="f-fixed mt-1 text-xs text-muted-foreground">Conta conectada: {email}</p>
        )}
        {details?.client?.redirect_uri && (
          <p className="f-fixed mt-1 break-all text-xs text-muted-foreground">
            Retorno: {details.client.redirect_uri}
          </p>
        )}

        <ul className="f-fixed mt-4 space-y-1 text-xs text-foreground">
          {scopes.length ? (
            scopes.map((s) => (
              <li key={s}>• {SCOPE_LABEL[s] ?? `Permissão adicional solicitada: ${s}`}</li>
            ))
          ) : (
            <li>• Confirmar sua identidade nesta conta</li>
          )}
          <li>• Consultar pacientes, escores, checklist e plano pelas ferramentas do app</li>
        </ul>

        <p className="f-fixed mt-4 border-2 border-strong bg-primary/10 px-3 py-2 text-xs text-foreground">
          Isso não contorna as permissões nem as políticas de acesso aos dados do Axon Pro.
        </p>

        {error && (
          <p className="f-fixed mt-4 border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="f-fixed mt-6 w-full border-2 border-strong bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Processando..." : "Aprovar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="f-fixed mt-3 w-full border-2 border-strong px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
        >
          Cancelar conexão
        </button>
      </div>
    </main>
  );
}
