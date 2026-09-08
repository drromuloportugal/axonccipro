import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPatients from "./tools/list-patients";
import analyzePatient from "./tools/analyze-patient";
import fasthug from "./tools/fasthug";
import scores from "./tools/scores";
import planNext12h from "./tools/plan-12h";
import guidelines from "./tools/guidelines";

// O emissor OAuth precisa ser o host direto do banco; apenas o project ref
// sobrevive à publicação inalterado.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "axon-pro",
  title: "Axon Pro",
  version: "0.1.0",
  instructions:
    "Ferramentas do passômetro de UTI Axon Pro. Use list_patients para localizar o paciente, analyze_patient para rodar o Motor Clínico determinístico, patient_scores para escores com componentes, fasthug_maidens para o checklist, plan_next_12h para o plano da janela atual e search_guidelines para consultar a biblioteca versionada de diretrizes. As ferramentas nunca prescrevem nem executam condutas: dados ausentes são reportados como DADO NÃO INFORMADO e toda recomendação exige revisão médica.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPatients, analyzePatient, scores, fasthug, planNext12h, guidelines],
});
