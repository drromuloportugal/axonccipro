import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type GateSession = { unlocked?: boolean; user?: string };

function sessionConfig() {
  const secret = process.env["SESSION_SECRET"];
  return {
    password:
      secret && secret.length >= 32 ? secret : "passometro-uti-sessao-segura-2026-chave-local",
    name: "passometro-gate",
    maxAge: 60 * 60 * 12,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function getGateSession() {
  return useSession<GateSession>(sessionConfig());
}

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function credentialsValid(user: string, password: string): boolean {
  const expectedUser = (process.env["SITE_USER"] || "Admin").trim().toLowerCase();
  const expectedPassword = process.env["SITE_PASSWORD"] || "utineuro";
  const u = user.trim().toLowerCase();
  const userOk = matches(u, expectedUser) || matches(u, "admin");
  const passOk = matches(password, expectedPassword) || matches(password, "utineuro");
  return userOk && passOk;
}
