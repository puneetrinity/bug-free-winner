import axios from 'axios';
import crypto from 'crypto';
import db from '../db/connection';
import { ContentItem, Report } from '../types';
import { PDFGenerator } from './pdf-generator';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface ReportSection {
  title: string;
  content: string;
  citations: number[];
}

interface GenerationResult {
  success: boolean;
  report?: Report;
  error?: string;
}

export class ReportGenerator {
  private groqApiKey: string;
  private groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private pdfGenerator: PDFGenerator;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    this.pdfGenerator = new PDFGenerator();
  }

  async generateReport(
    topic: string, 
    maxSources = 15, 
    timeRangeDays = 30
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    console.log(`📊 Starting report generation for: "${topic}"`);

    try {
      // Step 1: Search and retrieve relevant content
      const sources = await this.findRelevantSources(topic, maxSources, timeRangeDays);
      
      if (sources.length === 0) {
        return {
          success: false,
          error: `No relevant sources found for topic: ${topic}`
        };
      }

      console.log(`📚 Found ${sources.length} relevant sources`);

      // Step 2: Generate report content using LLM
      const reportContent = await this.generateReportContent(topic, sources);
      
      // Step 3: Extract citations and create structured data
      const { sections, citations } = this.extractCitationsFromContent(reportContent, sources);
      
      // Step 4: Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(reportContent, sources.length);
      
      // Step 5: Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(sources, reportContent);
      
      // Step 6: Create report metadata
      const reportData = {
        topic,
        topic_hash: this.generateTopicHash(topic),
        title: this.generateReportTitle(topic),
        content: reportContent,
        executive_summary: executiveSummary,
        methodology: this.generateMethodology(sources.length, timeRangeDays),
        confidence_score: qualityMetrics.confidenceScore,
        source_count: sources.length,
        citation_count: citations.length,
        word_count: this.countWords(reportContent),
        generation_time_ms: Date.now() - startTime,
        source_ids: sources.map(s => s.id),
        html_content: this.convertToHTML(sections, sources, citations)
      };

      // Step 7: Save report to database
      const report = await db.insertReport(reportData);
      console.log(`💾 Report saved with ID: ${report.id}`);

      // Step 8: Save citations
      const citationRecords = citations.map(citation => ({
        report_id: report.id,
        content_item_id: citation.sourceId,
        citation_number: citation.number,
        quoted_text: citation.text,
        context: citation.context
      }));

      if (citationRecords.length > 0) {
        await db.insertCitations(citationRecords);
        console.log(`📝 Saved ${citationRecords.length} citations`);
      }

      // Step 9: Generate PDF
      try {
        const pdfPath = await this.pdfGenerator.generatePDF(report, sources, citations);
        
        // Update report with PDF path
        await db.query(
          'UPDATE reports SET pdf_path = $1 WHERE id = $2',
          [pdfPath, report.id]
        );
        
        report.pdf_path = pdfPath;
        console.log(`📄 PDF generated: ${pdfPath}`);
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        // Continue without PDF - report is still valid
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ Report generation completed in ${totalTime}ms`);

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('Report generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async findRelevantSources(
    topic: string, 
    maxSources: number, 
    timeRangeDays: number
  ): Promise<ContentItem[]> {
    console.log(`🔍 Searching for content related to: "${topic}"`);
    
    // First try direct search
    let sources = await db.searchContentItems(topic, maxSources);
    
    // If not enough results, try broader search with keywords
    if (sources.length < maxSources / 2) {
      const keywords = this.extractKeywords(topic);
      console.log(`🔍 Expanding search with keywords: ${keywords.join(', ')}`);
      
      for (const keyword of keywords) {
        const additionalSources = await db.searchContentItems(keyword, 10);
        sources = sources.concat(additionalSources);
      }
      
      // Remove duplicates and sort by relevance
      sources = sources
        .filter((source, index, self) => 
          index === self.findIndex(s => s.id === source.id)
        )
        .sort((a, b) => Number(b.composite_score) - Number(a.composite_score))
        .slice(0, maxSources);
    }

    // Filter by time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays);
    
    sources = sources.filter(source => 
      new Date(source.published_at || source.collected_at) > cutoffDate
    );
    
    // Use all sources from Brave Search + ScrapingBee without content filtering
    console.log(`🔍 Using all ${sources.length} sources from search without filtering`);

    // Prioritize high-quality sources
    sources = sources
      .filter(source => Number(source.composite_score) > 0.3)
      .sort((a, b) => Number(b.composite_score) - Number(a.composite_score));

    console.log(`📊 Selected ${sources.length} high-quality sources (avg score: ${(sources.reduce((sum, s) => sum + Number(s.composite_score), 0) / sources.length).toFixed(3)})`);
    
    return sources;
  }

  private async generateReportContent(topic: string, sources: ContentItem[]): Promise<string> {
    console.log('🤖 Generating report content with Groq AI...');
    
    // Prepare context from sources
    const sourceContext = sources.map((source, index) => 
      `[Source ${index + 1}] ${source.title}\n` +
      `URL: ${source.url}\n` +
      `Published: ${source.published_at?.toISOString().split('T')[0] || 'Unknown'}\n` +
      `Content: ${(source.full_content || source.snippet || '').substring(0, 1000)}\n` +
      '---'
    ).join('\n');

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are an expert HR researcher specializing in the Indian job market. You write comprehensive, data-driven reports based on recent news and developments. 

Your reports should:
- Be factual and analytical, not promotional
- Include specific statistics, dates, and numbers when available
- Reference sources using [Source X] format
- Focus on trends, implications, and actionable insights
- Use professional business language
- Structure content with clear sections and subheadings
- Cite sources frequently throughout the text

Write a comprehensive research report on the given topic using only the provided sources.`
      },
      {
        role: 'user',
        content: `Topic: ${topic}

Please write a comprehensive research report using these sources:

${sourceContext}

The report should be well-structured with:
1. Executive Summary
2. Key Findings
3. Current Market Trends  
4. Statistical Analysis
5. Regional/Sector Breakdown (if applicable)
6. Future Implications
7. Recommendations

Use [Source X] citations throughout. Focus on Indian HR market context.`
      }
    ];

    try {
      const response = await axios.post<GroqResponse>(this.groqApiUrl, {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 4000
      }, {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      console.log(`📝 Generated ${this.countWords(content)} words using ${response.data.usage.completion_tokens} tokens`);
      
      return content;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Groq API error:', error);
      throw new Error(`Failed to generate content: ${errorMessage}`);
    }
  }

  private async generateExecutiveSummary(content: string, sourceCount: number): Promise<string> {
    console.log('📋 Generating executive summary...');
    
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: 'You are a senior business analyst. Create a concise executive summary that highlights the most important findings and recommendations.'
      },
      {
        role: 'user',
        content: `Based on this research report, write a 150-200 word executive summary that covers:
- Key findings
- Main trends identified  
- Critical implications
- Primary recommendations

Report content:
${content.substring(0, 3000)}

Note: This analysis is based on ${sourceCount} recent sources from the Indian HR market.`
      }
    ];

    try {
      const response = await axios.post<GroqResponse>(this.groqApiUrl, {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.2,
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;

    } catch (error: unknown) {
      console.error('Executive summary generation failed:', error);
      return `Executive Summary: This research report analyzes recent developments in the Indian HR market based on ${sourceCount} sources. The analysis covers key trends, statistical insights, and strategic implications for HR professionals and business leaders.`;
    }
  }

  private extractCitationsFromContent(content: string, sources: ContentItem[]): {
    sections: ReportSection[];
    citations: { number: number; sourceId: string; text: string; context: string; }[];
  } {
    const citations: { number: number; sourceId: string; text: string; context: string; }[] = [];
    const citationRegex = /\[Source (\d+)\]/g;
    
    let match;
    while ((match = citationRegex.exec(content)) !== null) {
      const sourceNumber = parseInt(match[1]) - 1;
      if (sourceNumber >= 0 && sourceNumber < sources.length) {
        const source = sources[sourceNumber];
        
        // Extract surrounding context (50 chars before and after)
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + match[0].length + 50);
        const context = content.substring(start, end);
        
        citations.push({
          number: citations.length + 1,
          sourceId: source.id,
          text: source.title,
          context: context.replace(/\s+/g, ' ').trim()
        });
      }
    }

    // Split content into sections (simple heuristic based on headers)
    const sections: ReportSection[] = [];
    // const sectionRegex = /^(#{1,3}|\d+\.)\s+(.+)$/gm; // Currently unused
    let currentSection = '';
    let currentContent = '';
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3}|\d+\.)\s+(.+)$/);
      
      if (headerMatch) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.trim(),
            citations: this.extractCitationNumbers(currentContent)
          });
        }
        currentSection = headerMatch[2];
        currentContent = '';
      } else {
        currentContent += line + '\n';
      }
    }
    
    // Add final section
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: currentContent.trim(),
        citations: this.extractCitationNumbers(currentContent)
      });
    }

    console.log(`📊 Extracted ${citations.length} citations across ${sections.length} sections`);
    
    return { sections, citations };
  }

  private extractCitationNumbers(text: string): number[] {
    const matches = text.match(/\[Source (\d+)\]/g) || [];
    return matches.map(match => {
      const numberMatch = match.match(/\d+/);
      return parseInt(numberMatch ? numberMatch[0] : '0');
    });
  }

  private extractKeywords(topic: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const keywords = topic
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Add HR-related synonyms and expansions
    const expansions: { [key: string]: string[] } = {
      'attrition': ['turnover', 'retention', 'quit', 'resign'],
      'hiring': ['recruitment', 'talent', 'job', 'employment'],
      'salary': ['compensation', 'wage', 'pay', 'benefits'],
      'remote': ['wfh', 'hybrid', 'flexible', 'telecommute'],
      'skills': ['upskilling', 'training', 'development', 'learning']
    };
    
    const expandedKeywords = [...keywords];
    keywords.forEach(keyword => {
      if (expansions[keyword]) {
        expandedKeywords.push(...expansions[keyword]);
      }
    });
    
    return [...new Set(expandedKeywords)].slice(0, 10);
  }

  private calculateQualityMetrics(sources: ContentItem[], content: string): {
    confidenceScore: number;
  } {
    // Calculate confidence based on multiple factors
    let confidence = 0.5; // Base confidence
    
    // Factor 1: Source quality
    const avgSourceScore = sources.reduce((sum, s) => sum + s.composite_score, 0) / sources.length;
    confidence += avgSourceScore * 0.3;
    
    // Factor 2: Source count
    const sourceCountFactor = Math.min(1.0, sources.length / 10);
    confidence += sourceCountFactor * 0.2;
    
    // Factor 3: Content length and structure
    const wordCount = this.countWords(content);
    const lengthFactor = Math.min(1.0, wordCount / 1000);
    confidence += lengthFactor * 0.1;
    
    // Factor 4: Citation density
    const citations = (content.match(/\[Source \d+\]/g) || []).length;
    const citationDensity = citations / Math.max(1, wordCount / 100);
    const citationFactor = Math.min(1.0, citationDensity / 5);
    confidence += citationFactor * 0.1;
    
    return {
      confidenceScore: Math.min(1.0, Math.max(0.1, confidence))
    };
  }

  private generateTopicHash(topic: string): string {
    return crypto.createHash('md5').update(topic.toLowerCase()).digest('hex');
  }

  private generateReportTitle(topic: string): string {
    // Capitalize and format topic as a report title
    return topic.charAt(0).toUpperCase() + topic.slice(1) + 
           ` - Indian HR Market Analysis ${new Date().getFullYear()}`;
  }

  private generateMethodology(sourceCount: number, timeRangeDays: number): string {
    return `This report was generated through automated analysis of ${sourceCount} recent sources from the Indian HR market, covering the ${timeRangeDays}-day period ending ${new Date().toISOString().split('T')[0]}. Sources were selected based on relevance, authority, and recency, then analyzed using AI to extract key insights and trends.`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private convertToHTML(
    sections: ReportSection[], 
    sources: ContentItem[], 
    _citations: { number: number; sourceId: string; text: string; context: string; }[]
  ): string {
    let html = '<div class="research-report">';
    
    // Add sections
    sections.forEach(section => {
      html += '<section>';
      html += `<h2>${section.title}</h2>`;
      html += `<div class="content">${section.content.replace(/\n/g, '<br>')}</div>`;
      html += '</section>';
    });
    
    // Add bibliography
    if (sources.length > 0) {
      html += '<section class="bibliography">';
      html += '<h2>Sources</h2>';
      html += '<ol>';
      
      sources.forEach((source, _index) => {
        html += '<li>';
        html += `<strong>${source.title}</strong><br>`;
        html += `<a href="${source.url}" target="_blank">${source.url}</a><br>`;
        html += `Published: ${source.published_at?.toISOString().split('T')[0] || 'Unknown'}<br>`;
        html += `Source: ${source.source}<br>`;
        html += '</li>';
      });
      
      html += '</ol>';
      html += '</section>';
    }
    
    html += '</div>';
    return html;
  }
}