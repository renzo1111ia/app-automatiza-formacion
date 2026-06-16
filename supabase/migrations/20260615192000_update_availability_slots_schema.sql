-- Align availability_slots schema with Orchestrator v3.0 specs (weekly recurring slots)
-- Drop existing table
DROP TABLE IF EXISTS public.availability_slots CASCADE;

-- Recreate with proper fields
CREATE TABLE public.availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 30
);

-- Grants
GRANT ALL ON TABLE public.availability_slots TO postgres;
GRANT ALL ON TABLE public.availability_slots TO service_role;
GRANT ALL ON TABLE public.availability_slots TO authenticated;
GRANT ALL ON TABLE public.availability_slots TO anon;

-- RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_advisor_day ON public.availability_slots(advisor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_tenant_day ON public.availability_slots(tenant_id, day_of_week);

-- Service role policy
CREATE POLICY "service_role_all_slots" ON public.availability_slots FOR ALL USING (true);

-- Authenticated policy
CREATE POLICY "authenticated_read_availability_slots" ON public.availability_slots
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()) OR
    advisor_id IN (
      SELECT a.id FROM public.advisors a
      WHERE a.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
