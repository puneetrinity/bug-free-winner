import { Pool, PoolClient } from 'pg';
import { ContentItem, Report, Citation, CollectionStats } from '../types';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 60000, // Increased to 60 seconds for Railway
      ssl: process.env.DATABASE_URL?.includes('railway') ? {
        rejectUnauthorized: false
      } : undefined,
    });
    
    // Add pool error handling
    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
    
    this.pool.on('connect', (client) => {
      console.log('New PostgreSQL connection established');
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.pool.query(text, params);
        const duration = Date.now() - start;
        if (attempt > 1) {
          console.log(`Query executed on attempt ${attempt}`, { text: text.substring(0, 100), duration, rows: res.rowCount });
        }
        return res;
      } catch (error: any) {
        lastError = error;
        console.error(`Database query error (attempt ${attempt}/${maxRetries})`, { 
          text: text.substring(0, 100), 
          error: error.message,
          code: error.code 
        });
        
        // If it's a connection error, wait and retry
        if (attempt < maxRetries && (
          error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('Connection terminated') ||
          error.message?.includes('connection timeout')
        )) {
          const waitTime = attempt * 2000; // Progressive backoff: 2s, 4s
          console.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // For other errors or final attempt, throw immediately
        break;
      }
    }
    
    console.error('Database query failed after all retries', { text: text.substring(0, 100), error: lastError });
    throw lastError;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Content Items
  async insertContentItem(item: Omit<ContentItem, 'id' | 'collected_at'>): Promise<ContentItem> {
    const query = `
      INSERT INTO content_items (
        source, source_url, title, url, content_hash, snippet, full_content, author, 
        published_at, categories, language, domain_authority, indian_context_score,
        freshness_score, extractability_score, composite_score, has_statistics,
        has_dates, has_numbers, word_count, scraper_version, processing_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) 
      ON CONFLICT (url) DO UPDATE SET 
        full_content = EXCLUDED.full_content,
        composite_score = EXCLUDED.composite_score,
        collected_at = now()
      RETURNING *
    `;
    
    const values = [
      item.source, item.source_url, item.title, item.url, item.content_hash,
      item.snippet, item.full_content, item.author, item.published_at,
      item.categories, item.language, item.domain_authority, item.indian_context_score,
      item.freshness_score, item.extractability_score, item.composite_score,
      item.has_statistics, item.has_dates, item.has_numbers, item.word_count,
      item.scraper_version, item.processing_notes
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getContentItems(options: {
    source?: string;
    limit?: number;
    min_score?: number;
    categories?: string[];
    since_days?: number;
  } = {}): Promise<ContentItem[]> {
    let query = `
      SELECT * FROM content_items 
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramCount = 0;

    if (options.source) {
      query += ` AND source = $${++paramCount}`;
      values.push(options.source);
    }

    if (options.min_score) {
      query += ` AND composite_score >= $${++paramCount}`;
      values.push(options.min_score);
    }

    if (options.categories && options.categories.length > 0) {
      query += ` AND categories && $${++paramCount}`;
      values.push(options.categories);
    }

    if (options.since_days) {
      query += ` AND published_at >= NOW() - INTERVAL '${options.since_days} days'`;
    }

    query += ' ORDER BY composite_score DESC';

    if (options.limit) {
      query += ` LIMIT $${++paramCount}`;
      values.push(options.limit);
    }

    const result = await this.query(query, values);
    return result.rows;
  }

  async searchContentItems(topic: string, limit = 20): Promise<ContentItem[]> {
    const query = `
      SELECT *, 
        ts_rank(to_tsvector('english', title || ' ' || COALESCE(snippet, '')), plainto_tsquery('english', $1)) as relevance
      FROM content_items 
      WHERE to_tsvector('english', title || ' ' || COALESCE(snippet, '')) @@ plainto_tsquery('english', $1)
        OR title ILIKE '%' || $1 || '%'
        OR snippet ILIKE '%' || $1 || '%'
      ORDER BY relevance DESC, composite_score DESC
      LIMIT $2
    `;
    
    const result = await this.query(query, [topic, limit]);
    return result.rows;
  }

  // Reports
  async insertReport(report: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
    const query = `
      INSERT INTO reports (
        topic, topic_hash, title, content, executive_summary, methodology,
        pdf_path, html_content, confidence_score, source_count, citation_count,
        word_count, generation_time_ms, source_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      report.topic, report.topic_hash, report.title, report.content,
      report.executive_summary, report.methodology, report.pdf_path,
      report.html_content, report.confidence_score, report.source_count,
      report.citation_count, report.word_count, report.generation_time_ms,
      report.source_ids
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getReport(id: string): Promise<Report | null> {
    const result = await this.query('SELECT * FROM reports WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Citations
  async insertCitations(citations: Omit<Citation, 'id' | 'created_at'>[]): Promise<Citation[]> {
    if (citations.length === 0) return [];
    
    const values = citations.map((c, i) => 
      `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
    ).join(', ');
    
    const query = `
      INSERT INTO citations (report_id, content_item_id, citation_number, quoted_text, context)
      VALUES ${values}
      RETURNING *
    `;
    
    const flatValues = citations.flatMap(c => [
      c.report_id, c.content_item_id, c.citation_number, c.quoted_text, c.context
    ]);
    
    const result = await this.query(query, flatValues);
    return result.rows;
  }

  // Statistics
  async updateCollectionStats(stats: Omit<CollectionStats, 'id'>): Promise<void> {
    const query = `
      INSERT INTO collection_stats (
        date, source, items_collected, items_processed, avg_quality_score,
        errors_count, collection_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (date, source) DO UPDATE SET
        items_collected = EXCLUDED.items_collected,
        items_processed = EXCLUDED.items_processed,
        avg_quality_score = EXCLUDED.avg_quality_score,
        errors_count = EXCLUDED.errors_count,
        collection_time_ms = EXCLUDED.collection_time_ms
    `;
    
    await this.query(query, [
      stats.date, stats.source, stats.items_collected, stats.items_processed,
      stats.avg_quality_score, stats.errors_count, stats.collection_time_ms
    ]);
  }

  async getCollectionStats(days = 7): Promise<CollectionStats[]> {
    const query = `
      SELECT * FROM collection_stats 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC, source
    `;
    
    const result = await this.query(query);
    return result.rows;
  }
}

// Singleton instance
const db = new Database();
export default db;