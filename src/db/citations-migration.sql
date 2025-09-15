-- Citations table migration for RSS article support
-- This can be run through the existing RSS migration endpoint

-- Add new columns if they don't exist
ALTER TABLE citations ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'content_item';
ALTER TABLE citations ADD COLUMN IF NOT EXISTS source_id UUID;

-- Populate new columns with existing data
UPDATE citations SET 
  source_type = 'content_item',
  source_id = content_item_id
WHERE source_id IS NULL;

-- Drop foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'citations_content_item_id_fkey') THEN
        ALTER TABLE citations DROP CONSTRAINT citations_content_item_id_fkey;
    END IF;
END $$;

-- Make content_item_id nullable
ALTER TABLE citations ALTER COLUMN content_item_id DROP NOT NULL;

-- Add check constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'citations_source_check') THEN
        ALTER TABLE citations ADD CONSTRAINT citations_source_check 
        CHECK (
          (source_type = 'content_item' AND content_item_id IS NOT NULL AND source_id = content_item_id) OR
          (source_type = 'rss_article' AND content_item_id IS NULL AND source_id IS NOT NULL)
        );
    END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_type, source_id);