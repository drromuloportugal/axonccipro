-- ============ BIBLIOTECA DE EVIDÊNCIAS ============
CREATE TABLE public.clinical_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  domain text NOT NULL,
  society text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinical_guidelines TO authenticated;
GRANT ALL ON public.clinical_guidelines TO service_role;
ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le diretrizes" ON public.clinical_guidelines FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guideline_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id uuid NOT NULL REFERENCES public.clinical_guidelines(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  year integer,
  status text NOT NULL DEFAULT 'active',
  source_url text,
  notes text,
  retrieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guideline_id, version_label)
);
GRANT SELECT ON public.guideline_versions TO authenticated;
GRANT ALL ON public.guideline_versions TO service_role;
ALTER TABLE public.guideline_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le versoes de diretriz" ON public.guideline_versions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guideline_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.guideline_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  domain text NOT NULL,
  topic text NOT NULL,
  statement_summary text NOT NULL,
  strength text,
  certainty text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, code)
);
GRANT SELECT ON public.guideline_recommendations TO authenticated;
GRANT ALL ON public.guideline_recommendations TO service_role;
ALTER TABLE public.guideline_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le recomendacoes" ON public.guideline_recommendations FOR SELECT TO authenticated USING (true);

-- ============ REGRAS E PROTOCOLOS ============
CREATE TABLE public.engine_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  domain text NOT NULL,
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'attention',
  condition_summary text NOT NULL,
  action_summary text NOT NULL,
  recommendation_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.engine_rules TO authenticated;
GRANT ALL ON public.engine_rules TO service_role;
ALTER TABLE public.engine_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le regras" ON public.engine_rules FOR SELECT TO authenticated USING (true);

CREATE TABLE public.clinical_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  domain text NOT NULL,
  statement text NOT NULL,
  precedence boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinical_protocols TO authenticated;
GRANT ALL ON public.clinical_protocols TO service_role;
ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le protocolos" ON public.clinical_protocols FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe cria protocolos" ON public.clinical_protocols FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Equipe edita protocolos" ON public.clinical_protocols FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ AUDITORIA ============
CREATE TABLE public.engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  patient_bed text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  intent text NOT NULL,
  question text,
  data_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  rules_fired jsonb NOT NULL DEFAULT '[]'::jsonb,
  guidelines_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.engine_runs TO authenticated;
GRANT ALL ON public.engine_runs TO service_role;
ALTER TABLE public.engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le analises" ON public.engine_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe registra analises" ON public.engine_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Equipe revisa analises" ON public.engine_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX engine_runs_patient_idx ON public.engine_runs (patient_id, created_at DESC);

CREATE TABLE public.engine_run_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.engine_runs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.engine_run_actions TO authenticated;
GRANT ALL ON public.engine_run_actions TO service_role;
ALTER TABLE public.engine_run_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le acoes" ON public.engine_run_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe registra acoes" ON public.engine_run_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.engine_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  run_id uuid REFERENCES public.engine_runs(id) ON DELETE SET NULL,
  code text NOT NULL,
  domain text NOT NULL,
  priority text NOT NULL,
  title text NOT NULL,
  evidence text,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.engine_alerts TO authenticated;
GRANT ALL ON public.engine_alerts TO service_role;
ALTER TABLE public.engine_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le alertas" ON public.engine_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe cria alertas" ON public.engine_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Equipe reconhece alertas" ON public.engine_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX engine_alerts_patient_idx ON public.engine_alerts (patient_id, created_at DESC);

CREATE TABLE public.engine_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  run_id uuid REFERENCES public.engine_runs(id) ON DELETE SET NULL,
  window_label text NOT NULL,
  due_time text,
  domain text NOT NULL,
  priority text NOT NULL DEFAULT 'attention',
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.engine_tasks TO authenticated;
GRANT ALL ON public.engine_tasks TO service_role;
ALTER TABLE public.engine_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe le tarefas" ON public.engine_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe cria tarefas" ON public.engine_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Equipe atualiza tarefas" ON public.engine_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX engine_tasks_patient_idx ON public.engine_tasks (patient_id, created_at DESC);

