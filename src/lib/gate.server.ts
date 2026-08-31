import { useSession } from "@tanstack/react-start/server";

type GateSession = { unlocked?: boolean };

export function getGateSession() {
  return useSession<GateSession>({
    password: process.env["SESSION_SECRET"]!,
    name: "utiflow-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  });
}

/** Throws a 401 Response when the visitor has not passed the site gate. */
export async function requireUnlocked() {
  const session = await getGateSession();
  if (session.data.unlocked !== true) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
