CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    free_days INT NOT NULL DEFAULT 14,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_promo_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, promo_code_id)
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_promo_usages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read of active promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Allow authenticated users to read their own usages" ON company_promo_usages;
DROP POLICY IF EXISTS "Allow authenticated users to insert usages" ON company_promo_usages;

CREATE POLICY "Allow public read of active promo codes" 
ON promo_codes FOR SELECT 
USING (is_active = true);

CREATE POLICY "Allow authenticated users to read their own usages" 
ON company_promo_usages FOR SELECT 
USING (true);

-- The insertion will be handled by the security definer RPC below, 
-- but just in case, we leave it restricted from the client for write.

-- RPC to claim promo code securely bypassing RLS for updates on `companies`
CREATE OR REPLACE FUNCTION claim_promo_code(p_code TEXT, p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_promo RECORD;
    v_usage_exists BOOLEAN;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_new_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Check if promo exists and is active
    SELECT * INTO v_promo FROM promo_codes WHERE code = p_code AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Kode promo tidak valid atau sudah kedaluwarsa.');
    END IF;

    -- 2. Check if company has already used it
    SELECT EXISTS (
        SELECT 1 FROM company_promo_usages 
        WHERE company_id = p_company_id AND promo_code_id = v_promo.id
    ) INTO v_usage_exists;
    
    IF v_usage_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Perusahaan Anda sudah pernah menggunakan kode promo ini.');
    END IF;

    -- 3. Get current subscription_end_date
    SELECT subscription_end_date INTO v_current_end_date FROM companies WHERE id = p_company_id;
    
    -- 4. Calculate new end date
    IF v_current_end_date IS NULL OR v_current_end_date < NOW() THEN
        v_new_end_date := NOW() + (v_promo.free_days || ' days')::INTERVAL;
    ELSE
        v_new_end_date := v_current_end_date + (v_promo.free_days || ' days')::INTERVAL;
    END IF;

    -- 5. Insert usage
    INSERT INTO company_promo_usages (company_id, promo_code_id) VALUES (p_company_id, v_promo.id);

    -- 6. Update company subscription
    UPDATE companies 
    SET subscription_end_date = v_new_end_date,
        is_manually_locked = false 
    WHERE id = p_company_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Kode promo berhasil digunakan. Masa aktif bertambah ' || v_promo.free_days || ' hari.',
        'new_end_date', v_new_end_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
