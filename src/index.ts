import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import db from './db/connection';
import { ReportGenerator } from './reports/generator';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'HR Research Platform API',
  customfavIcon: '/favicon.ico',
  customCss: `
    .topbar-wrapper { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
  `
}));

// Request validation schemas
const GenerateReportSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  max_sources: z.number().min(1).max(50).default(15),
  time_range_days: z.number().min(1).max(365).default(30)
});

// Initialize report generator
const reportGenerator = new ReportGenerator();

// Root endpoint - redirect to dashboard
app.get('/', (req, res) => {
  // Check if request accepts HTML (browser) or JSON (API client)
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  
  if (acceptsHtml) {
    res.redirect('/dashboard');
  } else {
    res.json({
      service: 'HR Research Platform API',
      version: '1.0.0',
      status: 'online',
      timestamp: new Date().toISOString(),
      links: {
        dashboard: '/dashboard',
        api_docs: '/api-docs',
        health: '/health'
      },
      endpoints: {
        health: 'GET /health',
        content: {
          list: 'GET /api/content?limit=20&min_score=0.5',
          search: 'GET /api/content/search?q=attrition'
        },
        reports: {
          generate: 'POST /api/reports/generate',
          get: 'GET /api/reports/:id',
          pdf: 'GET /api/reports/:id/pdf'
        },
        stats: 'GET /api/stats/collection?days=7'
      },
      example: {
        generate_report: {
          method: 'POST',
          url: '/api/reports/generate',
          body: {
            topic: 'employee attrition in India',
            max_sources: 10,
            time_range_days: 30
          }
        }
      }
    });
  }
});

// Dashboard UI route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// RSS News Hub route
app.get('/rss-news', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rss-news.html'));
});

// Alternative route for RSS news
app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rss-news.html'));
});

// Health check endpoint  
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: HR Research Platform
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'HR Research Platform'
  });
});

// Get content items with filtering
app.get('/api/content', async (req, res) => {
  try {
    const options = {
      source: req.query.source as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      min_score: req.query.min_score ? parseFloat(req.query.min_score as string) : undefined,
      categories: req.query.categories ? (req.query.categories as string).split(',') : undefined,
      since_days: req.query.since_days ? parseInt(req.query.since_days as string) : undefined
    };

    const items = await db.getContentItems(options);
    
    res.json({
      success: true,
      count: items.length,
      data: items,
      filters_applied: options
    });
    
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch content items' 
    });
  }
});

// Search content items
app.get('/api/content/search', async (req, res) => {
  try {
    const { q: query, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
    }

    const items = await db.searchContentItems(
      query as string, 
      limit ? parseInt(limit as string) : 20
    );
    
    res.json({
      success: true,
      query,
      count: items.length,
      data: items
    });
    
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Search failed' 
    });
  }
});

