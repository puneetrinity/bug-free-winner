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

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    
    // In a real implementation, you'd stream the file from storage
    // For now, return the path information
    res.json({
      success: true,
      message: 'PDF generation completed',
      pdf_path: report.pdf_path,
      download_url: `/api/reports/${report.id}/download`
    });
    
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to serve PDF' 
    });
  }
});

// Get collection statistics
app.get('/api/stats/collection', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const stats = await db.getCollectionStats(days);
    
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
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
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
  console.log(`📚 Available endpoints:`);
  console.log(`   GET  /health                      - Health check`);
  console.log(`   GET  /api/content                 - List content items`);
  console.log(`   GET  /api/content/search          - Search content`);
  console.log(`   POST /api/reports/generate        - Generate report`);
  console.log(`   GET  /api/reports/:id             - Get report by ID`);
  console.log(`   GET  /api/reports/:id/pdf         - Download report PDF`);
  console.log(`   GET  /api/stats/collection        - Collection statistics`);
  console.log(``);
  console.log(`📖 Example requests:`);
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