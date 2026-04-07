-- Add campaign_type and total_budget for prize pool campaigns
ALTER TABLE campaigns ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE campaigns ADD COLUMN total_budget NUMERIC;

-- Backfill existing campaigns as standard
UPDATE campaigns SET campaign_type = 'standard' WHERE campaign_type IS NULL;
