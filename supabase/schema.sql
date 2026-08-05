-- Enable pgcrypto for password hashing in sql seeds
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Clean existing triggers/tables if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DO $$
BEGIN
  IF to_regclass('public.attendance') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS set_attendance_updated_at ON public.attendance;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_update_user();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.current_user_role();

DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.allocations CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create USERS table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employee_no TEXT UNIQUE,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Sub Admin', 'Recovery Officer')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ROUTES table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  route_name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ALLOCATIONS table
CREATE TABLE public.allocations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  allocation_name TEXT NOT NULL,
  allocation_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ATTENDANCE table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_working_today BOOLEAN NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_work_date UNIQUE (user_id, work_date)
);

-- Helper functions avoid recursive RLS checks when policies need roles.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Supabase Realtime for projector/live dashboards.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'routes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'allocations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.allocations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;
END $$;

-- ----------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------

-- Users Policy
CREATE POLICY "Allow read for authenticated users" 
ON public.users FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all operations for Admins" 
ON public.users FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'admin@ro-tracking.com' OR 
  public.current_user_role() = 'Admin'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'admin@ro-tracking.com' OR 
  public.current_user_role() = 'Admin'
);

-- Routes Policy
CREATE POLICY "Allow read routes for authenticated users" 
ON public.routes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all operations on routes for Admins" 
ON public.routes FOR ALL 
TO authenticated 
USING (
  public.current_user_role() = 'Admin'
)
WITH CHECK (public.current_user_role() = 'Admin');

-- Allocations Policy
CREATE POLICY "Allow read allocations for authenticated users" 
ON public.allocations FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all operations on allocations for Admins" 
ON public.allocations FOR ALL 
TO authenticated 
USING (
  public.current_user_role() = 'Admin'
)
WITH CHECK (public.current_user_role() = 'Admin');

-- Attendance Policy
CREATE POLICY "Allow read attendance for authenticated users" 
ON public.attendance FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow insert own attendance for Recovery Officers" 
ON public.attendance FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id AND 
  public.current_user_role() = 'Recovery Officer'
);

CREATE POLICY "Allow update own attendance for Recovery Officers" 
ON public.attendance FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = user_id AND 
  public.current_user_role() = 'Recovery Officer'
)
WITH CHECK (
  auth.uid() = user_id AND 
  public.current_user_role() = 'Recovery Officer'
);

CREATE POLICY "Allow all operations on attendance for Admins" 
ON public.attendance FOR ALL 
TO authenticated 
USING (
  public.current_user_role() = 'Admin'
)
WITH CHECK (public.current_user_role() = 'Admin');

-- ----------------------------------------------------
-- AUTH SYNC TRIGGERS
-- ----------------------------------------------------

-- Function to handle new user signup/creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, employee_no, phone, email, role, active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    NULLIF(new.raw_user_meta_data->>'employee_no', ''),
    NULLIF(new.raw_user_meta_data->>'phone', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'Recovery Officer'),
    COALESCE((new.raw_user_meta_data->>'active')::boolean, true)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync auth.users inserts
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET
    name = COALESCE(new.raw_user_meta_data->>'name', name),
    employee_no = COALESCE(NULLIF(new.raw_user_meta_data->>'employee_no', ''), employee_no),
    phone = COALESCE(NULLIF(new.raw_user_meta_data->>'phone', ''), phone),
    role = COALESCE(new.raw_user_meta_data->>'role', role),
    active = COALESCE((new.raw_user_meta_data->>'active')::boolean, active)
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync auth.users updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_update_user();

-- ----------------------------------------------------
-- SEED DATA GENERATION
-- ----------------------------------------------------

-- 1. Create Core Routes
INSERT INTO public.routes (route_name, description) VALUES
('Colombo', 'Routes covering central city area and offices'),
('Moratuwa', 'Covers southern suburbs including Moratuwa town'),
('Ratmalana', 'Covers industrial zone and airport area'),
('Panadura', 'South coast boundary collections'),
('Kalutara', 'Extended Southern collections'),
('Negombo', 'North Western coastal collections'),
('Gampaha', 'Outer suburbs industrial hub collections'),
('Kandy', 'Central province collections'),
('Galle', 'Southern province capital collections'),
('Matara', 'Deep South collections')
ON CONFLICT (route_name) DO NOTHING;

