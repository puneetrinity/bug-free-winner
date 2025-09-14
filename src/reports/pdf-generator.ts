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

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'doughnut';
  title: string;
  data: any;
}

export class PDFGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'reports', 'pdf');
  }

  async generatePDF(
    report: Report,
    sources: ContentItem[],
    citations: CitationData[]
  ): Promise<string> {
    console.log(`📄 Generating PDF for report: ${report.title}`);

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    });

    try {
      const page = await browser.newPage();
      
      // Generate HTML content
      const htmlContent = await this.generateHTMLReport(report, sources, citations);
      
      // Set page content
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdfPath = path.join(this.outputDir, `${report.id}.pdf`);
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; margin: 0 auto; color: #666;">
            ${report.title}
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; margin: 0 auto; color: #666;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
        printBackground: true
      });

      console.log(`✅ PDF generated: ${pdfPath}`);
      return pdfPath;

    } finally {
      await browser.close();
    }
  }

  private async generateHTMLReport(
    report: Report,
    sources: ContentItem[],
    citations: CitationData[]
  ): Promise<string> {
    const charts = this.generateChartsData(sources);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        ${this.getReportCSS()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="report-container">
        ${this.generateTitlePage(report)}
        ${this.generateExecutiveSummary(report)}
        ${this.generateMainContent(report)}
        ${this.generateCharts(charts)}
        ${this.generateSourcesSection(sources)}
        ${this.generateAppendix(report, sources, citations)}
    </div>
    
    <script>
        ${this.generateChartsScript(charts)}
    </script>
</body>
</html>`;
  }

  private generateTitlePage(report: Report): string {
    const date = new Date(report.created_at).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
    <div class="title-page">
        <div class="title-header">
            <h1 class="report-title">${report.title}</h1>
            <div class="report-subtitle">HR Market Research Report</div>
        </div>
        
        <div class="title-content">
            <div class="report-meta">
                <div class="meta-item">
                    <strong>Topic:</strong> ${report.topic}
                </div>
                <div class="meta-item">
                    <strong>Generated:</strong> ${date}
                </div>
                <div class="meta-item">
                    <strong>Sources Analyzed:</strong> ${report.source_count}
                </div>
                <div class="meta-item">
                    <strong>Citations:</strong> ${report.citation_count}
                </div>
                <div class="meta-item">
                    <strong>Word Count:</strong> ${report.word_count.toLocaleString()}
                </div>
                <div class="meta-item">
                    <strong>Confidence Score:</strong> ${((report.confidence_score || 0) * 100).toFixed(0)}%
                </div>
            </div>
            
            <div class="methodology">
                <h3>Methodology</h3>
                <p>${report.methodology || 'This report was generated using automated analysis of recent sources from the Indian HR market.'}</p>
            </div>
        </div>
        
        <div class="title-footer">
            <div class="disclaimer">
                <p><strong>Disclaimer:</strong> This report is generated automatically from public sources and should be considered as research material. All statistics and claims should be independently verified.</p>
            </div>
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateExecutiveSummary(report: Report): string {
    if (!report.executive_summary) return '';
    
    return `
    <div class="executive-summary">
        <h2>Executive Summary</h2>
        <div class="summary-content">
            ${this.formatTextContent(report.executive_summary)}
        </div>
    </div>
    <div class="page-break"></div>`;
  }

  private generateMainContent(report: Report): string {
    return `
    <div class="main-content">
        <h2>Detailed Analysis</h2>
        <div class="content-body">
            ${this.formatTextContent(report.content)}
        </div>
    </div>`;
  }

  private generateChartsData(sources: ContentItem[]): ChartData[] {
    const charts: ChartData[] = [];

    // Chart 1: Content Quality Distribution
    const qualityBands = sources.reduce((acc, source) => {
      const score = Number(source.composite_score);
      let band = 'Low (0.0-0.3)';
      if (score >= 0.7) band = 'High (0.7-1.0)';
      else if (score >= 0.5) band = 'Medium (0.5-0.7)';
      else if (score >= 0.3) band = 'Fair (0.3-0.5)';
      
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    charts.push({
      type: 'doughnut',
      title: 'Content Quality Distribution',
      data: {
        labels: Object.keys(qualityBands),
        datasets: [{
          data: Object.values(qualityBands),
          backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#6B7280'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      }
    });

    // Chart 2: Indian Context Relevance
    const contextScores = sources.map(s => Number(s.indian_context_score)).sort((a, b) => b - a);
    const contextLabels = sources.map((_, i) => `Source ${i + 1}`);
    
    charts.push({
      type: 'bar',
      title: 'Indian Context Relevance by Source',
      data: {
        labels: contextLabels.slice(0, 10), // Top 10 sources
        datasets: [{
          label: 'Indian Context Score',
          data: contextScores.slice(0, 10),
          backgroundColor: '#3B82F6',
          borderColor: '#1D4ED8',
          borderWidth: 1
        }]
      }
    });

    // Chart 3: Content Features Analysis
    const featureAnalysis = sources.reduce((acc, source) => {
      if (source.has_statistics) acc.statistics = (acc.statistics || 0) + 1;
      if (source.has_dates) acc.dates = (acc.dates || 0) + 1;
      if (source.has_numbers) acc.numbers = (acc.numbers || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    charts.push({
      type: 'bar',
      title: 'Content Features Analysis',
      data: {
        labels: ['Statistics', 'Dates', 'Numbers'],
        datasets: [{
          label: 'Sources with Feature',
          data: [
            featureAnalysis.statistics || 0,
            featureAnalysis.dates || 0,
            featureAnalysis.numbers || 0
          ],
          backgroundColor: ['#10B981', '#F59E0B', '#8B5CF6'],
          borderWidth: 1
        }]
      }
    });

    // Chart 4: Content Length Distribution (Word Count)
    // const wordCounts = sources.map(s => s.word_count).filter(wc => wc > 0); // Currently unused
    // const avgWordCount = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length; // Currently unused
    const wordCountBands = sources.reduce((acc, source) => {
      const words = source.word_count;
      let band = 'Very Short (<100)';
      if (words >= 1000) band = 'Very Long (1000+)';
      else if (words >= 500) band = 'Long (500-1000)';
      else if (words >= 200) band = 'Medium (200-500)';
      else if (words >= 100) band = 'Short (100-200)';
      
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    charts.push({
      type: 'pie',
      title: 'Content Length Distribution',
      data: {
        labels: Object.keys(wordCountBands),
        datasets: [{
          data: Object.values(wordCountBands),
          backgroundColor: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      }
    });

    return charts;
  }

  private generateCharts(charts: ChartData[]): string {
    if (charts.length === 0) return '';

    let html = `<div class="charts-section">
        <h2>Data Visualization</h2>
        <div class="charts-grid">`;

    charts.forEach((chart, index) => {
      html += `
        <div class="chart-container">
            <h3>${chart.title}</h3>
            <canvas id="chart-${index}" width="400" height="200"></canvas>
        </div>`;
    });

    html += '</div></div>';
    return html;
  }

  private generateChartsScript(charts: ChartData[]): string {
    let script = '';
    
    charts.forEach((chart, index) => {
      script += `
        new Chart(document.getElementById('chart-${index}'), {
            type: '${chart.type}',
            data: ${JSON.stringify(chart.data)},
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });`;
    });

    return script;
  }

  private generateSourcesSection(sources: ContentItem[]): string {
    return `
    <div class="page-break"></div>
    <div class="sources-section">
        <h2>Sources & References</h2>
        <div class="sources-list">
            ${sources.map((source, index) => `
                <div class="source-item">
                    <div class="source-number">[${index + 1}]</div>
                    <div class="source-details">
                        <h4>${source.title}</h4>
                        <p class="source-url">${source.url}</p>
                        <div class="source-meta">
                            <span>Published: ${source.published_at?.toISOString().split('T')[0] || 'Unknown'}</span> |
                            <span>Domain: ${this.extractDomainFromUrl(source.url)}</span> |
                            <span>Quality Score: ${Number(source.composite_score).toFixed(2)}</span>
                        </div>
                        ${source.snippet ? `<p class="source-snippet">${source.snippet}</p>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
  }

  private extractDomainFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.startsWith('www.') ? domain.substring(4) : domain;
    } catch {
      return 'Unknown Domain';
    }
  }

  private generateAppendix(report: Report, sources: ContentItem[], citations: CitationData[]): string {
    return `
    <div class="page-break"></div>
    <div class="appendix">
        <h2>Appendix</h2>
        
        <div class="appendix-section">
            <h3>Report Metadata</h3>
            <table class="metadata-table">
                <tr><td>Report ID</td><td>${report.id}</td></tr>
                <tr><td>Generation Time</td><td>${report.generation_time_ms}ms</td></tr>
                <tr><td>Total Sources</td><td>${sources.length}</td></tr>
                <tr><td>Total Citations</td><td>${citations.length}</td></tr>
                <tr><td>Average Source Quality</td><td>${(sources.reduce((sum, s) => sum + Number(s.composite_score), 0) / sources.length).toFixed(3)}</td></tr>
            </table>
        </div>
        
        <div class="appendix-section">
            <h3>Data Quality Breakdown</h3>
            <table class="quality-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>High Quality</th>
                        <th>Medium Quality</th>
                        <th>Low Quality</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Sources (by score)</td>
                        <td>${sources.filter(s => Number(s.composite_score) >= 0.7).length}</td>
                        <td>${sources.filter(s => Number(s.composite_score) >= 0.5 && Number(s.composite_score) < 0.7).length}</td>
                        <td>${sources.filter(s => Number(s.composite_score) < 0.5).length}</td>
                    </tr>
                    <tr>
                        <td>Has Statistics</td>
                        <td>${sources.filter(s => s.has_statistics).length}</td>
                        <td>-</td>
                        <td>${sources.filter(s => !s.has_statistics).length}</td>
                    </tr>
                    <tr>
                        <td>Has Dates</td>
                        <td>${sources.filter(s => s.has_dates).length}</td>
                        <td>-</td>
                        <td>${sources.filter(s => !s.has_dates).length}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;
  }

  private formatTextContent(content: string): string {
    // Convert markdown-style formatting to HTML
    return content
      // Headers
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Citations
      .replace(/\[Source (\d+)\]/g, '<sup class="citation">[$1]</sup>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/^\s*(.+)/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p><h/g, '<h')
      .replace(/h><\/p>/g, 'h>');
  }

  private getReportCSS(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page { 
            size: A4; 
            margin: 2cm 2cm 2cm 2cm;
            @top-center { content: "HR Research Deep Dive Report"; }
            @bottom-center { content: "Page " counter(page) " of " counter(pages); }
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 11pt;
            background: white;
        }
        
        .report-container { 
            max-width: 100%; 
            background: white;
        }
        
        .page-break { 
            page-break-before: always; 
            break-before: page;
        }
        
        .title-page {
            height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            padding: 4cm 2cm;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            margin: -2cm;
            padding-top: 6cm;
        }
        
        .title-header {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .report-title {
            font-size: 36pt;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 20px;
        }
        
        .report-subtitle {
            font-size: 18pt;
            color: #666;
        }
        
        .title-content {
            flex: 2;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .report-meta {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .meta-item {
            margin-bottom: 10px;
            font-size: 12pt;
        }
        
        .methodology {
            text-align: left;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .methodology h3 {
            color: #2c5aa0;
            margin-bottom: 15px;
        }
        
        .title-footer .disclaimer {
            background: #fff3cd;
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        h1, h2, h3, h4 {
            color: #2c5aa0;
            margin-bottom: 15px;
        }
        
        h2 { font-size: 18pt; border-bottom: 2px solid #2c5aa0; padding-bottom: 5px; }
        h3 { font-size: 14pt; }
        h4 { font-size: 12pt; }
        
        p { margin-bottom: 12px; text-align: justify; }
        
        .executive-summary {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .summary-content {
            font-size: 12pt;
            line-height: 1.7;
        }
        
        .main-content {
            margin-bottom: 30px;
        }
        
        .charts-section {
            margin: 30px 0;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-top: 20px;
        }
        
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .chart-container h3 {
            text-align: center;
            margin-bottom: 15px;
            font-size: 14pt;
        }
        
        .sources-section {
            margin-top: 30px;
        }
        
        .sources-section h2 {
            color: #2c5aa0;
            border-bottom: 2px solid #2c5aa0;
            padding-bottom: 10px;
            margin-bottom: 25px;
        }
        
        .source-item {
            display: flex;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            page-break-inside: avoid;
            border-left: 3px solid #2c5aa0;
        }
        
        .source-number {
            font-weight: bold;
            color: #2c5aa0;
            margin-right: 15px;
            min-width: 40px;
        }
        
        .source-details h4 {
            margin-bottom: 8px;
            color: #333;
            font-size: 12pt;
            font-weight: 600;
        }
        
        .source-url {
            color: #007bff;
            word-break: break-all;
            margin-bottom: 8px;
            font-size: 9pt;
            font-family: monospace;
        }
        
        .source-meta {
            font-size: 10pt;
            color: #666;
            margin-bottom: 8px;
        }
        
        .source-snippet {
            font-style: italic;
            color: #555;
            font-size: 10pt;
        }
        
        .appendix {
            margin-top: 30px;
        }
        
        .appendix-section {
            margin-bottom: 25px;
        }
        
        .metadata-table, .quality-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .metadata-table td, .quality-table th, .quality-table td {
            padding: 8px 12px;
            border: 1px solid #ddd;
            text-align: left;
        }
        
        .metadata-table td:first-child, .quality-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        
        .citation {
            color: #2c5aa0;
            font-weight: bold;
        }
        
        @media print {
            .chart-container {
                break-inside: avoid;
            }
            
            .source-item {
                break-inside: avoid;
            }
        }
    `;
  }
}