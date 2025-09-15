-- Migration: Add image_url column to rss_articles table
-- Run this on production database to fix the missing column error

-- Check if the column already exists first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rss_articles' 
        AND column_name = 'image_url'
    ) THEN
        -- Add the image_url column
        ALTER TABLE rss_articles ADD COLUMN image_url TEXT;
        
        -- Create index for image queries (optional but recommended)
        CREATE INDEX IF NOT EXISTS idx_rss_articles_with_images 
        ON rss_articles(image_url) 
        WHERE image_url IS NOT NULL;
        
        RAISE NOTICE 'Added image_url column to rss_articles table';
    ELSE
        RAISE NOTICE 'Column image_url already exists in rss_articles table';
    END IF;
END $$;