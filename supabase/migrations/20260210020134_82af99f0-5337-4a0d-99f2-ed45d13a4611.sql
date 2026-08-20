
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'GURU', 'SISWA');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  nama_lengkap TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table (separate as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. Kelas table
CREATE TABLE public.kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Mapel table
CREATE TABLE public.mapel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. User-Kelas assignment (many-to-many)
CREATE TABLE public.user_kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (user_id, kelas_id)
);

-- 7. User-Mapel assignment (many-to-many)
CREATE TABLE public.user_mapel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mapel_id UUID REFERENCES public.mapel(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (user_id, mapel_id)
);

-- 8. Scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID REFERENCES public.kelas(id) ON DELETE CASCADE NOT NULL,
  mapel_id UUID REFERENCES public.mapel(id) ON DELETE CASCADE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('FORMATIF', 'SUMATIF', 'STS', 'SAS')),
  nama_penilaian TEXT NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nilai NUMERIC NOT NULL DEFAULT 0,
  nilai_type TEXT NOT NULL DEFAULT 'angka' CHECK (nilai_type IN ('angka', 'ceklis')),
  visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kkm NUMERIC NOT NULL DEFAULT 75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Broadcasts table
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_kelas UUID[] DEFAULT '{}',
  target_mapel UUID[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTION ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ============ RLS POLICIES ============

-- Profiles: everyone authenticated can read, users can update own
CREATE POLICY "Authenticated can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admin can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

-- User roles: authenticated can read, admin can manage
CREATE POLICY "Authenticated can read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admin can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admin can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

-- Kelas: authenticated can read, admin can manage
CREATE POLICY "Authenticated can read kelas" ON public.kelas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage kelas" ON public.kelas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Mapel: authenticated can read, admin can manage
CREATE POLICY "Authenticated can read mapel" ON public.mapel
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage mapel" ON public.mapel
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- User-Kelas: authenticated can read, admin can manage
CREATE POLICY "Authenticated can read user_kelas" ON public.user_kelas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage user_kelas" ON public.user_kelas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- User-Mapel: authenticated can read, admin can manage
CREATE POLICY "Authenticated can read user_mapel" ON public.user_mapel
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage user_mapel" ON public.user_mapel
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Scores: students see own, guru/admin see relevant
CREATE POLICY "Students can read own scores" ON public.scores
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'GURU')
  );
CREATE POLICY "Guru and Admin can insert scores" ON public.scores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'GURU')
  );
CREATE POLICY "Guru and Admin can update scores" ON public.scores
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'GURU')
  );
CREATE POLICY "Guru and Admin can delete scores" ON public.scores
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'GURU')
  );

-- Broadcasts: all authenticated can read, guru/admin can manage
CREATE POLICY "Authenticated can read broadcasts" ON public.broadcasts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru and Admin can insert broadcasts" ON public.broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'GURU')
  );
CREATE POLICY "Admin can delete broadcasts" ON public.broadcasts
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR created_by = auth.uid()
  );

-- Settings: all authenticated can read, admin can manage
CREATE POLICY "Authenticated can read settings" ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage settings" ON public.settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, nama_lengkap)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
