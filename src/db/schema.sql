-- HR Research Platform Database Schema
-- Phase 1 MVP: Minimal but complete

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Content items from all sources
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source info
  source TEXT NOT NULL,              -- 'pib', 'peoplematters', 'hrkatha'
  source_url TEXT NOT NULL,          -- Original source URL
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,           -- Actual article URL
  content_hash TEXT UNIQUE NOT NULL, -- For deduplication
  
  -- Content
  snippet TEXT,                      -- First 300 chars
  full_content TEXT,                 -- Complete article text
  author TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now(),
  
  -- Classification
  categories TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'en',
  
  -- Quality scores (0.0 to 1.0)
  domain_authority NUMERIC(3,2) DEFAULT 0.5,
  indian_context_score NUMERIC(3,2) DEFAULT 0.0,
  freshness_score NUMERIC(3,2) DEFAULT 1.0,
  extractability_score NUMERIC(3,2) DEFAULT 0.3,
  composite_score NUMERIC(3,2) DEFAULT 0.5,
  
  -- Extracted data
  has_statistics BOOLEAN DEFAULT false,
  has_dates BOOLEAN DEFAULT false,
  has_numbers BOOLEAN DEFAULT false,
  word_count INT DEFAULT 0,
  
  -- Metadata
  scraper_version TEXT DEFAULT '1.0',
  processing_notes TEXT
);

-- Reports generated from content
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Input
  topic TEXT NOT NULL,
  topic_hash TEXT NOT NULL,           -- For caching similar topics
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,              -- Full report content
  executive_summary TEXT,
  methodology TEXT,
  
  -- Output files
  pdf_path TEXT,
  html_content TEXT,
  
  -- Quality metrics
  confidence_score NUMERIC(3,2),
  source_count INT DEFAULT 0,
  citation_count INT DEFAULT 0,
  word_count INT DEFAULT 0,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  generation_time_ms INT,
  
  -- Content sources used
  source_ids UUID[] DEFAULT '{}'
);

-- Citations linking reports to sources
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  citation_number INT NOT NULL,
  quoted_text TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collection statistics (for monitoring)
CREATE TABLE collection_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL,
  items_collected INT DEFAULT 0,
  items_processed INT DEFAULT 0,
  avg_quality_score NUMERIC(3,2),
  errors_count INT DEFAULT 0,
  collection_time_ms INT,
  
  UNIQUE(date, source)
);

-- Indexes for performance
CREATE INDEX idx_content_items_source ON content_items(source);
CREATE INDEX idx_content_items_published ON content_items(published_at DESC);
CREATE INDEX idx_content_items_score ON content_items(composite_score DESC);
CREATE INDEX idx_content_items_categories ON content_items USING GIN(categories);
CREATE INDEX idx_reports_topic ON reports(topic);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
CREATE INDEX idx_citations_report ON citations(report_id);