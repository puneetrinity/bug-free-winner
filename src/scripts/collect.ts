#!/usr/bin/env node

import { ContentScorer } from '../scoring/content-scorer';
import { BraveScrapingBeeCollector } from '../collectors/brave-scrapingbee-collector';
import db from '../db/connection';
import { RawContentItem } from '../types';

interface CollectionResult {
  source: string;
  collected: number;
  processed: number;
  errors: number;
  avgScore: number;
  duration: number;
}

class ContentCollector {
  private scorer: ContentScorer;
  private braveCollector: BraveScrapingBeeCollector | null = null;

  constructor() {
    const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;
    const braveKey = process.env.BRAVE_API_KEY;
    
    this.scorer = new ContentScorer();
    
    // Initialize Brave + ScrapingBee collector if both APIs available
    if (braveKey && scrapingBeeKey) {
      this.braveCollector = new BraveScrapingBeeCollector(braveKey, scrapingBeeKey);
      console.log('🐝🔍 Brave Search + ScrapingBee collector initialized');
    } else {
      console.log('⚠️ Brave Search or ScrapingBee API key missing - collection disabled');
      throw new Error('Required API keys missing');
    }
  }

  async collectAll(): Promise<CollectionResult[]> {
    console.log('🚀 Starting content collection with Brave Search + ScrapingBee...\n');
    const results: CollectionResult[] = [];

    // Collect from Brave Search + ScrapingBee
    if (this.braveCollector) {
      results.push(await this.collectFromBraveSearch());
    }

    console.log('\n📊 Collection Summary:');
    console.log('='.repeat(60));
    
    let totalCollected = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    
    results.forEach(result => {
      console.log(`${result.source.padEnd(15)} | Collected: ${result.collected.toString().padStart(3)} | Processed: ${result.processed.toString().padStart(3)} | Avg Score: ${result.avgScore.toFixed(3)} | Duration: ${result.duration}ms`);
      totalCollected += result.collected;
      totalProcessed += result.processed;
      totalErrors += result.errors;
      totalDuration += result.duration;
    });
    
    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(15)} | Collected: ${totalCollected.toString().padStart(3)} | Processed: ${totalProcessed.toString().padStart(3)} | Errors: ${totalErrors.toString().padStart(3)} | Duration: ${totalDuration}ms`);
    
    // Update collection stats
    for (const result of results) {
      await db.updateCollectionStats({
        date: new Date(),
        source: result.source.toLowerCase(),
        items_collected: result.collected,
        items_processed: result.processed,
        avg_quality_score: result.avgScore,
        errors_count: result.errors,
        collection_time_ms: result.duration
      });
    }

    console.log('\n✅ Collection completed and stats updated!');
    return results;
  }


  private async processAndStore(rawItems: RawContentItem[], source: string): Promise<{processed: number, avgScore: number}> {
    if (rawItems.length === 0) {
      console.log(`ℹ️  No items to process from ${source}`);
      return { processed: 0, avgScore: 0 };
    }

    console.log(`🔄 Processing ${rawItems.length} items from ${source}...`);
    
    const scoredItems = this.scorer.scoreMultipleItems(rawItems, source);
    let processed = 0;
    let totalScore = 0;

    for (const item of scoredItems) {
      try {
        await db.insertContentItem(item);
        processed++;
        totalScore += item.composite_score;
        
        if (processed % 5 === 0) {
          console.log(`  📝 Processed ${processed}/${scoredItems.length} items...`);
        }
      } catch (error) {
        console.error(`❌ Failed to insert item "${item.title.substring(0, 50)}...":`, error instanceof Error ? error.message : error);
      }
    }

    const avgScore = processed > 0 ? totalScore / processed : 0;
    console.log(`✅ ${source}: Successfully processed ${processed}/${rawItems.length} items (avg score: ${avgScore.toFixed(3)})`);
    
    return { processed, avgScore };
  }

  private async collectFromBraveSearch(): Promise<CollectionResult> {
    const startTime = Date.now();
    console.log('🔍🐝 Collecting from Brave Search + ScrapingBee...');
    
    let rawItems: RawContentItem[] = [];
    let errors = 0;

    if (!this.braveCollector) {
      return {
        source: 'BraveSearch',
        collected: 0,
        processed: 0,
        errors: 1,
        avgScore: 0,
        duration: Date.now() - startTime
      };
    }

    try {
      // Comprehensive HR search queries
      const searchQueries = [
        'workplace policy updates India 2024',
        'Indian labour laws changes',
        'employee attrition trends India',
        'HR technology trends India',
        'remote work policies Indian companies',
        'employee retention strategies India',
        'workplace culture India',
        'recruitment trends India 2024'
      ];
      
      console.log(`🎯 Running ${searchQueries.length} search queries...`);
      
      rawItems = await this.braveCollector.collectHRContent(searchQueries, 4); // 4 results per query
      console.log(`✅ Brave Search collected ${rawItems.length} articles`);
      
    } catch (error: any) {
      console.error('❌ Brave Search collection failed:', error.message);
      errors++;
    }

    const { processed, avgScore } = await this.processAndStore(rawItems, 'brave_search');
    const duration = Date.now() - startTime;

    return {
      source: 'BraveSearch',
      collected: rawItems.length,
      processed,
      errors,
      avgScore,
      duration
    };
  }

  async getRecentStats(days = 7): Promise<void> {
    console.log(`\n📈 Collection Stats (Last ${days} days):`);
    console.log('='.repeat(70));
    
    const stats = await db.getCollectionStats(days);
    
    if (stats.length === 0) {
      console.log('No collection data found for the specified period.');
      return;
    }

    stats.forEach(stat => {
      const date = stat.date.toISOString().split('T')[0];
      console.log(`${date} | ${stat.source.padEnd(12)} | Items: ${stat.items_processed.toString().padStart(3)} | Score: ${(stat.avg_quality_score || 0).toFixed(3)} | Time: ${stat.collection_time_ms}ms`);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const collector = new ContentCollector();

  try {
    if (args.includes('--stats')) {
      const days = parseInt(args[args.indexOf('--stats') + 1]) || 7;
      await collector.getRecentStats(days);
    } else {
      await collector.collectAll();
      
      if (args.includes('--show-stats')) {
        await collector.getRecentStats(3);
      }
    }
  } catch (error) {
    console.error('💥 Collection failed:', error);
    process.exit(1);
  } finally {
    await db.close();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ContentCollector };