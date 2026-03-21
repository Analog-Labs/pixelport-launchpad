-- T2: Add Paperclip proxy columns to tenants table
-- paperclip_company_id: Paperclip company UUID discovered during provisioning
-- paperclip_api_key: Bearer token the proxy uses when forwarding to Paperclip

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS paperclip_company_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS paperclip_api_key TEXT;
