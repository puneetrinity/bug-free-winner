# HR Research Platform

An AI-powered research platform that collects, analyzes, and generates comprehensive reports on the Indian HR market using sources from government agencies and HR media.

## 🎯 Phase 1 MVP - Complete

### ✅ Deliverable 1: Content Ingestion
- **PIB Labour Ministry Scraper**: Automatically scrapes press releases from Ministry of Labour & Employment
- **RSS Parser**: Ingests content from PeopleMatters and HR Katha RSS feeds with fallback web scraping
- **Content Collection Pipeline**: Orchestrates data collection from all sources with error handling and statistics

### ✅ Deliverable 2: Content Normalization & Scoring
- **Content Scoring Algorithm**: Multi-factor quality scoring based on:
  - Domain Authority (40%): Government sites score highest
  - Indian Context (30%): Keyword density for Indian HR terms
  - Freshness (20%): Exponential decay based on publication date
  - Extractability (10%): Presence of statistics, numbers, dates
- **PostgreSQL Storage**: Structured database with full-text search capabilities

### ✅ Deliverable 3: LLM Report Generation
- **Groq AI Integration**: Uses Llama3-70B for content analysis and report writing
- **PDF Generation**: Professional reports with charts, citations, and bibliography
- **REST API**: Express server with endpoints for report generation and content access

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database URL

# Initialize database
npm run db:migrate

# Collect content from sources
npm run collect

# Start the API server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hr_research

# API Keys
GROQ_API_KEY=your_groq_api_key_here
BRAVE_API_KEY=your_brave_api_key_here

# Server
PORT=3000
```

## 📋 Usage

### Content Collection

```bash
# Collect from all sources
npm run collect

# View collection statistics
npm run collect:stats

# Reset and reinitialize database
npm run db:reset
```

### Report Generation

```bash
# Generate a report (CLI)
npm run generate "attrition trends in India"

# Preview sources before generating
npm run generate -- --preview "remote work policies"

# List recent reports
npm run generate -- --list

# Generate with custom parameters
npm run generate "hiring trends" -- --max-sources 20 --days 60
```

### API Usage

```bash
# Health check
curl http://localhost:3000/health

# Search content
curl "http://localhost:3000/api/content/search?q=attrition&limit=5"

# Generate report via API
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "employee retention strategies",
    "max_sources": 15,
    "time_range_days": 30
  }'

# Get report
curl http://localhost:3000/api/reports/{report-id}

# Download PDF
curl http://localhost:3000/api/reports/{report-id}/pdf
```

## 🏗️ Architecture

### Data Sources
- **PIB Government**: Official Labour Ministry press releases
- **PeopleMatters**: HR industry news and insights
- **HR Katha**: Human resources articles and trends

### Content Pipeline
1. **Collection**: Multi-source scraping with error handling
2. **Scoring**: Quality assessment using weighted algorithm
3. **Storage**: PostgreSQL with full-text search indexes
4. **Analysis**: LLM-powered content synthesis
5. **Generation**: PDF reports with citations and charts

### Quality Scoring
Each piece of content receives a composite score (0-1) based on:
- **Domain Authority**: Government (.gov.in) = 1.0, HR Media = 0.75-0.85, Default = 0.60
- **Indian Context**: Keyword matching for Indian terms (EPFO, ESI, lakh, crore, etc.)
- **Freshness**: Exponential decay with 180-day half-life
- **Extractability**: Presence of statistics, quotes, dates, and structured data

## 📊 API Endpoints

### Content Management
- `GET /api/content` - List content with filtering
- `GET /api/content/search?q=query` - Full-text search
- `GET /api/stats/collection` - Collection statistics

### Report Generation
- `POST /api/reports/generate` - Generate new report
- `GET /api/reports/:id` - Get report details
- `GET /api/reports/:id/pdf` - Download PDF

### System
- `GET /health` - Health check and status

## 🛠️ Development

### Database Operations

```bash
# Run migrations
npm run db:migrate

# Reset database (destructive)
npm run db:reset

# Seed with sample data
npm run db:seed
```

### Testing Content Collection

```bash
# Test PIB scraper
npm run collect -- --source pib

# Test RSS parsing
npm run collect -- --source peoplematters

# View detailed logs
DEBUG=* npm run collect
```

### Project Structure

```
src/
├── db/
│   ├── connection.ts      # Database client and operations
│   └── schema.sql         # Database schema definition
├── scrapers/
│   ├── pib-scraper.ts     # Government press release scraper
│   └── rss-parser.ts      # RSS feed parser with fallbacks
├── scoring/
│   └── content-scorer.ts  # Multi-factor quality scoring
├── reports/
│   ├── generator.ts       # LLM report generation
│   └── pdf-generator.ts   # PDF creation with charts
├── scripts/
│   ├── collect.ts         # Content collection orchestrator
│   ├── migrate.ts         # Database migration tool
│   └── generate-report.ts # Report generation CLI
├── types/
│   └── index.ts           # TypeScript type definitions
└── index.ts               # Express API server
```

## 📈 Performance Metrics

The system tracks comprehensive metrics:
- **Collection Stats**: Items collected, processing time, error rates
- **Quality Scores**: Average content quality by source
- **Report Generation**: Processing time, source utilization, confidence scores
- **Citation Analysis**: Reference patterns and source reliability

## 🔍 Quality Assurance

### Content Quality
- Multi-factor scoring ensures high-quality sources are prioritized
- Government sources (.gov.in) receive maximum authority scores
- Indian context detection favors locally relevant content
- Freshness scoring promotes recent developments

### Report Reliability
- Citations linked to original sources
- Confidence scoring based on source quality and quantity
- Methodology documentation for transparency
- PDF reports include detailed source bibliography

## 🚀 Deployment

### Railway Deployment

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Environment Variables**: Set all required environment variables
3. **Database**: Provision PostgreSQL database
4. **Deploy**: Railway will automatically build and deploy

### Production Checklist

- [ ] Environment variables configured
- [ ] Database provisioned and migrated
- [ ] API keys valid and secured
- [ ] Content collection scheduled
- [ ] Monitoring and logging configured

## 📋 Next Steps (Phase 2)

1. **Enhanced Sources**: Add EPFO, ESIC, Ministry websites
2. **Real-time Updates**: WebSocket notifications for new reports
3. **Advanced Charts**: Interactive data visualizations
4. **User Management**: Authentication and personalized reports
5. **Automated Scheduling**: Regular report generation
6. **Export Formats**: Word documents, PowerPoint presentations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with**: TypeScript, Express, PostgreSQL, Puppeteer, Cheerio, Groq AI

**Data Sources**: PIB India, PeopleMatters, HR Katha

**Focus**: Indian HR Market Intelligence