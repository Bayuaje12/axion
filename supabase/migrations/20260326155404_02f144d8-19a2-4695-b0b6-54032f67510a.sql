-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create profiles table (custom auth with username/password)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create tracking_logs table
CREATE TABLE public.tracking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_id TEXT,
  latitude FLOAT,
  longitude FLOAT,
  accuracy FLOAT,
  speed FLOAT DEFAULT 0,
  battery_level INT,
  is_charging BOOLEAN,
  ip_address TEXT,
  isp_provider TEXT,
  device_info JSONB,
  photo_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create connection_links table for tracking link generation
CREATE TABLE public.connection_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_token TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_links ENABLE ROW LEVEL SECURITY;

-- RLS policies (custom auth - no auth.uid(), access control in app layer)
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete profiles" ON public.profiles FOR DELETE USING (true);

CREATE POLICY "Allow public insert tracking_logs" ON public.tracking_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select tracking_logs" ON public.tracking_logs FOR SELECT USING (true);
CREATE POLICY "Allow public delete tracking_logs" ON public.tracking_logs FOR DELETE USING (true);

CREATE POLICY "Allow public insert connection_links" ON public.connection_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select connection_links" ON public.connection_links FOR SELECT USING (true);
CREATE POLICY "Allow public update connection_links" ON public.connection_links FOR UPDATE USING (true);

-- 4. Create storage bucket for verification photos
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-photos', 'verification-photos', true);

CREATE POLICY "Allow public upload verification photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'verification-photos');
CREATE POLICY "Allow public read verification photos" ON storage.objects FOR SELECT USING (bucket_id = 'verification-photos');
CREATE POLICY "Allow public delete verification photos" ON storage.objects FOR DELETE USING (bucket_id = 'verification-photos');

-- 5. Insert default owner account (password: admin123)
INSERT INTO public.profiles (username, password, role) VALUES ('admin', 'admin123', 'owner');

-- 6. Enable realtime for tracking_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_logs;