-- Non-destructive upgrade for RO location tracking.
-- Run this once in Supabase SQL Editor if your database is already seeded.

CREATE TABLE IF NOT EXISTS public.ro_locations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ro_locations_user_date_idx
ON public.ro_locations (user_id, work_date, created_at DESC);

ALTER TABLE public.ro_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read locations for authenticated users" ON public.ro_locations;
DROP POLICY IF EXISTS "Allow insert own location for Recovery Officers" ON public.ro_locations;
DROP POLICY IF EXISTS "Allow all operations on locations for Admins" ON public.ro_locations;

CREATE POLICY "Allow read locations for authenticated users"
ON public.ro_locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert own location for Recovery Officers"
ON public.ro_locations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  public.current_user_role() = 'Recovery Officer'
);

CREATE POLICY "Allow all operations on locations for Admins"
ON public.ro_locations FOR ALL
TO authenticated
USING (
  public.current_user_role() = 'Admin'
)
WITH CHECK (public.current_user_role() = 'Admin');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ro_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ro_locations;
  END IF;
END $$;

-- Refresh Supabase/PostgREST schema cache immediately after creating the table.
NOTIFY pgrst, 'reload schema';