-- ============ TRIGGER DE updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_guidelines_updated BEFORE UPDATE ON public.clinical_guidelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_guideline_versions_updated BEFORE UPDATE ON public.guideline_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_guideline_recs_updated BEFORE UPDATE ON public.guideline_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_engine_rules_updated BEFORE UPDATE ON public.engine_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_protocols_updated BEFORE UPDATE ON public.clinical_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_engine_tasks_updated BEFORE UPDATE ON public.engine_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEMENTES: DIRETRIZES ============
INSERT INTO public.clinical_guidelines (slug, domain, society, title) VALUES
  ('ssc-sepsis', 'sepse', 'SCCM / ESICM (Surviving Sepsis Campaign)', 'Surviving Sepsis Campaign — sepse e choque séptico em adultos'),
  ('padis', 'dor_sedacao_delirium', 'SCCM', 'PADIS — dor, agitação/sedação, delirium, imobilidade e sono'),
  ('ards-ventilation', 'ventilacao', 'ATS / ESICM / SCCM', 'Ventilação mecânica na SDRA do adulto'),
  ('hap-vap', 'infeccao', 'IDSA / ATS', 'Pneumonia adquirida no hospital e associada à ventilação'),
  ('neurocritical-sah', 'neurocritico', 'AHA/ASA e Neurocritical Care Society', 'Hemorragia subaracnóidea aneurismática'),
  ('neurocritical-ich', 'neurocritico', 'AHA/ASA', 'Hemorragia intracerebral espontânea'),
  ('neurocritical-stroke', 'neurocritico', 'AHA/ASA', 'AVC isquêmico agudo'),
  ('neurocritical-tbi', 'neurocritico', 'Brain Trauma Foundation', 'Traumatismo cranioencefálico grave'),
  ('status-epilepticus', 'neurocritico', 'Neurocritical Care Society / AES', 'Status epilepticus'),
  ('kdigo-aki', 'renal', 'KDIGO', 'Lesão renal aguda e terapia renal substitutiva'),
  ('nutrition-icu', 'nutricao', 'ASPEN / SCCM e ESPEN', 'Terapia nutricional no paciente crítico'),
  ('vte-icu', 'trombose', 'ASH e CHEST', 'Profilaxia e tratamento de tromboembolismo venoso'),
  ('transfusion-icu', 'transfusao', 'AABB', 'Limiares de transfusão de hemácias'),
  ('glycemic-icu', 'endocrino', 'ADA / SCCM', 'Controle glicêmico no paciente crítico'),
  ('cardio-shock', 'cardiologia', 'AHA/ACC e ESC', 'Choque cardiogênico, síndrome coronariana aguda, fibrilação atrial e insuficiência cardíaca'),
  ('ecmo-icu', 'ecmo', 'ELSO', 'Suporte extracorpóreo (ECMO)'),
  ('pocus-icu', 'pocus', 'SCCM', 'Ultrassonografia point-of-care na UTI'),
  ('device-safety', 'dispositivos', 'CDC / SHEA e ANVISA', 'Prevenção de infecção relacionada a dispositivos invasivos'),
  ('palliative-icu', 'paliativo', 'SCCM', 'Cuidados paliativos e metas de cuidado na UTI'),
  ('safety-icu', 'seguranca', 'SCCM / IHI', 'Segurança e qualidade assistencial na UTI'),
  ('trauma-icu', 'trauma', 'ATLS / EAST', 'Trauma grave em terapia intensiva'),
  ('burns-icu', 'queimados', 'American Burn Association', 'Grande queimado');

