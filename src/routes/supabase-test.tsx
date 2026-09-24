import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SupabaseTest() {
  const [status, setStatus] = useState("Testando conexão...");
  const [details, setDetails] = useState("");

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase
          .from("icu_beds")
          .select("id, bed_code")
          .limit(5);

        if (error) {
          setStatus("❌ ERRO NA CONEXÃO");
          setDetails(error.message);
          return;
        }

        setStatus("✅ AXON CONECTADO AO SUPABASE");
        setDetails(
          data && data.length > 0
            ? `Leitos encontrados: ${data.map((b) => b.bed_code).join(", ")}`
            : "Conexão funcionando. Nenhum leito cadastrado ainda."
        );
      } catch (error) {
        setStatus("❌ ERRO");
        setDetails(error instanceof Error ? error.message : String(error));
      }
    }

    testConnection();
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Teste de conexão AXON</h1>
      <h2>{status}</h2>
      <p>{details}</p>
    </main>
  );
}
