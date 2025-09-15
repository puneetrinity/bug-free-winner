import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { ContentItem, Report } from '../types';

interface CitationData {
  number: number;
  sourceId: string;
  text: string;
  context: string;
}

export class ProfessionalPDFGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'reports', 'pdf');
  }

  async generatePDF(
    report: Report,
    sources: ContentItem[],
    citations: CitationData[]
  ): Promise<string> {
    console.log(`📄 Generating professional PDF for: ${report.title}`);

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--font-render-hinting=none'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    });

    try {
      const page = await browser.newPage();
      
      // Generate professional HTML content
      const htmlContent = await this.generateProfessionalHTML(report, sources, citations);
      
      // Set page content
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF with professional settings
      const pdfPath = path.join(this.outputDir, `${report.id}.pdf`);
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: {
          top: '25mm',
          bottom: '25mm',
          left: '20mm',
          right: '20mm'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(report),
        footerTemplate: this.getFooterTemplate(),
        printBackground: true,
        preferCSSPageSize: false
      });

      console.log(`✅ Professional PDF generated: ${pdfPath}`);
      return pdfPath;

    } finally {
      await browser.close();
    }
  }

  private getHeaderTemplate(report: Report): string {
    return `
      <div style="width: 100%; font-size: 9px; padding: 5px 30px; display: flex; justify-content: space-between; color: #666;">
        <div style="text-align: left; flex: 1;">HR Research Platform</div>
        <div style="text-align: center; flex: 2; font-style: italic;">${this.truncateTitle(report.title, 60)}</div>
        <div style="text-align: right; flex: 1;">${new Date().toLocaleDateString('en-IN')}</div>
      </div>
    `;
  }

  private getFooterTemplate(): string {
    return `
      <div style="width: 100%; font-size: 9px; padding: 5px 30px; display: flex; justify-content: space-between; color: #666;">
        <div style="text-align: left;">© 2025 HR Research Platform - AI Generated Report</div>
        <div style="text-align: right;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    `;
  }

  private truncateTitle(title: string, maxLength: number): string {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  }

  private async generateProfessionalHTML(
    report: Report,
    sources: ContentItem[],
    citations: CitationData[]
  ): Promise<string> {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        ${this.getProfessionalCSS()}
    </style>
</head>
<body>
    ${this.generateCoverPage(report)}
    ${this.generateTableOfContents()}
    ${this.generateExecutiveSummary(report)}
    ${this.generateKeyFindings(report, sources)}
    ${this.generateDetailedAnalysis(report, citations)}
    ${this.generateSourceAnalysis(sources)}
    ${this.generateMethodologySection(report)}
    ${this.generateReferences(sources, citations)}
    ${this.generateAppendix(report)}
</body>
</html>`;
  }

  private generateCoverPage(report: Report): string {
    const date = new Date(report.created_at);
    const formattedDate = date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
    <div class="cover-page">
        <div class="cover-header">
            <div class="organization-name">HR Research Platform</div>
            <div class="report-type">Market Intelligence Report</div>
        </div>
        
        <div class="cover-main">
            <h1 class="cover-title">${report.title}</h1>
            <div class="cover-subtitle">Comprehensive Analysis of ${report.topic}</div>
        </div>
        
        <div class="cover-metadata">
            <div class="metadata-grid">
                <div class="metadata-item">
                    <span class="label">Report Date</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Sources Analyzed</span>
                    <span class="value">${report.source_count}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Total Citations</span>
                    <span class="value">${report.citation_count}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Confidence Level</span>
                    <span class="value">${this.getConfidenceLevel(report.confidence_score)}</span>
                </div>
            </div>
        </div>
        
        <div class="cover-footer">
            <div class="confidentiality-notice">
                <strong>Confidentiality Notice:</strong> This report contains proprietary research and analysis. 
                Distribution is limited to authorized recipients only.
            </div>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateTableOfContents(): string {
    return `
    <div class="toc-page">
        <h2 class="section-title">Table of Contents</h2>
        <div class="toc-content">
            <div class="toc-item">
                <span class="toc-title">1. Executive Summary</span>
                <span class="toc-dots"></span>
                <span class="toc-page">3</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">2. Key Findings</span>
                <span class="toc-dots"></span>
                <span class="toc-page">4</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">3. Detailed Analysis</span>
                <span class="toc-dots"></span>
                <span class="toc-page">5</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">4. Source Analysis</span>
                <span class="toc-dots"></span>
                <span class="toc-page">7</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">5. Methodology</span>
                <span class="toc-dots"></span>
                <span class="toc-page">8</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">6. References</span>
                <span class="toc-dots"></span>
                <span class="toc-page">9</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">7. Appendix</span>
                <span class="toc-dots"></span>
                <span class="toc-page">10</span>
            </div>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateExecutiveSummary(report: Report): string {
    const summary = report.executive_summary || this.generateDefaultSummary(report);
    
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">1.</span> Executive Summary
        </h2>
        <div class="summary-content">
            ${this.formatProfessionalContent(summary)}
        </div>
        
        <div class="summary-highlights">
            <h3>Report Highlights</h3>
            <ul class="highlights-list">
                <li>Analysis based on ${report.source_count} verified sources</li>
                <li>Coverage period: Last 30 days of market activity</li>
                <li>Focus area: Indian HR market trends and developments</li>
                <li>Confidence score: ${((report.confidence_score || 0) * 100).toFixed(0)}%</li>
            </ul>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateKeyFindings(report: Report, sources: ContentItem[]): string {
    // Extract key statistics from sources
    const stats = this.extractKeyStatistics(sources);
    
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">2.</span> Key Findings
        </h2>
        
        <div class="findings-grid">
            <div class="finding-card">
                <div class="finding-icon">📊</div>
                <div class="finding-title">Data Coverage</div>
                <div class="finding-value">${stats.totalSources}</div>
                <div class="finding-desc">Total sources analyzed</div>
            </div>
            
            <div class="finding-card">
                <div class="finding-icon">🎯</div>
                <div class="finding-title">Indian Context</div>
                <div class="finding-value">${stats.avgIndianContext}%</div>
                <div class="finding-desc">Average relevance score</div>
            </div>
            
            <div class="finding-card">
                <div class="finding-icon">📈</div>
                <div class="finding-title">Quality Score</div>
                <div class="finding-value">${stats.avgQuality}</div>
                <div class="finding-desc">Average content quality</div>
            </div>
            
            <div class="finding-card">
                <div class="finding-icon">📝</div>
                <div class="finding-title">Content Depth</div>
                <div class="finding-value">${stats.avgWordCount}</div>
                <div class="finding-desc">Average words per source</div>
            </div>
        </div>
        
        <div class="key-insights">
            <h3>Primary Insights</h3>
            <ol class="insights-list">
                ${this.extractInsights(report.content)}
            </ol>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateDetailedAnalysis(report: Report, citations: CitationData[]): string {
    const formattedContent = this.formatContentWithCitations(report.content, citations);
    
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">3.</span> Detailed Analysis
        </h2>
        <div class="analysis-content">
            ${formattedContent}
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateSourceAnalysis(sources: ContentItem[]): string {
    const sourcesByQuality = this.categorizeSourcesByQuality(sources);
    
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">4.</span> Source Analysis
        </h2>
        
        <div class="source-overview">
            <h3>Source Quality Distribution</h3>
            <div class="quality-table">
                <table>
                    <thead>
                        <tr>
                            <th>Quality Level</th>
                            <th>Count</th>
                            <th>Percentage</th>
                            <th>Key Characteristics</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateQualityTableRows(sourcesByQuality, sources.length)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="source-features">
            <h3>Content Feature Analysis</h3>
            <div class="features-grid">
                ${this.generateFeatureAnalysis(sources)}
            </div>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateMethodologySection(report: Report): string {
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">5.</span> Methodology
        </h2>
        
        <div class="methodology-content">
            <p>${report.methodology || this.getDefaultMethodology()}</p>
            
            <h3>Data Collection Process</h3>
            <ol class="process-list">
                <li><strong>Source Identification:</strong> Automated scanning of RSS feeds, news aggregators, and specialized HR publications</li>
                <li><strong>Content Extraction:</strong> Full-text extraction and natural language processing</li>
                <li><strong>Quality Scoring:</strong> Multi-factor assessment including domain authority, relevance, and content depth</li>
                <li><strong>Indian Context Analysis:</strong> Specific filtering for Indian market relevance</li>
                <li><strong>Synthesis:</strong> AI-powered analysis and report generation with citation tracking</li>
            </ol>
            
            <h3>Quality Assurance</h3>
            <p>All sources are evaluated based on:</p>
            <ul>
                <li>Domain authority and publication credibility</li>
                <li>Content freshness and timeliness</li>
                <li>Statistical data and factual accuracy</li>
                <li>Relevance to Indian HR market</li>
            </ul>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateReferences(sources: ContentItem[], citations: CitationData[]): string {
    const usedSources = this.getUsedSources(sources, citations);
    
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">6.</span> References
        </h2>
        
        <div class="references-list">
            ${usedSources.map((source, index) => `
                <div class="reference-item">
                    <span class="ref-number">[${index + 1}]</span>
                    <div class="ref-content">
                        <div class="ref-title">${source.title}</div>
                        <div class="ref-meta">
                            ${source.author ? `${source.author}. ` : ''}
                            ${source.source}. 
                            ${source.published_at ? new Date(source.published_at).toLocaleDateString('en-IN') : 'N.D.'}.
                            ${source.url ? `Available at: ${this.formatURL(source.url)}` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateAppendix(report: Report): string {
    return `
    <div class="content-section">
        <h2 class="section-title">
            <span class="section-number">7.</span> Appendix
        </h2>
        
        <div class="appendix-content">
            <h3>A. Report Metadata</h3>
            <table class="metadata-table">
                <tr>
                    <td class="meta-label">Report ID</td>
                    <td class="meta-value">${report.id}</td>
                </tr>
                <tr>
                    <td class="meta-label">Generation Time</td>
                    <td class="meta-value">${report.generation_time_ms ? (report.generation_time_ms / 1000).toFixed(2) + ' seconds' : 'N/A'}</td>
                </tr>
                <tr>
                    <td class="meta-label">Word Count</td>
                    <td class="meta-value">${report.word_count.toLocaleString()}</td>
                </tr>
                <tr>
                    <td class="meta-label">API Version</td>
                    <td class="meta-value">2.0</td>
                </tr>
            </table>
            
            <h3>B. Disclaimer</h3>
            <div class="disclaimer-box">
                <p><strong>Important Notice:</strong> This report is generated using artificial intelligence and automated data collection methods. While every effort has been made to ensure accuracy, the information should be independently verified before making business decisions.</p>
                
                <p>The analysis and opinions expressed in this report are based on publicly available information and do not constitute professional advice. Users should consult with qualified professionals for specific guidance.</p>
                
                <p>© ${new Date().getFullYear()} HR Research Platform. All rights reserved.</p>
            </div>
        </div>
    </div>`;
  }

  private getProfessionalCSS(): string {
    return `
        /* Reset and Base Styles */
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            font-size: 11pt;
            background: white;
        }
        
        /* Page Breaks */
        .page-break { 
            page-break-after: always;
            break-after: page;
        }
        
        /* Cover Page */
        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 60px 40px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            position: relative;
        }
        
        .cover-header {
            text-align: center;
            margin-bottom: 80px;
        }
        
        .organization-name {
            font-size: 14pt;
            font-weight: 600;
            color: #5a67d8;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .report-type {
            font-size: 11pt;
            color: #718096;
            font-style: italic;
        }
        
        .cover-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
        }
        
        .cover-title {
            font-family: 'Merriweather', serif;
            font-size: 32pt;
            font-weight: 700;
            color: #1a202c;
            line-height: 1.2;
            margin-bottom: 20px;
        }
        
        .cover-subtitle {
            font-size: 14pt;
            color: #4a5568;
            font-weight: 300;
        }
        
        .cover-metadata {
            margin: 60px 0;
        }
        
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .metadata-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .metadata-item .label {
            display: block;
            font-size: 9pt;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .metadata-item .value {
            display: block;
            font-size: 16pt;
            font-weight: 600;
            color: #2d3748;
        }
        
        .cover-footer {
            margin-top: auto;
        }
        
        .confidentiality-notice {
            background: #fff5f5;
            border-left: 4px solid #fc8181;
            padding: 15px 20px;
            font-size: 9pt;
            color: #742a2a;
            border-radius: 4px;
        }
        
        /* Table of Contents */
        .toc-page {
            padding: 60px 40px;
        }
        
        .toc-content {
            margin-top: 40px;
        }
        
        .toc-item {
            display: flex;
            align-items: baseline;
            margin-bottom: 15px;
            font-size: 11pt;
        }
        
        .toc-title {
            flex: 0 0 auto;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #cbd5e0;
            margin: 0 10px;
            height: 1px;
        }
        
        .toc-page {
            flex: 0 0 auto;
            font-weight: 500;
        }
        
        /* Content Sections */
        .content-section {
            padding: 40px;
            margin-bottom: 40px;
        }
        
        .section-title {
            font-family: 'Merriweather', serif;
            font-size: 20pt;
            color: #2b6cb0;
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .section-number {
            display: inline-block;
            width: 40px;
            font-weight: 300;
        }
        
        /* Executive Summary */
        .summary-content {
            font-size: 11pt;
            line-height: 1.8;
            color: #4a5568;
            margin-bottom: 30px;
        }
        
        .summary-highlights {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        
        .summary-highlights h3 {
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 14pt;
        }
        
        .highlights-list {
            list-style: none;
            padding-left: 0;
        }
        
        .highlights-list li {
            padding-left: 25px;
            position: relative;
            margin-bottom: 10px;
        }
        
        .highlights-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #48bb78;
            font-weight: bold;
        }
        
        /* Key Findings */
        .findings-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .finding-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        
        .finding-icon {
            font-size: 24pt;
            margin-bottom: 10px;
        }
        
        .finding-title {
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        
        .finding-value {
            font-size: 28pt;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .finding-desc {
            font-size: 9pt;
            opacity: 0.8;
        }
        
        .key-insights {
            margin-top: 40px;
        }
        
        .key-insights h3 {
            color: #2d3748;
            margin-bottom: 20px;
            font-size: 14pt;
        }
        
        .insights-list {
            padding-left: 25px;
        }
        
        .insights-list li {
            margin-bottom: 15px;
            line-height: 1.8;
            color: #4a5568;
        }
        
        /* Analysis Content */
        .analysis-content {
            font-size: 11pt;
            line-height: 1.8;
            color: #4a5568;
        }
        
        .analysis-content p {
            margin-bottom: 15px;
        }
        
        .analysis-content h3 {
            color: #2d3748;
            margin: 25px 0 15px;
            font-size: 14pt;
        }
        
        .analysis-content ul,
        .analysis-content ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .analysis-content li {
            margin-bottom: 8px;
        }
        
        /* Citations */
        .citation {
            display: inline-block;
            background: #edf2f7;
            color: #2b6cb0;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9pt;
            font-weight: 500;
            margin: 0 2px;
            vertical-align: super;
            font-size: 8pt;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th {
            background: #f7fafc;
            color: #2d3748;
            font-weight: 600;
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        /* Quality Table */
        .quality-table {
            margin: 20px 0;
        }
        
        /* Features Grid */
        .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        
        .feature-item {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        
        .feature-label {
            font-size: 9pt;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .feature-value {
            font-size: 18pt;
            font-weight: 600;
            color: #2d3748;
        }
        
        /* References */
        .references-list {
            margin-top: 20px;
        }
        
        .reference-item {
            display: flex;
            margin-bottom: 15px;
        }
        
        .ref-number {
            flex: 0 0 40px;
            font-weight: 600;
            color: #2b6cb0;
        }
        
        .ref-content {
            flex: 1;
        }
        
        .ref-title {
            font-weight: 500;
            margin-bottom: 5px;
            color: #2d3748;
        }
        
        .ref-meta {
            font-size: 10pt;
            color: #718096;
            line-height: 1.4;
        }
        
        /* Methodology */
        .methodology-content {
            line-height: 1.8;
            color: #4a5568;
        }
        
        .process-list {
            margin: 20px 0;
            padding-left: 25px;
        }
        
        .process-list li {
            margin-bottom: 15px;
        }
        
        /* Metadata Table */
        .metadata-table {
            margin: 20px 0;
        }
        
        .meta-label {
            background: #f7fafc;
            font-weight: 600;
            width: 200px;
        }
        
        .meta-value {
            font-family: 'Courier New', monospace;
            color: #4a5568;
        }
        
        /* Disclaimer Box */
        .disclaimer-box {
            background: #fffaf0;
            border: 1px solid #feb2b2;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        
        .disclaimer-box p {
            margin-bottom: 15px;
            font-size: 10pt;
            line-height: 1.6;
            color: #744210;
        }
        
        .disclaimer-box p:last-child {
            margin-bottom: 0;
        }
        
        /* Print Optimization */
        @media print {
            .cover-page {
                background: none;
                border: 2px solid #e2e8f0;
            }
            
            .finding-card {
                background: none;
                border: 2px solid #667eea;
                color: #2d3748;
            }
            
            .page-break {
                page-break-before: always;
            }
        }
    `;
  }

  // Helper methods
  private formatProfessionalContent(content: string): string {
    // Convert markdown-style content to HTML
    return content
      .split('\n\n')
      .map(paragraph => {
        if (paragraph.startsWith('#')) {
          const level = paragraph.match(/^#+/)?.[0].length || 1;
          const text = paragraph.replace(/^#+\s*/, '');
          return `<h${Math.min(level + 2, 6)}>${text}</h${Math.min(level + 2, 6)}>`;
        }
        if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
          const items = paragraph.split('\n').map(item => 
            `<li>${item.replace(/^[-*]\s*/, '')}</li>`
          ).join('');
          return `<ul>${items}</ul>`;
        }
        if (paragraph.match(/^\d+\.\s/)) {
          const items = paragraph.split('\n').map(item => 
            `<li>${item.replace(/^\d+\.\s*/, '')}</li>`
          ).join('');
          return `<ol>${items}</ol>`;
        }
        return `<p>${paragraph}</p>`;
      })
      .join('\n');
  }

  private formatContentWithCitations(content: string, citations: CitationData[]): string {
    let formattedContent = this.formatProfessionalContent(content);
    
    // Add citation markers
    citations.forEach(citation => {
      const citationMarker = `<span class="citation">[${citation.number}]</span>`;
      // Simple replacement - in production, you'd want more sophisticated matching
      if (citation.text && citation.text.length > 20) {
        const excerpt = citation.text.substring(0, 50);
        formattedContent = formattedContent.replace(excerpt, excerpt + citationMarker);
      }
    });
    
    return formattedContent;
  }

  private getConfidenceLevel(score?: number): string {
    const percentage = (score || 0) * 100;
    if (percentage >= 90) return 'Very High (90%+)';
    if (percentage >= 75) return 'High (75-89%)';
    if (percentage >= 60) return 'Moderate (60-74%)';
    if (percentage >= 40) return 'Fair (40-59%)';
    return 'Low (<40%)';
  }

  private generateDefaultSummary(report: Report): string {
    return `This comprehensive analysis examines ${report.topic} based on ${report.source_count} carefully selected sources. 
    The report synthesizes current market trends, emerging patterns, and key developments in the Indian HR landscape. 
    Our analysis reveals significant insights that can inform strategic decision-making and policy development.`;
  }

  private extractKeyStatistics(sources: ContentItem[]) {
    const validScores = sources.map(s => Number(s.composite_score)).filter(s => !isNaN(s));
    const indianScores = sources.map(s => Number(s.indian_context_score)).filter(s => !isNaN(s));
    const wordCounts = sources.map(s => s.word_count).filter(w => w > 0);
    
    return {
      totalSources: sources.length,
      avgQuality: validScores.length > 0 
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
        : '0.00',
      avgIndianContext: indianScores.length > 0
        ? Math.round((indianScores.reduce((a, b) => a + b, 0) / indianScores.length) * 100)
        : 0,
      avgWordCount: wordCounts.length > 0
        ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
        : 0
    };
  }

  private extractInsights(content: string): string {
    // Extract bullet points or key sentences from content
    const lines = content.split('\n').filter(line => line.trim());
    const insights = lines
      .filter(line => 
        line.startsWith('-') || 
        line.startsWith('•') || 
        line.match(/^\d+\./) ||
        line.includes('significant') ||
        line.includes('trend') ||
        line.includes('growth')
      )
      .slice(0, 5)
      .map(line => line.replace(/^[-•\d.]\s*/, ''));
    
    if (insights.length === 0) {
      // Generate default insights
      return `
        <li>Market analysis reveals emerging trends in HR technology adoption</li>
        <li>Significant shifts observed in talent management strategies</li>
        <li>Growing emphasis on employee experience and engagement</li>
        <li>Digital transformation continues to reshape HR practices</li>
        <li>Indian market shows unique characteristics compared to global trends</li>
      `;
    }
    
    return insights.map(insight => `<li>${insight}</li>`).join('\n');
  }

  private categorizeSourcesByQuality(sources: ContentItem[]) {
    return sources.reduce((acc, source) => {
      const score = Number(source.composite_score);
      let category = 'Low';
      if (score >= 0.8) category = 'Excellent';
      else if (score >= 0.6) category = 'Good';
      else if (score >= 0.4) category = 'Fair';
      
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateQualityTableRows(categories: Record<string, number>, total: number): string {
    const levels = ['Excellent', 'Good', 'Fair', 'Low'];
    const characteristics = {
      'Excellent': 'High authority, recent, statistical data',
      'Good': 'Credible source, relevant, well-structured',
      'Fair': 'Moderate quality, some relevant insights',
      'Low': 'Limited relevance or dated information'
    };
    
    return levels.map(level => {
      const count = categories[level] || 0;
      const percentage = ((count / total) * 100).toFixed(1);
      return `
        <tr>
          <td>${level}</td>
          <td>${count}</td>
          <td>${percentage}%</td>
          <td>${characteristics[level as keyof typeof characteristics]}</td>
        </tr>
      `;
    }).join('');
  }

  private generateFeatureAnalysis(sources: ContentItem[]): string {
    const features = {
      'With Statistics': sources.filter(s => s.has_statistics).length,
      'With Dates': sources.filter(s => s.has_dates).length,
      'With Numbers': sources.filter(s => s.has_numbers).length,
    };
    
    return Object.entries(features).map(([label, value]) => `
      <div class="feature-item">
        <div class="feature-label">${label}</div>
        <div class="feature-value">${value}</div>
      </div>
    `).join('');
  }

  private getDefaultMethodology(): string {
    return `This report employs a comprehensive multi-source analysis methodology, combining automated data collection 
    with AI-powered synthesis. Our approach ensures broad coverage of the Indian HR market while maintaining 
    high standards of accuracy and relevance.`;
  }

  private getUsedSources(sources: ContentItem[], citations: CitationData[]): ContentItem[] {
    const usedIds = new Set(citations.map(c => c.sourceId));
    return sources.filter(s => usedIds.has(s.id));
  }

  private formatURL(url: string): string {
    // Truncate long URLs for better display
    if (url.length > 60) {
      return url.substring(0, 50) + '...';
    }
    return url;
  }
}