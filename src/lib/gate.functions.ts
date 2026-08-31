import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function getSession() {
  return useSession<GateSession>({
    password: process.env["SESSION_SECRET"]!,
    name: "utiflow-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: process.env["NODE_ENV"] === "production", sameSite: "lax" as const, path: "/" },
  });
}

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  return { unlocked: session.data.unlocked === true };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { user: string; password: string }) => data)
  .handler(async ({ data }) => {
    const expectedUser = process.env["SITE_USER"];
    const expectedPassword = process.env["SITE_PASSWORD"];
    if (!expectedUser || !expectedPassword) throw new Error("Gate not configured");

    const ok =
      matches(String(data.user ?? "").trim().toLowerCase(), expectedUser.toLowerCase()) &&
      matches(String(data.password ?? ""), expectedPassword);

    if (!ok) return { ok: false as const };

    const session = await getSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});
