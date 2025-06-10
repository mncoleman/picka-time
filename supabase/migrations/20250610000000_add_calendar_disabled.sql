-- Add is_disabled column to calendars table
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
