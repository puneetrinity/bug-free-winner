-- Fix citations table to handle both content_items and rss_articles
-- This migration updates the foreign key constraint to be more flexible

BEGIN;

-- Step 1: Add new columns for flexible referencing
ALTER TABLE citations ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'content_item';
ALTER TABLE citations ADD COLUMN IF NOT EXISTS source_id UUID;

-- Step 2: Populate the new columns with existing data
UPDATE citations SET 
  source_type = 'content_item',
  source_id = content_item_id
WHERE source_id IS NULL;

-- Step 3: Drop the old foreign key constraint
ALTER TABLE citations DROP CONSTRAINT IF EXISTS citations_content_item_id_fkey;

-- Step 4: Make content_item_id nullable (for RSS articles)
ALTER TABLE citations ALTER COLUMN content_item_id DROP NOT NULL;

-- Step 5: Add a check constraint to ensure proper referencing
ALTER TABLE citations ADD CONSTRAINT citations_source_check 
CHECK (
  (source_type = 'content_item' AND content_item_id IS NOT NULL AND source_id = content_item_id) OR
  (source_type = 'rss_article' AND content_item_id IS NULL AND source_id IS NOT NULL)
);

-- Step 6: Add index on new columns for performance
CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_type, source_id);

COMMIT;

-- Verification query - uncomment to test
-- SELECT source_type, COUNT(*) FROM citations GROUP BY source_type;