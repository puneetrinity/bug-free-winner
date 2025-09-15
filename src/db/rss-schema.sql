-- RSS Feed Content Storage
-- Optimized for efficient storage and retrieval

-- RSS articles table (separate from content_items for optimization)
CREATE TABLE IF NOT EXISTS rss_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- RSS Source info
  feed_name TEXT NOT NULL,
  feed_group TEXT NOT NULL,  -- 'et_hr', 'indian_express', 'toi', 'google_news', etc.
  feed_category TEXT NOT NULL, -- 'general', 'technology', 'recruitment', etc.
  
  -- Article content
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  image_url TEXT, -- RSS feed images
  content_hash TEXT UNIQUE NOT NULL, -- For deduplication
  
  -- Metadata
  author TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  guid TEXT,
  
  -- Categories from RSS
  categories TEXT[] DEFAULT '{}',
  
  -- Indexing for fast retrieval
  CONSTRAINT unique_article_url UNIQUE (url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rss_articles_published_at ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_group ON rss_articles(feed_group);
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_category ON rss_articles(feed_category);
CREATE INDEX IF NOT EXISTS idx_rss_articles_collected_at ON rss_articles(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_content_hash ON rss_articles(content_hash);

-- Full text search on RSS articles
CREATE INDEX IF NOT EXISTS idx_rss_articles_search 
ON rss_articles 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- RSS collection stats
CREATE TABLE IF NOT EXISTS rss_collection_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_date DATE NOT NULL,
  feed_name TEXT NOT NULL,
  articles_collected INT DEFAULT 0,
  articles_new INT DEFAULT 0,
  articles_duplicate INT DEFAULT 0,
  collection_time_ms INT,
  errors TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_collection_per_day UNIQUE (collection_date, feed_name)
);

-- Citations table migration for RSS article support
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