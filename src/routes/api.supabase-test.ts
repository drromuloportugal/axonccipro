import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/supabase-test")({
  server: {
    handlers: {
      GET: async () => {
        const url =
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL;

        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Variáveis do Supabase não encontradas no servidor.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const supabase = createClient(url, key);

        const { error } = await supabase
          .from("icu_beds")
          .select("id")
          .limit(1);

        if (error) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: error.message,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            message: "AXON conectado ao Supabase.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