-- ----------------------------------------------------
-- PL/SQL block to seed auth & public users
-- ----------------------------------------------------
DO $$
DECLARE
  admin_uid UUID := 'a1111111-1111-1111-1111-111111111111';
  subadmin_uid UUID := 'b2222222-2222-2222-2222-222222222222';
  ro_uid UUID;
  ro_num INT;
  ro_email TEXT;
  ro_username TEXT;
  ro_emp_no TEXT;
  ro_name TEXT;
  hashed_pwd_admin TEXT;
  hashed_pwd_subadmin TEXT;
  hashed_pwd_ro TEXT;
  
  route_cursor UUID[];
  allocations_names TEXT[] := ARRAY['BOC B1', 'NDB B1', 'SAMPATH B1', 'Dialog', 'Etisalat'];
  allocations_codes TEXT[] := ARRAY['BOC-001', 'NDB-402', 'SAMP-99', 'DIA-L1', 'ETI-COL'];
  
  day_offset INT;
  target_date DATE;
  rand_val FLOAT;
  selected_route UUID;
  check_in TIMESTAMP WITH TIME ZONE;
  check_out TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Gather created route IDs
  SELECT ARRAY(SELECT id FROM public.routes) INTO route_cursor;

  -- Generate Bcrypt Hashes (Cost Factor 10)
  hashed_pwd_admin := extensions.crypt('PazzyAdmin123', extensions.gen_salt('bf', 10));
  hashed_pwd_subadmin := extensions.crypt('PazzySubAdmin123', extensions.gen_salt('bf', 10));
  hashed_pwd_ro := extensions.crypt('PazzyRO123', extensions.gen_salt('bf', 10));

  -- Insert Admin in auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (
    admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'admin@ro-tracking.com', hashed_pwd_admin, now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Pasindu Admin","role":"Admin","active":true}', 
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    admin_uid, admin_uid, admin_uid::TEXT,
    jsonb_build_object('sub', admin_uid::TEXT, 'email', 'admin@ro-tracking.com', 'email_verified', true),
    'email', now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  -- Insert Sub Admin in auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (
    subadmin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'subadmin@ro-tracking.com', hashed_pwd_subadmin, now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Monitoring SubAdmin","role":"Sub Admin","active":true}', 
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    subadmin_uid, subadmin_uid, subadmin_uid::TEXT,
    jsonb_build_object('sub', subadmin_uid::TEXT, 'email', 'subadmin@ro-tracking.com', 'email_verified', true),
    'email', now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  -- Insert 30 dummy Recovery Officers
  FOR ro_num IN 1..30 LOOP
    -- UUID format: c3333333-3333-3333-3333-xxxxxxxxxxxx
    ro_uid := ('c3333333-3333-3333-3333-' || to_char(ro_num, 'FM000000000000'))::UUID;
    ro_username := 'ro' || to_char(ro_num, 'FM000');
    ro_email := ro_username || '@ro-tracking.com';
    ro_emp_no := 'RO' || to_char(ro_num, 'FM000');
    ro_name := 'Recovery Officer ' || to_char(ro_num, 'FM000');

    -- Insert in auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (
      ro_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
      ro_email, hashed_pwd_ro, now(), 
      '{"provider":"email","providers":["email"]}', 
      json_build_object('name', ro_name, 'employee_no', ro_emp_no, 'phone', '0771234' || to_char(ro_num, 'FM00'), 'role', 'Recovery Officer', 'active', true), 
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      ro_uid, ro_uid, ro_uid::TEXT,
      jsonb_build_object('sub', ro_uid::TEXT, 'email', ro_email, 'email_verified', true),
      'email', now(), now(), now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    -- Assign 1-2 random allocations to this RO
    INSERT INTO public.allocations (user_id, allocation_name, allocation_code)
    VALUES (ro_uid, allocations_names[1 + (ro_num % 5)], allocations_codes[1 + (ro_num % 5)]);
    
    IF ro_num % 3 = 0 THEN
      INSERT INTO public.allocations (user_id, allocation_name, allocation_code)
      VALUES (ro_uid, allocations_names[1 + ((ro_num + 2) % 5)], allocations_codes[1 + ((ro_num + 2) % 5)]);
    END IF;

    -- Generate attendance history for previous 5 days
    FOR day_offset IN 1..5 LOOP
      target_date := CURRENT_DATE - day_offset;
      rand_val := random();
      
      IF rand_val < 0.85 THEN
        -- Checked In & Worked
        selected_route := route_cursor[1 + floor(random() * array_length(route_cursor, 1))::INT];
        
        -- Check-in between 07:15 AM and 08:45 AM
        check_in := (target_date + '07:00:00'::TIME + (random() * 105 * '1 minute'::INTERVAL)) AT TIME ZONE 'Asia/Colombo';
        
        -- Check-out between 04:30 PM and 06:15 PM
        check_out := (target_date + '16:30:00'::TIME + (random() * 105 * '1 minute'::INTERVAL)) AT TIME ZONE 'Asia/Colombo';
        
        INSERT INTO public.attendance (user_id, work_date, is_working_today, check_in_time, check_out_time, route_id, remarks)
        VALUES (ro_uid, target_date, true, check_in, check_out, selected_route, 'Routine collections completed successfully.')
        ON CONFLICT (user_id, work_date) DO NOTHING;
        
      ELSIF rand_val < 0.95 THEN
        -- Absent
        INSERT INTO public.attendance (user_id, work_date, is_working_today, check_in_time, check_out_time, route_id, remarks)
        VALUES (ro_uid, target_date, false, NULL, NULL, NULL, 'Personal medical leave.')
        ON CONFLICT (user_id, work_date) DO NOTHING;
      END IF;
      -- Remaining 5%: No record (offline / did not check in)
    END LOOP;
    
  END LOOP;
END $$;
