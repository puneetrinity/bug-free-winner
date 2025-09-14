#!/usr/bin/env node

import { ReportGenerator } from '../reports/generator';
import db from '../db/connection';

interface GenerateOptions {
  topic: string;
  maxSources?: number;
  timeRangeDays?: number;
  interactive?: boolean;
}

class ReportCLI {
  private generator: ReportGenerator;

  constructor() {
    this.generator = new ReportGenerator();
  }

  async generateReport(options: GenerateOptions): Promise<void> {
    const startTime = Date.now();
    
    console.log('🎯 HR Research Platform - Report Generation');
    console.log('='.repeat(50));
    console.log(`📋 Topic: ${options.topic}`);
    console.log(`📊 Max Sources: ${options.maxSources || 15}`);
    console.log(`📅 Time Range: ${options.timeRangeDays || 30} days`);
    console.log('');

    try {
      // Check if we have content in the database
      const contentStats = await this.checkContentAvailability(options.timeRangeDays || 30);
      
      if (contentStats.totalItems === 0) {
        console.log('⚠️  No content found in database.');
        console.log('   Run "npm run collect" first to gather content from sources.');
        process.exit(1);
      }

      console.log(`📚 Available content: ${contentStats.totalItems} items from ${contentStats.sources.length} sources`);
      console.log(`   Average quality score: ${contentStats.avgScore.toFixed(3)}`);
      console.log('');

      // Generate the report
      const result = await this.generator.generateReport(
        options.topic,
        options.maxSources || 15,
        options.timeRangeDays || 30
      );

      if (!result.success) {
        console.error(`❌ Report generation failed: ${result.error}`);
        process.exit(1);
      }

      const report = result.report!;
      const duration = Date.now() - startTime;

      console.log('');
      console.log('✅ Report Generated Successfully!');
      console.log('='.repeat(50));
      console.log(`📄 Report ID: ${report.id}`);
      console.log(`📰 Title: ${report.title}`);
      console.log(`📊 Sources Used: ${report.source_count}`);
      console.log(`📝 Citations: ${report.citation_count}`);
      console.log(`📖 Word Count: ${report.word_count.toLocaleString()}`);
      console.log(`🎯 Confidence Score: ${((report.confidence_score || 0) * 100).toFixed(1)}%`);
      console.log(`⏱️  Generation Time: ${duration}ms`);
      
      if (report.pdf_path) {
        console.log(`📄 PDF Path: ${report.pdf_path}`);
      }

      console.log('');
      console.log('🔗 API Endpoints:');
      console.log(`   View Report: GET /api/reports/${report.id}`);
      console.log(`   Download PDF: GET /api/reports/${report.id}/pdf`);

      if (options.interactive) {
        console.log('');
        console.log('📋 Report Preview:');
        console.log('-'.repeat(50));
        console.log(report.executive_summary || 'No executive summary available');
        console.log('-'.repeat(50));
      }

    } catch (error) {
      console.error('💥 Fatal error during report generation:', error);
      process.exit(1);
    }
  }

  async listRecentReports(limit = 10): Promise<void> {
    console.log('📊 Recent Reports');
    console.log('='.repeat(50));

    try {
      const result = await db.query(
        'SELECT id, topic, title, source_count, citation_count, confidence_score, created_at FROM reports ORDER BY created_at DESC LIMIT $1',
        [limit]
      );

      if (result.rows.length === 0) {
        console.log('No reports found. Generate your first report with:');
        console.log('npm run generate "your topic here"');
        return;
      }

      result.rows.forEach((report: any, index: number) => {
        const date = new Date(report.created_at).toLocaleDateString('en-IN');
        const confidence = report.confidence_score ? (report.confidence_score * 100).toFixed(0) + '%' : 'N/A';
        
        console.log(`${index + 1}. ${report.title}`);
        console.log(`   ID: ${report.id}`);
        console.log(`   Topic: ${report.topic}`);
        console.log(`   Created: ${date} | Sources: ${report.source_count} | Citations: ${report.citation_count} | Confidence: ${confidence}`);
        console.log('');
      });

    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  }

  private async checkContentAvailability(timeRangeDays: number): Promise<{
    totalItems: number;
    sources: string[];
    avgScore: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays);

    const result = await db.query(`
      SELECT 
        COUNT(*) as total_items,
        AVG(composite_score) as avg_score,
        ARRAY_AGG(DISTINCT source) as sources
      FROM content_items 
      WHERE published_at >= $1 OR collected_at >= $1
    `, [cutoffDate]);

    const stats = result.rows[0];
    
    return {
      totalItems: parseInt(stats.total_items),
      avgScore: parseFloat(stats.avg_score) || 0,
      sources: stats.sources || []
    };
  }