INSERT INTO public.guideline_versions (guideline_id, version_label, year, status, source_url, notes, retrieved_at)
SELECT g.id, v.version_label, v.year, v.status, v.source_url, v.notes, now()
FROM public.clinical_guidelines g
JOIN (VALUES
  ('ssc-sepsis', 'SSC 2026', 2026, 'active', 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-guidelines', 'Atualização com 129 statements, dos quais 46 novos: triagem, culturas, lactato, ressuscitação, antimicrobianos, stewardship, hemodinâmica, ventilação/SDRA, tromboprofilaxia, reconciliação medicamentosa, metas de cuidado e transições de cuidado.'),
  ('ssc-sepsis', 'SSC 2021', 2021, 'superseded', 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-guidelines', 'Versão anterior mantida para rastreabilidade.'),
  ('padis', 'PADIS 2018', 2018, 'active', 'https://www.sccm.org/clinical-resources/guidelines/guidelines/clinical-practice-guidelines-for-the-prevention-and', 'Documento base de dor, agitação/sedação, delirium, imobilidade e sono.'),
  ('padis', 'PADIS Focused Update 2025', 2025, 'active', 'https://www.sccm.org/clinical-resources/guidelines', 'Atualização focada, aplicada em conjunto com o documento de 2018.'),
  ('ards-ventilation', 'ARDS 2023-2024', 2024, 'active', 'https://www.thoracic.org/statements/', 'Volume corrente por peso predito, pressão de platô, driving pressure, PEEP, pronação e bloqueio neuromuscular.'),
  ('hap-vap', 'HAP/VAP 2016', 2016, 'active', 'https://www.idsociety.org/practice-guideline/hap_vap/', 'Diagnóstico, terapia empírica, descalonamento e duração.'),
  ('neurocritical-sah', 'AHA/ASA aSAH 2023', 2023, 'active', 'https://www.ahajournals.org/journal/str', 'Manejo de HSA aneurismática, vasoespasmo e isquemia cerebral tardia.'),
  ('neurocritical-ich', 'AHA/ASA ICH 2022', 2022, 'active', 'https://www.ahajournals.org/journal/str', 'Pressão arterial, reversão de coagulopatia e cuidados neurocríticos.'),
  ('neurocritical-stroke', 'AHA/ASA AIS 2019/2021', 2021, 'active', 'https://www.ahajournals.org/journal/str', 'Trombólise, trombectomia e cuidados na fase aguda.'),
  ('neurocritical-tbi', 'BTF 4a edicao', 2016, 'active', 'https://braintrauma.org/guidelines', 'Pressão intracraniana, pressão de perfusão cerebral e osmoterapia.'),
  ('status-epilepticus', 'NCS/AES 2016', 2016, 'active', 'https://www.neurocriticalcaresociety.org/guidelines', 'Tratamento escalonado do status epilepticus e monitorização por EEG.'),
  ('kdigo-aki', 'KDIGO AKI 2012 (+ atualizacoes)', 2012, 'active', 'https://kdigo.org/guidelines/acute-kidney-injury/', 'Estadiamento de LRA por creatinina e diurese, ajuste renal e indicação de terapia renal substitutiva.'),
  ('nutrition-icu', 'ASPEN/SCCM 2022 e ESPEN 2023', 2023, 'active', 'https://www.nutritioncare.org/guidelines_and_clinical_resources/', 'Via, momento e progressão da terapia nutricional.'),
  ('vte-icu', 'ASH 2018/2019 e CHEST 2021', 2021, 'active', 'https://ashpublications.org/', 'Profilaxia farmacológica e mecânica e tratamento de tromboembolismo.'),
  ('transfusion-icu', 'AABB 2023', 2023, 'active', 'https://www.aabb.org/', 'Estratégia restritiva de transfusão de hemácias.'),
  ('glycemic-icu', 'ADA 2025', 2025, 'active', 'https://diabetesjournals.org/care', 'Metas glicêmicas e insulinoterapia no paciente hospitalizado.'),
  ('cardio-shock', 'AHA/ACC e ESC 2021-2023', 2023, 'active', 'https://www.acc.org/Guidelines', 'Choque cardiogênico, síndrome coronariana aguda, fibrilação atrial e insuficiência cardíaca.'),
  ('ecmo-icu', 'ELSO 2021', 2021, 'active', 'https://www.elso.org/resources/guidelines.aspx', 'Indicação, manejo e desmame de suporte extracorpóreo.'),
  ('pocus-icu', 'SCCM POCUS 2024', 2024, 'active', 'https://www.sccm.org/clinical-resources/guidelines', 'Uso de ultrassonografia point-of-care na avaliação hemodinâmica e pulmonar.'),
  ('device-safety', 'CDC/SHEA 2022-2023', 2023, 'active', 'https://www.cdc.gov/infection-control/hcp/index.html', 'Prevenção de infecção de corrente sanguínea, urinária e associada à ventilação.'),
  ('palliative-icu', 'SCCM 2017 e atualizacoes', 2017, 'active', 'https://www.sccm.org/clinical-resources/guidelines', 'Comunicação, metas de cuidado e suporte à família.'),
  ('safety-icu', 'SCCM/IHI 2023', 2023, 'active', 'https://www.sccm.org/clinical-resources/guidelines', 'Prevenção de eventos adversos e cultura de segurança.'),
  ('trauma-icu', 'EAST 2023', 2023, 'active', 'https://www.east.org/education-resources/practice-management-guidelines', 'Manejo do trauma grave em terapia intensiva.'),
  ('burns-icu', 'ABA 2023', 2023, 'active', 'https://ameriburn.org/resources/guidelines/', 'Ressuscitacao volemica e cuidados do grande queimado.')
) AS v(slug, version_label, year, status, source_url, notes) ON v.slug = g.slug;

INSERT INTO public.guideline_recommendations (version_id, code, domain, topic, statement_summary, strength, certainty, source_url)
SELECT ver.id, r.code, r.domain, r.topic, r.statement, r.strength, r.certainty, ver.source_url
FROM public.guideline_versions ver
JOIN public.clinical_guidelines g ON g.id = ver.guideline_id
JOIN (VALUES
  ('ssc-sepsis','SSC 2026','SSC26-SCREEN','sepse','Triagem','Usar rotina de triagem sistemática para sepse em pacientes de risco, em vez de depender apenas de sinais isolados.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-CULT','sepse','Culturas','Coletar culturas apropriadas, incluindo hemoculturas, antes do inicio do antimicrobiano quando isso nao atrasar significativamente a terapia.','boa pratica',NULL),
  ('ssc-sepsis','SSC 2026','SSC26-LACT','sepse','Lactato','Medir lactato e repetir a medida para guiar a ressuscitacao quando o valor inicial estiver elevado.','condicional','baixa'),
  ('ssc-sepsis','SSC 2026','SSC26-FLUID','sepse','Ressuscitacao','Iniciar ressuscitacao com cristaloide balanceado e reavaliar a resposta com medidas dinamicas, evitando sobrecarga volemica.','condicional','baixa'),
  ('ssc-sepsis','SSC 2026','SSC26-ATB','sepse','Antimicrobianos','Administrar antimicrobiano de amplo espectro precocemente no choque septico; na sepse sem choque, priorizar avaliacao rapida com inicio conforme probabilidade de infeccao.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-STEW','sepse','Stewardship','Reavaliar diariamente espectro e duracao, descalonar conforme cultura e resposta clinica e usar a menor duracao efetiva.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-HEMO','sepse','Hemodinamica','Alvo inicial de pressao arterial media de 65 mmHg com noradrenalina como vasopressor de primeira escolha.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-VENT','sepse','Ventilacao e SDRA','Na SDRA induzida por sepse, usar ventilacao protetora com volume corrente baixo e limitar pressao de plato.','forte','alta'),
  ('ssc-sepsis','SSC 2026','SSC26-VTE','sepse','Tromboprofilaxia','Oferecer profilaxia farmacologica de tromboembolismo venoso na ausencia de contraindicacao.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-MEDREC','sepse','Reconciliacao medicamentosa','Realizar reconciliacao medicamentosa na admissao e nas transicoes de cuidado.','boa pratica',NULL),
  ('ssc-sepsis','SSC 2026','SSC26-GOALS','sepse','Metas de cuidado','Discutir metas de cuidado precocemente, integrando a familia e o cuidado paliativo quando indicado.','forte','moderada'),
  ('ssc-sepsis','SSC 2026','SSC26-TRANS','sepse','Transicoes de cuidado','Estruturar a transicao de cuidado com comunicacao padronizada e plano de seguimento.','boa pratica',NULL),
  ('padis','PADIS 2018','PADIS18-PAIN','dor_sedacao_delirium','Dor','Avaliar dor sistematicamente com escala validada (CPOT ou BPS) e tratar guiado pela avaliacao.','forte','moderada'),
  ('padis','PADIS 2018','PADIS18-SED','dor_sedacao_delirium','Sedacao','Manter sedacao leve com meta definida, priorizando analgesia e evitando benzodiazepinico como sedativo de escolha.','condicional','baixa'),
  ('padis','PADIS 2018','PADIS18-DEL','dor_sedacao_delirium','Delirium','Rastrear delirium rotineiramente com CAM-ICU ou ICDSC e priorizar medidas nao farmacologicas multicomponente.','forte','moderada'),
  ('padis','PADIS 2018','PADIS18-MOB','dor_sedacao_delirium','Mobilidade','Realizar mobilizacao e reabilitacao precoces quando nao houver contraindicacao.','condicional','baixa'),
  ('padis','PADIS 2018','PADIS18-SLEEP','dor_sedacao_delirium','Sono','Aplicar protocolo de promocao do sono com reducao de ruido, luz e interrupcoes noturnas.','condicional','muito baixa'),
  ('padis','PADIS Focused Update 2025','PADIS25-FOCUS','dor_sedacao_delirium','Atualizacao focada','Aplicar a atualizacao focada de 2025 em conjunto com o documento de 2018 para analgesia, escolha de sedativo e manejo do delirium.','condicional','moderada'),
  ('ards-ventilation','ARDS 2023-2024','ARDS-VT','ventilacao','Volume corrente','Ventilar com 4 a 8 mL/kg de peso corporal predito e manter pressao de plato de 30 cmH2O ou menos.','forte','alta'),
  ('ards-ventilation','ARDS 2023-2024','ARDS-DP','ventilacao','Driving pressure','Manter driving pressure a mais baixa possivel, idealmente 15 cmH2O ou menos, quando o dado estiver disponivel.','condicional','moderada'),
  ('ards-ventilation','ARDS 2023-2024','ARDS-PRONE','ventilacao','Pronacao','Na SDRA moderada a grave com PaO2/FiO2 menor que 150, considerar pronacao prolongada.','forte','moderada'),
  ('ards-ventilation','ARDS 2023-2024','ARDS-WEAN','ventilacao','Desmame','Avaliar diariamente elegibilidade para teste de respiracao espontanea.','forte','moderada'),
  ('hap-vap','HAP/VAP 2016','VAP-EMP','infeccao','Terapia empirica','Escolher a terapia empirica conforme fatores de risco para multirresistencia e perfil microbiologico local.','forte','moderada'),
  ('hap-vap','HAP/VAP 2016','VAP-DUR','infeccao','Duracao','Usar sete dias de tratamento para a maioria dos casos, individualizando conforme resposta clinica.','forte','moderada'),
  ('neurocritical-sah','AHA/ASA aSAH 2023','SAH-VASO','neurocritico','Vasoespasmo','Monitorar isquemia cerebral tardia, manter euvolemia e usar nimodipino conforme a diretriz.','forte','moderada'),
  ('neurocritical-ich','AHA/ASA ICH 2022','ICH-BP','neurocritico','Pressao arterial','Controlar pressao arterial de forma precoce, suave e sustentada, evitando grandes variacoes.','condicional','moderada'),
  ('neurocritical-tbi','BTF 4a edicao','TBI-ICP','neurocritico','Pressao intracraniana','Tratar pressao intracraniana acima de 22 mmHg e manter pressao de perfusao cerebral na faixa recomendada.','condicional','baixa'),
  ('status-epilepticus','NCS/AES 2016','SE-STEP','neurocritico','Status epilepticus','Tratar em etapas com benzodiazepinico seguido de antiepileptico e monitorizar com EEG quando persistir alteracao de consciencia.','forte','moderada'),
  ('kdigo-aki','KDIGO AKI 2012 (+ atualizacoes)','AKI-STAGE','renal','Estadiamento','Estadiar lesao renal aguda por variacao de creatinina e por debito urinario.','forte','alta'),
  ('kdigo-aki','KDIGO AKI 2012 (+ atualizacoes)','AKI-NEPHRO','renal','Nefroprotecao','Evitar nefrotoxicos, ajustar dose de medicamentos a funcao renal e manter perfusao adequada.','forte','moderada'),
  ('kdigo-aki','KDIGO AKI 2012 (+ atualizacoes)','AKI-KRT','renal','Terapia renal substitutiva','Indicar terapia renal substitutiva por indicacoes classicas e pela trajetoria clinica, nao por valor isolado.','condicional','moderada'),
  ('nutrition-icu','ASPEN/SCCM 2022 e ESPEN 2023','NUT-EN','nutricao','Nutricao enteral','Iniciar nutricao enteral precoce quando o trato gastrointestinal estiver funcionante e o paciente estiver hemodinamicamente estavel.','forte','moderada'),
  ('vte-icu','ASH 2018/2019 e CHEST 2021','VTE-PROPH','trombose','Profilaxia','Usar profilaxia farmacologica na ausencia de contraindicacao e profilaxia mecanica quando houver contraindicacao ao farmaco.','forte','moderada'),
  ('transfusion-icu','AABB 2023','TRF-RESTR','transfusao','Transfusao','Adotar estrategia restritiva de transfusao de hemacias na maioria dos pacientes criticos estaveis.','forte','moderada'),
  ('glycemic-icu','ADA 2025','GLY-TARGET','endocrino','Meta glicemica','Manter glicemia entre 140 e 180 mg/dL na maioria dos pacientes criticos, evitando hipoglicemia.','forte','moderada'),
  ('cardio-shock','AHA/ACC e ESC 2021-2023','CARD-SHOCK','cardiologia','Choque cardiogenico','Avaliar perfil hemodinamico, corrigir causa e considerar suporte mecanico em centro habilitado.','condicional','baixa'),
  ('device-safety','CDC/SHEA 2022-2023','DEV-REVIEW','dispositivos','Necessidade do dispositivo','Reavaliar diariamente a necessidade de cada dispositivo invasivo e remover assim que possivel.','forte','moderada'),
  ('palliative-icu','SCCM 2017 e atualizacoes','PAL-GOALS','paliativo','Metas de cuidado','Conduzir conversas estruturadas sobre metas de cuidado e registrar diretivas.','forte','moderada'),
  ('pocus-icu','SCCM POCUS 2024','POCUS-HEMO','pocus','Avaliacao hemodinamica','Usar ultrassonografia point-of-care para avaliar responsividade a fluidos e funcao cardiaca quando disponivel.','condicional','baixa'),
  ('safety-icu','SCCM/IHI 2023','SAFE-CHECK','seguranca','Checklist diario','Aplicar checklist diario estruturado para prevenir omissoes assistenciais.','boa pratica',NULL)
) AS r(slug, version_label, code, domain, topic, statement, strength, certainty)
  ON r.slug = g.slug AND r.version_label = ver.version_label;

-- ============ SEMENTES: REGRAS DO MOTOR ============
INSERT INTO public.engine_rules (code, domain, title, priority, condition_summary, action_summary, recommendation_code) VALUES
  ('R-SEP-01','sepse','Suspeita de sepse com sinais de disfuncao','critical','Foco infeccioso suspeito ou confirmado com qSOFA maior ou igual a 2, ou lactato elevado, ou uso de vasopressor','Reavaliar reconhecimento de sepse, culturas, lactato seriado, antimicrobiano e perfusao','SSC26-SCREEN'),
  ('R-SEP-02','sepse','Culturas ausentes antes do antimicrobiano','attention','Antimicrobiano ativo sem cultura registrada','Verificar coleta de culturas e registrar resultado','SSC26-CULT'),
  ('R-SEP-03','sepse','Lactato sem medida seriada','pending','Lactato elevado com um unico valor registrado','Repetir lactato para avaliar resposta a ressuscitacao','SSC26-LACT'),
  ('R-SEP-04','sepse','Pressao arterial media abaixo da meta','critical','PAM menor que 65 mmHg','Reavaliar volemia, vasopressor e perfusao','SSC26-HEMO'),
  ('R-SEP-05','sepse','Antimicrobiano sem reavaliacao de espectro e duracao','attention','Antimicrobiano com sete dias ou mais de uso','Revisar descalonamento e duracao total','SSC26-STEW'),
  ('R-RESP-01','ventilacao','Volume corrente acima do alvo protetor','critical','Volume corrente maior que 8 mL/kg de peso predito','Reajustar volume corrente para 4 a 8 mL/kg de peso predito','ARDS-VT'),
  ('R-RESP-02','ventilacao','Pressao de plato elevada','critical','Pressao de plato maior que 30 cmH2O','Reduzir volume corrente e reavaliar mecanica respiratoria','ARDS-VT'),
  ('R-RESP-03','ventilacao','Driving pressure elevada','attention','Driving pressure maior que 15 cmH2O','Reavaliar PEEP e volume corrente','ARDS-DP'),
  ('R-RESP-04','ventilacao','Hipoxemia grave','critical','Relacao PaO2/FiO2 menor que 150 ou SpO2 menor que 90 por cento','Avaliar pronacao, PEEP e bloqueio neuromuscular conforme diretriz','ARDS-PRONE'),
  ('R-RESP-05','ventilacao','Desmame nao avaliado','pending','Ventilacao invasiva sem registro de teste de respiracao espontanea','Avaliar elegibilidade diaria para teste de respiracao espontanea','ARDS-WEAN'),
  ('R-REN-01','renal','Padrao de lesao renal aguda','critical','Creatinina 1,5 vez o menor valor recente ou elevacao de 0,3 mg/dL','Estadiar lesao renal aguda e revisar nefrotoxicos','AKI-STAGE'),
  ('R-REN-02','renal','Oliguria','attention','Diurese menor que 0,5 mL/kg/h','Avaliar volemia, perfusao e permeabilidade do cateter vesical','AKI-STAGE'),
  ('R-REN-03','renal','Ajuste renal de medicamentos pendente','attention','Depuracao de creatinina menor que 50 mL/min com medicamento de eliminacao renal','Revisar dose e intervalo conforme funcao renal','AKI-NEPHRO'),
  ('R-NEU-01','neurocritico','Piora do nivel de consciencia','critical','Queda de dois pontos ou mais na escala de Glasgow','Diferenciar deterioracao neurologica de sedacao e causa metabolica e considerar neuroimagem','ICH-BP'),
  ('R-NEU-02','neurocritico','Sedacao alem da meta','attention','RASS menor ou igual a -3 sem indicacao registrada','Reavaliar meta de sedacao e priorizar analgesia','PADIS18-SED'),
  ('R-NEU-03','neurocritico','Rastreio de delirium ausente','pending','Ausencia de CAM-ICU ou ICDSC registrado','Registrar rastreio de delirium','PADIS18-DEL'),
  ('R-NEU-04','neurocritico','Risco de isquemia cerebral tardia','attention','Hemorragia subaracnoidea entre o terceiro e o decimo quarto dia','Vigiar isquemia cerebral tardia e manter euvolemia','SAH-VASO'),
  ('R-MET-01','endocrino','Glicemia fora da meta','attention','Glicemia menor que 70 ou maior que 180 mg/dL','Reavaliar insulinoterapia e monitorizacao glicemica','GLY-TARGET'),
  ('R-NUT-01','nutricao','Nutricao nao iniciada','attention','Dieta suspensa ou ausente sem contraindicacao registrada','Reavaliar via e inicio da terapia nutricional','NUT-EN'),
  ('R-VTE-01','trombose','Tromboprofilaxia nao identificada','attention','Ausencia de profilaxia farmacologica ou mecanica registrada','Reavaliar profilaxia de tromboembolismo venoso','VTE-PROPH'),
  ('R-DEV-01','dispositivos','Dispositivo invasivo com tempo prolongado','attention','Dispositivo em uso acima do tempo recomendado','Reavaliar necessidade e programar troca ou retirada','DEV-REVIEW'),
  ('R-DEV-02','dispositivos','Dispositivo sem indicacao registrada','pending','Dispositivo em uso sem indicacao documentada','Registrar indicacao e reavaliar necessidade','DEV-REVIEW'),
  ('R-PAIN-01','dor_sedacao_delirium','Avaliacao de dor ausente','pending','Ausencia de CPOT, BPS ou escala numerica registrada','Registrar avaliacao sistematica de dor','PADIS18-PAIN'),
  ('R-TRF-01','transfusao','Anemia com limiar transfusional','attention','Hemoglobina menor que 7 g/dL','Avaliar transfusao conforme estrategia restritiva e contexto clinico','TRF-RESTR'),
  ('R-GOAL-01','paliativo','Metas de cuidado nao registradas','pending','Ausencia de diretivas antecipadas ou metas de cuidado','Conduzir e registrar conversa sobre metas de cuidado','PAL-GOALS');

INSERT INTO public.clinical_protocols (code, name, domain, statement, precedence, active) VALUES
  ('INST-PAM-65','Meta de pressao arterial media da unidade','sepse','Manter pressao arterial media de 65 mmHg ou mais, salvo meta individualizada registrada pela equipe.', false, true),
  ('INST-GLI-140-180','Meta glicemica da unidade','endocrino','Manter glicemia entre 140 e 180 mg/dL com protocolo de insulina da unidade.', false, true),
  ('INST-CVC-REVIEW','Revisao diaria de dispositivos','dispositivos','Revisar diariamente a necessidade de cateter venoso central, sonda vesical e tubo orotraqueal.', false, true);