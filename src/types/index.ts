// Core types for HR Research Platform

export interface ContentItem {
  id: string;
  source: string;
  source_url: string;
  title: string;
  url: string;
  content_hash: string;
  snippet?: string;
  full_content?: string;
  author?: string;
  published_at?: Date;
  collected_at: Date;
  categories: string[];
  language: string;
  
  // Scores
  domain_authority: number;
  indian_context_score: number;
  freshness_score: number;
  extractability_score: number;
  composite_score: number;
  
  // Extracted data
  has_statistics: boolean;
  has_dates: boolean;
  has_numbers: boolean;
  word_count: number;
  
  // Metadata
  scraper_version: string;
  processing_notes?: string;
}

export interface Report {
  id: string;
  topic: string;
  topic_hash: string;
  title: string;
  content: string;
  executive_summary?: string;
  methodology?: string;
  pdf_path?: string;
  html_content?: string;
  confidence_score?: number;
  source_count: number;
  citation_count: number;
  word_count: number;
  created_at: Date;
  generation_time_ms?: number;
  source_ids: string[];
}

export interface Citation {
  id: string;
  report_id: string;
  content_item_id: string;
  citation_number: number;
  quoted_text?: string;
  context?: string;
  created_at: Date;
}

export interface CollectionStats {
  id: string;
  date: Date;
  source: string;
  items_collected: number;
  items_processed: number;
  avg_quality_score?: number;
  errors_count: number;
  collection_time_ms?: number;
}

// Raw data from scrapers/RSS
export interface RawContentItem {
  title: string;
  url: string;
  content?: string;
  snippet?: string;
  full_content?: string;
  author?: string;
  published_at?: Date;
  categories?: string[];
}

// Scoring components
export interface ScoringComponents {
  domain_authority: number;
  indian_context: number;
  freshness: number;
  extractability: number;
}

// API response types
export interface GenerateReportRequest {
  topic: string;
  max_sources?: number;
  time_range_days?: number;
}

export interface GenerateReportResponse {
  report_id: string;
  status: 'generating' | 'completed' | 'failed';
  pdf_url?: string;
  message?: string;
}