import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

/** Verifica a sessão liberada; redireciona para /login quando bloqueada. */
export const checkGate = createServerFn({ method: "GET" }).handler(async () => {
  const { getGateSession } = await import("./gate.server");
  const session = await getGateSession();
  if (!session.data.unlocked) throw redirect({ to: "/login" });
  return { ok: true as const };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { user: string; password: string }) => ({
    user: String(data?.user ?? ""),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { getGateSession, credentialsValid } = await import("./gate.server");
    if (!credentialsValid(data.user, data.password)) return { ok: false as const };
    const session = await getGateSession();
    await session.update({ unlocked: true, user: data.user.trim() });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const { getGateSession } = await import("./gate.server");
  const session = await getGateSession();
  await session.clear();
  return { ok: true as const };
});
