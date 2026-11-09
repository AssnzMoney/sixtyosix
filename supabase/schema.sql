-- ==============================================================================
-- SIXTYSIX PLATFORM - ESQUEMA DO BANCO DE DADOS SUPABASE
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

-- 1. Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT DEFAULT 'email',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Tabela de Chaves de API (API Keys)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Chave Padrão',
  key_prefix TEXT NOT NULL, -- Ex: sk-live-66-xxxx
  key_hash TEXT NOT NULL,   -- Hash SHA-256 da chave completa para validação no Gateway
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam apenas suas próprias chaves"
  ON public.api_keys FOR ALL
  USING (auth.uid() = user_id);

-- 3. Tabela de Métricas e Consumo (Usage Logs)
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  model TEXT NOT NULL, -- claude-fable-5.1, gpt-astra-6, glm-4-plus
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  latency_ms INT DEFAULT 0,
  cost_pix NUMERIC(10, 4) DEFAULT 0,
  savings_brl NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem consultar suas próprias métricas"
  ON public.usage_metrics FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Tabela de Assinaturas e Recargas Pix
CREATE TABLE IF NOT EXISTS public.pix_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL,
  amount_brl NUMERIC(10, 2) NOT NULL,
  pix_code TEXT,
  qr_code_url TEXT,
  status TEXT DEFAULT 'pending' NOT NULL, -- pending, paid, expired
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pix_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários visualizam suas próprias transações Pix"
  ON public.pix_transactions FOR SELECT
  USING (auth.uid() = user_id);
