CREATE TABLE public.realtime_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  patient_id TEXT,
  model TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtime_sessions TO authenticated;
GRANT ALL ON public.realtime_sessions TO service_role;
ALTER TABLE public.realtime_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own realtime sessions" ON public.realtime_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.realtime_tool_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_id UUID REFERENCES public.realtime_sessions ON DELETE SET NULL,
  patient_id TEXT,
  tool_name TEXT NOT NULL,
  arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary TEXT,
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtime_tool_calls TO authenticated;
GRANT ALL ON public.realtime_tool_calls TO service_role;
ALTER TABLE public.realtime_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own realtime tool calls" ON public.realtime_tool_calls FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.voice_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_id UUID REFERENCES public.realtime_sessions ON DELETE SET NULL,
  patient_id TEXT,
  role TEXT NOT NULL,
  transcript TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_interactions TO authenticated;
GRANT ALL ON public.voice_interactions TO service_role;
ALTER TABLE public.voice_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own voice interactions" ON public.voice_interactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.clinical_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_id UUID REFERENCES public.realtime_sessions ON DELETE SET NULL,
  patient_id TEXT,
  source TEXT NOT NULL DEFAULT 'neto_live',
  question TEXT,
  scope TEXT,
  scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  guidelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_audit_events TO authenticated;
GRANT ALL ON public.clinical_audit_events TO service_role;
ALTER TABLE public.clinical_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clinical audit events" ON public.clinical_audit_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);