// Generate report endpoint
app.post('/api/reports/generate', async (req, res) => {
  try {
    const validatedData = GenerateReportSchema.parse(req.body);
    
    console.log(`🎯 Generating report for topic: ${validatedData.topic}`);
    console.log(`   Max sources: ${validatedData.max_sources}, Time range: ${validatedData.time_range_days} days`);
    
    // Start report generation (async)
    const reportResult = await reportGenerator.generateReport(
      validatedData.topic,
      validatedData.max_sources,
      validatedData.time_range_days
    );
    
    if (!reportResult.success) {
      return res.status(500).json({
        success: false,
        error: reportResult.error || 'Failed to generate report'
      });
    }

    res.json({
      success: true,
      report_id: reportResult.report!.id,
      status: 'completed',
      report: {
        id: reportResult.report!.id,
        title: reportResult.report!.title,
        topic: reportResult.report!.topic,
        word_count: reportResult.report!.word_count,
        source_count: reportResult.report!.source_count,
        citation_count: reportResult.report!.citation_count,
        confidence_score: reportResult.report!.confidence_score,
        created_at: reportResult.report!.created_at,
        pdf_url: reportResult.report!.pdf_path ? `/api/reports/${reportResult.report!.id}/pdf` : undefined
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    console.error('Error generating report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate report' 
    });
  }
});

// Generate deep dive PDF report with live search
app.post('/api/reports/generate-pdf-deep-dive', async (req, res) => {
  try {
    const validatedData = GenerateReportSchema.parse(req.body);
    
    console.log(`🔍 Generating DEEP DIVE PDF report for topic: ${validatedData.topic}`);
    console.log(`   Live search results: ${validatedData.max_sources}, Search recency: ${validatedData.time_range_days} days`);
    
    // Check if API keys are available for live search
    const braveApiKey = process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
    const scrapingBeeApiKey = process.env.SCRAPINGBEE_API_KEY;
    
    console.log('🔑 API Key Check:', {
      hasBrave: !!braveApiKey,
      hasScrapingBee: !!scrapingBeeApiKey,
      braveLength: braveApiKey?.length || 0,
      scrapingBeeLength: scrapingBeeApiKey?.length || 0
    });
    
    if (!braveApiKey || !scrapingBeeApiKey) {
      console.log('❌ Missing API keys:', {
        brave: !braveApiKey ? 'MISSING' : 'PRESENT',
        scrapingBee: !scrapingBeeApiKey ? 'MISSING' : 'PRESENT'
      });
      return res.status(503).json({
        success: false,
        error: 'Deep dive PDF generation requires API keys for live search. Please configure BRAVE_API_KEY (or BRAVE_SEARCH_API_KEY) and SCRAPINGBEE_API_KEY environment variables.'
      });
    }

    // Import the collector for live search
    const { BraveScrapingBeeCollector } = await import('./collectors/brave-scrapingbee-collector');
    const { ContentScorer } = await import('./scoring/content-scorer');
    
    console.log('🌐 Starting live content collection...');
    
    // Create dynamic search queries based on the topic
    const topicQueries = [
      validatedData.topic,
      `${validatedData.topic} India statistics`,
      `${validatedData.topic} Indian companies trends`,
      `${validatedData.topic} market research India`,
      `${validatedData.topic} survey data analysis`
    ];
    
    // Initialize collector and scorer
    const collector = new BraveScrapingBeeCollector(braveApiKey, scrapingBeeApiKey);
    const scorer = new ContentScorer();
    
    // Collect live content
    const maxPerQuery = Math.max(3, Math.floor(validatedData.max_sources / topicQueries.length));
    const rawItems = await collector.collectHRContent(topicQueries, maxPerQuery);
    
    if (rawItems.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No live content found for the specified topic'
      });
    }
    
    console.log(`📊 Processing and scoring ${rawItems.length} live items...`);
    
    // Score and prepare content items for database insertion
    const scoredItems: unknown[] = [];
    for (const rawItem of rawItems) {
      try {
        const crypto = await import('crypto');
        const contentHash = crypto.createHash('md5')
          .update(`${rawItem.title}${rawItem.url}`)
          .digest('hex');
        
        const { scored_item } = scorer.scoreContent(rawItem, 'brave-search-deep-dive');
        
        const contentItem = {
          ...scored_item,
          source: 'brave-search-deep-dive',
          content_hash: contentHash
        };
        
        scoredItems.push(contentItem);
      } catch (error) {
        console.error(`Failed to process item: ${rawItem.title}`, error);
      }
    }
    
    console.log(`📈 Successfully processed ${scoredItems.length} items for deep dive analysis`);
    
    // Generate enhanced report with live data
    const reportResult = await reportGenerator.generateReport(
      validatedData.topic,
      scoredItems.length,  // Use actual collected items
      validatedData.time_range_days
    );
    
    if (!reportResult.success) {
      return res.status(500).json({
        success: false,
        error: reportResult.error || 'Failed to generate deep dive PDF report'
      });
    }

    res.json({
      success: true,
      report_id: reportResult.report!.id,
      status: 'completed',
      live_sources_collected: scoredItems.length,
      report: {
        id: reportResult.report!.id,
        title: reportResult.report!.title,
        topic: reportResult.report!.topic,
        word_count: reportResult.report!.word_count,
        source_count: reportResult.report!.source_count,
        citation_count: reportResult.report!.citation_count,
        confidence_score: reportResult.report!.confidence_score,
        created_at: reportResult.report!.created_at,
        pdf_url: reportResult.report!.pdf_path ? `/api/reports/${reportResult.report!.id}/pdf` : undefined,
        report_type: 'deep-dive-pdf'
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    console.error('Error generating deep dive PDF report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate deep dive PDF report' 
    });
  }
});

// Get report by ID
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await db.getReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        error: 'Report not found' 
      });
    }

    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch report' 
    });
  }
});

