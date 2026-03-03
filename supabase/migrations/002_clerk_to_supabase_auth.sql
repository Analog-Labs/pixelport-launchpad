-- Migration 002: Auth provider change — Clerk → Supabase Auth
-- Date: 2026-03-03
-- Reason: Founder switched to Supabase Auth (native Lovable integration, zero new vendors)
-- Impact: Renames clerk_org_id to supabase_user_id in tenants table

-- Rename column
ALTER TABLE tenants RENAME COLUMN clerk_org_id TO supabase_user_id;

-- Change type from TEXT to UUID (Supabase Auth user IDs are UUIDs)
ALTER TABLE tenants ALTER COLUMN supabase_user_id TYPE UUID USING supabase_user_id::uuid;

-- Rename index to match new column name
ALTER INDEX idx_tenants_clerk_org RENAME TO idx_tenants_supabase_user;

-- Update column comment
COMMENT ON COLUMN tenants.supabase_user_id IS 'Supabase Auth user ID (owner of this tenant)';

-- Update table comment to reflect auth change
COMMENT ON TABLE tenants IS 'Customer accounts. Auth via Supabase Auth (changed from Clerk 2026-03-03).';
