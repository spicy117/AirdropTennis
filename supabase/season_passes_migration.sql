-- Season Passes Migration
-- This migration creates the season_passes table and adds is_season_pass_booking to bookings

-- ============================================
-- 1. Create season_passes table
-- ============================================
CREATE TABLE IF NOT EXISTS season_passes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    term_start_date DATE NOT NULL,
    term_end_date DATE NOT NULL,
    fixed_clinic_id UUID REFERENCES availabilities(id) ON DELETE SET NULL,
    private_credits_per_week INTEGER NOT NULL DEFAULT 0,
    
    -- Additional useful fields
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
    total_private_credits INTEGER DEFAULT 0,  -- Total credits for the term (calculated from weeks * credits_per_week)
    used_private_credits INTEGER DEFAULT 0,   -- Track how many credits have been used
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    
    -- Ensure term_end_date is after term_start_date
    CONSTRAINT valid_term_dates CHECK (term_end_date > term_start_date)
);

-- ============================================
-- 2. Add is_season_pass_booking to bookings table
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'is_season_pass_booking'
    ) THEN
        ALTER TABLE bookings ADD COLUMN is_season_pass_booking BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add season_pass_id to bookings to link back to the pass
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'season_pass_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN season_pass_id UUID REFERENCES season_passes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 3. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_season_passes_user_id ON season_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_season_passes_status ON season_passes(status);
CREATE INDEX IF NOT EXISTS idx_season_passes_term_dates ON season_passes(term_start_date, term_end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_season_pass_id ON bookings(season_pass_id);
CREATE INDEX IF NOT EXISTS idx_bookings_is_season_pass ON bookings(is_season_pass_booking);

-- ============================================
-- 4. Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_season_passes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_season_passes_updated_at ON season_passes;
CREATE TRIGGER trigger_season_passes_updated_at
    BEFORE UPDATE ON season_passes
    FOR EACH ROW
    EXECUTE FUNCTION update_season_passes_updated_at();

-- ============================================
-- 5. Enable Row Level Security
-- ============================================
ALTER TABLE season_passes ENABLE ROW LEVEL SECURITY;

-- Users can view their own season passes
DROP POLICY IF EXISTS "Users can view own season passes" ON season_passes;
CREATE POLICY "Users can view own season passes" ON season_passes
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all season passes
DROP POLICY IF EXISTS "Admins can view all season passes" ON season_passes;
CREATE POLICY "Admins can view all season passes" ON season_passes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can insert season passes
DROP POLICY IF EXISTS "Admins can insert season passes" ON season_passes;
CREATE POLICY "Admins can insert season passes" ON season_passes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update season passes
DROP POLICY IF EXISTS "Admins can update season passes" ON season_passes;
CREATE POLICY "Admins can update season passes" ON season_passes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can delete season passes
DROP POLICY IF EXISTS "Admins can delete season passes" ON season_passes;
CREATE POLICY "Admins can delete season passes" ON season_passes
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 6. Helper function to calculate total credits
-- ============================================
CREATE OR REPLACE FUNCTION calculate_season_pass_total_credits()
RETURNS TRIGGER AS $$
DECLARE
    weeks_in_term INTEGER;
BEGIN
    -- Calculate number of weeks in the term
    weeks_in_term := CEIL(EXTRACT(EPOCH FROM (NEW.term_end_date - NEW.term_start_date)) / (7 * 24 * 60 * 60));
    
    -- Set total credits based on weeks and credits per week
    NEW.total_private_credits := weeks_in_term * NEW.private_credits_per_week;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_total_credits ON season_passes;
CREATE TRIGGER trigger_calculate_total_credits
    BEFORE INSERT OR UPDATE OF term_start_date, term_end_date, private_credits_per_week ON season_passes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_season_pass_total_credits();

-- ============================================
-- Done! 
-- ============================================
-- To run this migration:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file and click "Run"