// Serve PDF files
app.get('/api/reports/:id/pdf', async (req, res) => {
  try {
    const report = await db.getReport(req.params.id);
    
    if (!report || !report.pdf_path) {
      return res.status(404).json({ 
        success: false, 
        error: 'PDF not found' 
      });
    }

    // Check if PDF file exists
    const fsPromises = await import('fs/promises');
    const path = await import('path');
    
    try {
      // Construct full path to PDF file
      const pdfPath = path.resolve(report.pdf_path);
      await fsPromises.access(pdfPath); // Check if file exists
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${report.title.replace(/[^a-zA-Z0-9\s]/g, '_')}.pdf"`);
      
      // Stream the PDF file
      const fs = await import('fs');
      const readStream = fs.createReadStream(pdfPath);
      readStream.pipe(res);
      
    } catch {
      console.error('PDF file not found:', report.pdf_path);
      return res.status(404).json({
        success: false,
        error: 'PDF file not found on server'
      });
    }
    
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to serve PDF' 
    });
  }
});

// Global flag to track RSS table creation
let rssTablesCreated = false;
let rssTableCreationPromise: Promise<void> | null = null;

// Ensure RSS tables exist (with race condition protection)
async function ensureRSSTables() {
  // If already created or being created, skip
  if (rssTablesCreated || rssTableCreationPromise) {
    if (rssTableCreationPromise) {
      await rssTableCreationPromise; // Wait for ongoing creation
    }
    return;
  }

  try {
    // Check if RSS tables exist
    await db.query('SELECT 1 FROM rss_articles LIMIT 1');
    rssTablesCreated = true;
  } catch (error: any) {
    if (error.code === '42P01') { // relation does not exist
      // Create a promise to prevent multiple simultaneous creations
      rssTableCreationPromise = createRSSTables();
      await rssTableCreationPromise;
      rssTableCreationPromise = null;
      rssTablesCreated = true;
    }
  }
}

async function createRSSTables() {
  console.log('📰 Creating RSS tables...');
  
  try {
    // Create RSS tables with IF NOT EXISTS
    const rssSchema = `
-- RSS articles table (separate from content_items for optimization)
CREATE TABLE IF NOT EXISTS rss_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- RSS Source info
  feed_name TEXT NOT NULL,
  feed_group TEXT NOT NULL,
  feed_category TEXT NOT NULL,
  
  -- Article content
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  content_hash TEXT UNIQUE NOT NULL,
  
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
);`;

    const statements = rssSchema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.query(statement);
        } catch (err: any) {
          // Ignore 'already exists' errors
          if (!err.message.includes('already exists') && err.code !== '42P07') {
            throw err;
          }
        }
      }
    }
    
    console.log('✅ RSS tables created successfully');
  } catch (error) {
    console.error('❌ Failed to create RSS tables:', error);
    throw error;
  }
}

