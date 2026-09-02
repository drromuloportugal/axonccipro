CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada pode ver perfis" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario edita o proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuario cria o proprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe autenticada gerencia pacientes" ON public.patients;
CREATE POLICY "Equipe autenticada gerencia pacientes" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);