  async searchAndPreview(topic: string, maxSources = 15): Promise<void> {
    console.log(`🔍 Preview: Searching for content related to "${topic}"`);
    console.log('='.repeat(50));

    try {
      const sources = await db.searchContentItems(topic, maxSources);
      
      if (sources.length === 0) {
        console.log('❌ No relevant sources found.');
        console.log('Try a different topic or run "npm run collect" to gather more content.');
        return;
      }

      console.log(`✅ Found ${sources.length} relevant sources:`);
      console.log('');

      sources.slice(0, 10).forEach((source, index) => {
        const date = source.published_at?.toISOString().split('T')[0] || 'Unknown';
        console.log(`${index + 1}. ${source.title.substring(0, 80)}...`);
        console.log(`   Score: ${source.composite_score.toFixed(3)} | ${source.source} | ${date}`);
        console.log(`   ${source.url.substring(0, 70)}...`);
        console.log('');
      });

      if (sources.length > 10) {
        console.log(`... and ${sources.length - 10} more sources`);
        console.log('');
      }

      const avgScore = sources.reduce((sum, s) => sum + s.composite_score, 0) / sources.length;
      console.log(`📊 Average quality score: ${avgScore.toFixed(3)}`);
      console.log('');
      console.log('To generate a full report with these sources, run:');
      console.log(`npm run generate "${topic}"`);

    } catch (error) {
      console.error('Search failed:', error);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const cli = new ReportCLI();

  try {
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    if (args.includes('--list')) {
      const limit = args.includes('--limit') ? 
        parseInt(args[args.indexOf('--limit') + 1]) || 10 : 10;
      await cli.listRecentReports(limit);
      return;
    }

    if (args.includes('--preview')) {
      const topicIndex = args.indexOf('--preview') + 1;
      if (topicIndex >= args.length) {
        console.error('❌ Topic required for preview. Usage: --preview "your topic"');
        process.exit(1);
      }
      const topic = args[topicIndex];
      const maxSources = args.includes('--max-sources') ?
        parseInt(args[args.indexOf('--max-sources') + 1]) || 15 : 15;
      
      await cli.searchAndPreview(topic, maxSources);
      return;
    }

    // Generate report
    const topic = args[0];
    if (!topic) {
      console.error('❌ Topic is required. Usage: npm run generate "your topic"');
      console.log('\nFor more options, run: npm run generate -- --help');
      process.exit(1);
    }

    const options: GenerateOptions = {
      topic,
      maxSources: args.includes('--max-sources') ? 
        parseInt(args[args.indexOf('--max-sources') + 1]) || 15 : 15,
      timeRangeDays: args.includes('--days') ?
        parseInt(args[args.indexOf('--days') + 1]) || 30 : 30,
      interactive: args.includes('--preview')
    };

    await cli.generateReport(options);

  } catch (error) {
    console.error('💥 CLI error:', error);
    process.exit(1);
  } finally {
    await db.close();
    process.exit(0);
  }
}

function showHelp() {
  console.log('HR Research Platform - Report Generator');
  console.log('');
  console.log('Usage:');
  console.log('  npm run generate "topic"                    Generate report on topic');
  console.log('  npm run generate -- --preview "topic"      Preview sources for topic');
  console.log('  npm run generate -- --list                 List recent reports');
  console.log('  npm run generate -- --help                 Show this help');
  console.log('');
  console.log('Options:');
  console.log('  --max-sources N     Maximum number of sources to use (default: 15)');
  console.log('  --days N            Time range in days to search (default: 30)');
  console.log('  --limit N           Limit for --list command (default: 10)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run generate "attrition trends in India"');
  console.log('  npm run generate "remote work policies" -- --max-sources 20 --days 60');
  console.log('  npm run generate -- --preview "hiring trends" --max-sources 10');
  console.log('  npm run generate -- --list --limit 5');
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ReportCLI };