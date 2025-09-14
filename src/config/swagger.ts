import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'HR Research Platform API',
    version: '1.0.0',
    description: 'AI-powered HR research platform for the Indian market. Collects HR content from PIB, PeopleMatters, and HRKatha, then generates comprehensive research reports with citations.',
    contact: {
      name: 'API Support',
      url: 'https://github.com/puneetrinity/bug-free-winner'
    }
  },
  servers: [
    {
      url: 'https://bug-free-winner-production.up.railway.app',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    schemas: {
      ContentItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          source: { type: 'string', enum: ['pib', 'peoplematters', 'hrkatha'] },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          snippet: { type: 'string' },
          author: { type: 'string' },
          published_at: { type: 'string', format: 'date-time' },
          collected_at: { type: 'string', format: 'date-time' },
          categories: { type: 'array', items: { type: 'string' } },
          composite_score: { type: 'number', minimum: 0, maximum: 1 },
          domain_authority: { type: 'number', minimum: 0, maximum: 1 },
          indian_context_score: { type: 'number', minimum: 0, maximum: 1 },
          freshness_score: { type: 'number', minimum: 0, maximum: 1 },
          word_count: { type: 'integer' }
        }
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          topic: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          executive_summary: { type: 'string' },
          word_count: { type: 'integer' },
          source_count: { type: 'integer' },
          citation_count: { type: 'integer' },
          confidence_score: { type: 'number', minimum: 0, maximum: 1 },
          created_at: { type: 'string', format: 'date-time' },
          pdf_url: { type: 'string', format: 'uri' }
        }
      },
      GenerateReportRequest: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: { 
            type: 'string', 
            description: 'Research topic (e.g., "employee attrition in India")',
            example: 'remote work trends in Indian tech companies'
          },
          max_sources: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 50, 
            default: 15,
            description: 'Maximum number of sources to analyze'
          },
          time_range_days: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 365, 
            default: 30,
            description: 'Number of days back to search for content'
          }
        }
      },
      CollectionStats: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          total_collected: { type: 'integer' },
          total_processed: { type: 'integer' },
          total_errors: { type: 'integer' },
          avg_score: { type: 'number' },
          collections: { type: 'integer' }
        }
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          data: { type: 'object' }
        }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/index.ts', './dist/index.js'], // Path to the API files
};

export const swaggerSpec = swaggerJSDoc(options);