// RSS Articles endpoints
app.get('/api/rss/articles', async (req, res) => {
  try {
    await ensureRSSTables(); // Auto-create tables if needed
    
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || 20;
    
    let query = `
      SELECT * FROM rss_articles 
      ${category ? 'WHERE feed_category = $1' : ''}
      ORDER BY published_at DESC 
      LIMIT ${category ? '$2' : '$1'}
    `;
    
    const params = category ? [category, limit] : [limit];
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      articles: result.rows
    });
  } catch (error: any) {
    console.error('RSS fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/rss/categories', async (req, res) => {
  try {
    await ensureRSSTables(); // Auto-create tables if needed
    
    const result = await db.query(`
      SELECT 
        feed_category as category,
        COUNT(*) as count,
        MAX(published_at) as latest_article
      FROM rss_articles
      GROUP BY feed_category
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      categories: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/rss/search', async (req, res) => {
  try {
    await ensureRSSTables(); // Auto-create tables if needed
    
    const searchTerm = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term required'
      });
    }
    
    const query = `
      SELECT * FROM rss_articles 
      WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) 
        @@ plainto_tsquery('english', $1)
      ORDER BY published_at DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [searchTerm, limit]);
    
    res.json({
      success: true,
      count: result.rows.length,
      search_term: searchTerm,
      articles: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get collection statistics
app.get('/api/stats/collection', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    // Handle case where tables don't exist yet
    let stats;
    try {
      stats = await db.getCollectionStats(days);
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        // Tables don't exist yet, return empty stats
        return res.json({
          success: true,
          period_days: days,
          by_source: [],
          raw_data: [],
          message: 'Database not initialized yet'
        });
      }
      throw error;
    }
    
    // Aggregate stats by source
    const aggregated = stats.reduce((acc, stat) => {
      if (!acc[stat.source]) {
        acc[stat.source] = {
          source: stat.source,
          total_collected: 0,
          total_processed: 0,
          total_errors: 0,
          avg_score: 0,
          collections: 0
        };
      }
      
      acc[stat.source].total_collected += stat.items_collected;
      acc[stat.source].total_processed += stat.items_processed;
      acc[stat.source].total_errors += stat.errors_count;
      acc[stat.source].avg_score += stat.avg_quality_score || 0;
      acc[stat.source].collections += 1;
      
      return acc;
    }, {} as any);
    
    // Calculate averages
    Object.values(aggregated).forEach((agg: any) => {
      agg.avg_score = agg.avg_score / agg.collections;
    });

    res.json({
      success: true,
      period_days: days,
      by_source: Object.values(aggregated),
      raw_data: stats
    });
    
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch statistics' 
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Database test endpoint
app.post('/api/admin/test-db', async (req, res) => {
  try {
    console.log('🧪 Testing database connection...');
    const result = await db.query('SELECT NOW() as current_time');
    
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      server_time: result.rows[0].current_time
    });
  } catch (error: any) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Content collection endpoint
app.post('/api/admin/collect', async (req, res) => {
  try {
    console.log('🔄 Starting content collection...');
    
    // Simple auth check - in production, use proper auth
    const authHeader = req.headers.authorization;
    if (authHeader !== 'Bearer collect-content-2024') {
      console.log('❌ Unauthorized collection attempt');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Import and run collection
    const { BraveScrapingBeeCollector } = await import('./collectors/brave-scrapingbee-collector');
    
    const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;
    const braveKey = process.env.BRAVE_API_KEY;
    
    if (!braveKey || !scrapingBeeKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing required API keys'
      });
    }

    // Get search queries from request body or use defaults
    const requestQueries = req.body.queries;
    const maxPerQuery = req.body.maxPerQuery || 3;
    
    const searchQueries = requestQueries && requestQueries.length > 0 ? requestQueries : [
      'employee attrition trends India 2024',
      'employee retention strategies India',
      'remote work policies Indian companies',
      'HR technology trends India',
      'workplace culture India'
    ];
    
    console.log('🔍 Using search queries:', searchQueries);
    
    // Initialize the Brave + ScrapingBee collector
    console.log('🐝🔍 Initializing Brave + ScrapingBee collector...');
    const collector = new BraveScrapingBeeCollector(braveKey, scrapingBeeKey);
    
    const results: any[] = [];
    let totalCollected = 0;
    
    try {
      console.log(`🔍 Collecting content for ${searchQueries.length} queries...`);
      const rawItems = await collector.collectHRContent(searchQueries, maxPerQuery);
      
      if (rawItems.length === 0) {
        results.push({ message: 'No raw content collected', collected: 0 });
      } else {
        console.log(`📊 Processing and scoring ${rawItems.length} raw items...`);
        
        // Import ContentScorer and crypto for hashing
        const { ContentScorer } = await import('./scoring/content-scorer');
        const crypto = await import('crypto');
        const scorer = new ContentScorer();
        
        let processedCount = 0;
        
        for (const rawItem of rawItems) {
          try {
            // Generate content hash for deduplication
            const contentHash = crypto.createHash('md5')
              .update(`${rawItem.title}${rawItem.url}`)
              .digest('hex');
            
            // Use generic source naming for search-based collection
            const sourceType = 'brave-search';
            
            // Score the content
            const { scored_item } = scorer.scoreContent(rawItem, sourceType);
            
            // Prepare for database insertion
            const contentItem = {
              ...scored_item,
              source: sourceType,
              content_hash: contentHash,
              scraper_version: '1.0',
              processing_notes: `Collected via Brave Search + ScrapingBee on ${new Date().toISOString()}`
            };
            
            // Insert into database
            await db.insertContentItem(contentItem);
            processedCount++;
            console.log(`✅ Processed and saved: ${rawItem.title.substring(0, 50)}...`);
            
          } catch (error: any) {
            console.error(`❌ Failed to process item "${rawItem.title}":`, error.message);
          }
        }
        
        results.push({ 
          message: `Collected and processed content for ${searchQueries.length} queries`, 
          collected: rawItems.length,
          processed: processedCount,
          queries: searchQueries
        });
        totalCollected += processedCount;
      }
    } catch (error: any) {
      console.error('Error during collection:', error.message);
      results.push({ error: error.message });
    }
    
    console.log(`✅ Collection completed! Total items: ${totalCollected}`);
    
    res.json({ 
      success: true, 
      message: `Content collection completed! Collected ${totalCollected} items.`,
      results: results
    });
    
  } catch (error: any) {
    console.error('Collection failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple database migration endpoint
app.post('/api/admin/migrate', async (req, res) => {
  try {
    console.log('📨 Migration endpoint called');
    
    // Simple auth check - in production, use proper auth
    const authHeader = req.headers.authorization;
    if (authHeader !== 'Bearer migrate-db-2024') {
      console.log('❌ Unauthorized migration attempt');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    console.log('✅ Authorization successful');
    console.log('🗄️ Starting simple database migration...');
    
    // Read schema file directly and execute
    const fs = await import('fs');
    const path = await import('path');
    
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split schema into statements more carefully
    // Remove comments first
    const cleanSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split on standalone semicolons (not inside parentheses)
    const statements = [];
    let currentStatement = '';
    let parenLevel = 0;
    
    for (let i = 0; i < cleanSchema.length; i++) {
      const char = cleanSchema[i];
      currentStatement += char;
      
      if (char === '(') parenLevel++;
      else if (char === ')') parenLevel--;
      else if (char === ';' && parenLevel === 0) {
        const stmt = currentStatement.slice(0, -1).trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add final statement if exists
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`🔨 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await db.query(statement + ';');
        console.log(`  ✅ ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  ${i + 1}/${statements.length}: ${statement.substring(0, 50)}... (already exists)`);
        } else {
          throw error;
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Database migration completed successfully! Created ${statements.length} objects.` 
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// RSS Collection endpoint
app.post('/api/admin/collect-rss', async (req, res) => {
  try {
    console.log('📡 Starting RSS collection...');
    
    // Simple auth check - in production, use proper auth
    const authHeader = req.headers.authorization;
    if (authHeader !== 'Bearer collect-rss-2024') {
      console.log('❌ Unauthorized RSS collection attempt');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Import and run RSS collection
    const { RSSCollectionManager } = await import('./scripts/collect-rss');
    const manager = new RSSCollectionManager();
    
    // Ensure RSS tables exist first
    await ensureRSSTables();
    
    // Run the collection
    await manager.runDailyCollection();
    
    console.log('✅ RSS collection completed successfully');
    
    res.json({ 
      success: true, 
      message: 'RSS collection completed successfully!'
    });
    
  } catch (error: any) {
    console.error('RSS collection failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 HR Research Platform API running on port ${port}`);
  
  // Log API key availability
  const braveKey = process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
  console.log('🔑 API Keys Status:', {
    BRAVE: braveKey ? '✅ Configured' : '❌ Not configured',
    SCRAPINGBEE: process.env.SCRAPINGBEE_API_KEY ? '✅ Configured' : '❌ Not configured',
    GROQ: process.env.GROQ_API_KEY ? '✅ Configured' : '❌ Not configured'
  });
  
  console.log('📚 Available endpoints:');
  console.log('   GET  /health                           - Health check');
  console.log('   GET  /api/content                      - List content items');
  console.log('   GET  /api/content/search               - Search content');
  console.log('   POST /api/reports/generate             - Generate content report');
  console.log('   POST /api/reports/generate-pdf-deep-dive - Generate deep dive PDF (live search)');
  console.log('   GET  /api/reports/:id                  - Get report by ID');
  console.log('   GET  /api/reports/:id/pdf              - Download report PDF');
  console.log('   GET  /api/stats/collection             - Collection statistics');
  console.log('');
  console.log('📖 Example requests:');
  console.log(`   curl http://localhost:${port}/health`);
  console.log(`   curl http://localhost:${port}/api/content?limit=5&min_score=0.7`);
  console.log(`   curl -X POST http://localhost:${port}/api/reports/generate -H "Content-Type: application/json" -d '{"topic":"attrition trends in India","max_sources":10}'`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

export default app;