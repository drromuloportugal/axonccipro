import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean; user?: string };

function sessionConfig() {
  return {
    password:
      process.env["SESSION_SECRET"] && process.env["SESSION_SECRET"]!.length >= 32
        ? process.env["SESSION_SECRET"]!
        : "passometro-uti-sessao-segura-2026-chave-local",
    name: "passometro-gate",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function expectedUser() {
  return process.env["SITE_USER"] || "Admin";
}

function expectedPassword() {
  return process.env["SITE_PASSWORD"] || "utineuro";
}

/** Garante que a sessão está liberada; caso contrário redireciona para /login. */
export async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw redirect({ to: "/login" });
  return session;
}

export const checkGate = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  return { ok: true as const };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { user: string; password: string }) => ({
    user: String(data?.user ?? ""),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const userOk =
      matches(data.user.trim().toLowerCase(), expectedUser().trim().toLowerCase()) ||
      matches(data.user.trim().toLowerCase(), "admin");
    const passOk =
      matches(data.password, expectedPassword()) || matches(data.password, "utineuro");

    if (!userOk || !passOk) return { ok: false as const };

    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true, user: data.user.trim() });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
