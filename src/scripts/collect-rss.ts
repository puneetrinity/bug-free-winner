#!/usr/bin/env node

import { RSSCollector } from '../collectors/rss-collector';
import { ContentScorer } from '../scoring/content-scorer';
import db from '../db/connection';
import { getHourlyFeeds } from '../config/rss-sources';
import crypto from 'crypto';

class RSSCollectionManager {
  private collector: RSSCollector;
  private scorer: ContentScorer;

  constructor() {
    this.collector = new RSSCollector();
    this.scorer = new ContentScorer();
  }

  async runDailyCollection(): Promise<void> {
    console.log('🌅 Starting daily RSS collection...');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    const collectionDate = new Date().toISOString().split('T')[0];
    
    try {
      // Collect from all RSS feeds
      const { articles, stats } = await this.collector.collectFromAllFeeds();
      
      // Store articles in database
      const storageStats = await this.storeRSSArticles(articles);
      
      // Save collection statistics
      for (const [feedName, count] of Object.entries(stats)) {
        await this.saveCollectionStats({
          collection_date: collectionDate,
          feed_name: feedName,
          articles_collected: count,
          articles_new: storageStats.new,
          articles_duplicate: storageStats.duplicates,
          collection_time_ms: Date.now() - startTime
        });
      }
      
      const duration = Date.now() - startTime;
      console.log('='.repeat(60));
      console.log(`✅ Daily collection completed in ${duration}ms`);
      console.log(`📊 Summary: ${articles.length} collected, ${storageStats.new} new, ${storageStats.duplicates} duplicates`);
      
    } catch (error) {
      console.error('❌ Daily collection failed:', error);
      
      // Save error in stats
      await this.saveCollectionStats({
        collection_date: collectionDate,
        feed_name: 'ALL',
        articles_collected: 0,
        articles_new: 0,
        articles_duplicate: 0,
        collection_time_ms: Date.now() - startTime,
        errors: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async runHourlyCollection(): Promise<void> {
    console.log('⏰ Starting hourly RSS collection...');
    
    const hourlyFeeds = getHourlyFeeds();
    const collector = new RSSCollector(hourlyFeeds);
    
    const { articles } = await collector.collectFromAllFeeds();
    const storageStats = await this.storeRSSArticles(articles);
    
    console.log(`✅ Hourly collection: ${storageStats.new} new articles from ${hourlyFeeds.length} feeds`);
  }

  private async storeRSSArticles(articles: any[]): Promise<{ new: number, duplicates: number, errors: number }> {
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    for (const article of articles) {
      try {
        // Generate content hash for deduplication
        const contentHash = crypto.createHash('md5').update(article.url || article.title).digest('hex');
        
        // Check if article already exists
        const existing = await db.query(
          'SELECT id FROM rss_articles WHERE content_hash = $1',
          [contentHash]
        );
        
        if (existing.rows.length > 0) {
          duplicateCount++;
          continue;
        }
        
        // Extract metadata if available
        const metadata = (article as any).metadata || {};
        
        // Insert new article
        await db.query(`
          INSERT INTO rss_articles (
            feed_name, feed_group, feed_category,
            title, url, description, content_hash,
            author, published_at, guid, categories
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          metadata.source_name || 'Unknown',
          metadata.source_group || 'unknown',
          metadata.rss_category || 'general',
          article.title,
          article.url,
          article.snippet || article.full_content?.substring(0, 500),
          contentHash,
          article.author,
          article.published_at,
          metadata.guid,
          article.categories || []
        ]);
        
        newCount++;
        
      } catch (error) {
        errorCount++;
        if (error instanceof Error && !error.message.includes('duplicate')) {
          console.error(`Failed to store article: ${article.title}`, error.message);
        }
      }
    }
    
    return { new: newCount, duplicates: duplicateCount, errors: errorCount };
  }

  private async saveCollectionStats(stats: any): Promise<void> {
    try {
      await db.query(`
        INSERT INTO rss_collection_stats (
          collection_date, feed_name, articles_collected, 
          articles_new, articles_duplicate, collection_time_ms, errors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (collection_date, feed_name) 
        DO UPDATE SET 
          articles_collected = EXCLUDED.articles_collected,
          articles_new = EXCLUDED.articles_new,
          articles_duplicate = EXCLUDED.articles_duplicate,
          collection_time_ms = EXCLUDED.collection_time_ms,
          errors = EXCLUDED.errors
      `, [
        stats.collection_date,
        stats.feed_name,
        stats.articles_collected,
        stats.articles_new,
        stats.articles_duplicate,
        stats.collection_time_ms,
        stats.errors
      ]);
    } catch (error) {
      console.error('Failed to save collection stats:', error);
    }
  }

  async getRecentArticles(limit = 20, category?: string): Promise<any[]> {
    let query = `
      SELECT * FROM rss_articles 
      ${category ? 'WHERE feed_category = $1' : ''}
      ORDER BY published_at DESC 
      LIMIT ${category ? '$2' : '$1'}
    `;
    
    const params = category ? [category, limit] : [limit];
    const result = await db.query(query, params);
    return result.rows;
  }

  async searchRSSArticles(searchTerm: string, limit = 20): Promise<any[]> {
    const query = `
      SELECT * FROM rss_articles 
      WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) 
        @@ plainto_tsquery('english', $1)
      ORDER BY published_at DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [searchTerm, limit]);
    return result.rows;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const manager = new RSSCollectionManager();
  
  try {
    // First ensure RSS tables exist
    console.log('📊 Ensuring RSS tables exist...');
    const fs = await import('fs');
    const path = await import('path');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'rss-schema.sql'), 
      'utf-8'
    );
    
    const statements = schemaSQL.split(';').filter((s: string) => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
      }
    }
    
    if (args.includes('--hourly')) {
      await manager.runHourlyCollection();
    } else if (args.includes('--search')) {
      const searchIndex = args.indexOf('--search');
      const searchTerm = args[searchIndex + 1];
      if (searchTerm) {
        const articles = await manager.searchRSSArticles(searchTerm);
        console.log(`Found ${articles.length} articles matching "${searchTerm}":`);
        articles.forEach(a => {
          console.log(`- ${a.title} (${a.feed_name})`);
        });
      }
    } else if (args.includes('--recent')) {
      const category = args[args.indexOf('--recent') + 1];
      const articles = await manager.getRecentArticles(20, category);
      console.log(`Recent articles ${category ? `in ${category}` : ''}:`);
      articles.forEach(a => {
        console.log(`- ${a.title} (${a.feed_name})`);
      });
    } else {
      // Default: run daily collection
      await manager.runDailyCollection();
    }
    
  } catch (error) {
    console.error('💥 RSS collection failed:', error);
    process.exit(1);
  } finally {
    await db.close();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { RSSCollectionManager };