import { RawContentItem, ScoringComponents, ContentItem } from '../types';
import crypto from 'crypto';

export class ContentScorer {
  private readonly domainScores = {
    'default': 0.70 // Give all domains a decent baseline score
  };

  private readonly indianKeywords = [
    'india', 'indian', 'rupee', 'inr', '₹', 'lakh', 'crore',
    'epfo', 'esi', 'pf', 'provident fund', 'gratuity',
    'labour code', 'wage code', 'osh code', 'posh',
    'ministry of labour', 'government of india',
    'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai',
    'hyderabad', 'pune', 'kolkata', 'ahmedabad'
  ];

  scoreContent(item: RawContentItem, source: string): {
    scored_item: Omit<ContentItem, 'id' | 'collected_at'>,
    components: ScoringComponents
  } {
    const domain = this.extractDomain(item.url);
    const content = `${item.title} ${item.snippet || ''} ${item.content || ''}`.toLowerCase();
    
    // Calculate individual scores
    const domain_authority = this.calculateDomainAuthority(domain);
    const indian_context = this.calculateIndianContext(content);
    const freshness = this.calculateFreshness(item.published_at);
    const extractability = this.calculateExtractability(content);
    
    // Calculate composite score with penalty for web search results
    let composite_score = (
      0.4 * domain_authority +
      0.3 * indian_context + 
      0.2 * freshness +
      0.1 * extractability
    );
    
    // No penalties - let content quality determine the score

    const components: ScoringComponents = {
      domain_authority,
      indian_context,
      freshness,
      extractability
    };

    const scored_item = {
      source,
      source_url: this.getSourceUrl(source),
      title: item.title,
      url: item.url,
      content_hash: this.generateContentHash(item.title, item.url),
      snippet: item.snippet || this.createSnippet(item.content || item.title),
      full_content: item.content || '',
      author: item.author,
      published_at: item.published_at || new Date(),
      categories: item.categories || [],
      language: 'en',
      
      // Scores
      domain_authority,
      indian_context_score: indian_context,
      freshness_score: freshness,
      extractability_score: extractability,
      composite_score,
      
      // Extracted features
      has_statistics: this.hasStatistics(content),
      has_dates: this.hasDates(content),
      has_numbers: this.hasNumbers(content),
      word_count: this.countWords(item.content || item.snippet || item.title),
      
      // Metadata
      scraper_version: '1.0',
      processing_notes: `Scored on ${new Date().toISOString()}`
    };

    return { scored_item, components };
  }

  private calculateDomainAuthority(domain: string): number {
    return (this.domainScores as Record<string, number>)[domain] || this.domainScores.default;
  }

  private calculateIndianContext(content: string): number {
    let score = 0;
    const words = content.split(/\s+/);
    const totalWords = words.length;
    
    if (totalWords === 0) return 0;

    // Count Indian context keywords
    let indianWordCount = 0;
    for (const keyword of this.indianKeywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        indianWordCount += matches.length;
      }
    }

    // Base score from keyword density
    const keywordDensity = Math.min(1.0, indianWordCount / (totalWords * 0.01)); // 1% density = full score
    score = keywordDensity;

    // Boost for specific high-value keywords
    if (content.includes('india') || content.includes('indian')) score += 0.2;
    if (content.includes('epfo') || content.includes('esi') || content.includes('pf')) score += 0.3;
    if (content.includes('labour code') || content.includes('wage code')) score += 0.2;
    if (content.includes('₹') || content.includes('lakh') || content.includes('crore')) score += 0.15;

    return Math.min(1.0, score);
  }

  private calculateFreshness(published_at?: Date): number {
    if (!published_at) return 0.5; // Default for unknown dates
    
    const now = new Date();
    const ageInDays = (now.getTime() - published_at.getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay with half-life of 180 days (6 months)
    const halfLife = 180;
    const freshness = Math.pow(0.5, ageInDays / halfLife);
    
    return Math.max(0.1, Math.min(1.0, freshness));
  }

  private calculateExtractability(content: string): number {
    let score = 0.3; // Base score
    
    // Check for various extractable elements
    const patterns = {
      percentages: /\d+(?:\.\d+)?%/g,
      currency_inr: /₹[\d,]+/g,
      currency_words: /\d+\s*(?:lakh|crore|million|billion)/gi,
      dates: /\b(?:19|20)\d{2}\b/g,
      numbers: /\b\d{1,3}(?:,\d{3})*\b/g,
      quotes: /"[^"]{20,}"/g,
      statistics: /\b(?:survey|study|report|data|statistics|analysis)\b/gi
    };

    // Award points for each type of extractable content
    if ((content.match(patterns.percentages) || []).length >= 1) score += 0.2;
    if ((content.match(patterns.currency_inr) || []).length >= 1) score += 0.15;
    if ((content.match(patterns.currency_words) || []).length >= 1) score += 0.15;
    if ((content.match(patterns.dates) || []).length >= 2) score += 0.1;
    if ((content.match(patterns.numbers) || []).length >= 3) score += 0.1;
    if ((content.match(patterns.quotes) || []).length >= 1) score += 0.05;
    if ((content.match(patterns.statistics) || []).length >= 1) score += 0.1;

    return Math.min(1.0, score);
  }

  private hasStatistics(content: string): boolean {
    const statPatterns = [
      /\d+(?:\.\d+)?%/,
      /₹[\d,]+/,
      /\d+\s*(?:lakh|crore)/i,
      /\b(?:survey|study|report|data|statistics)\b/i
    ];
    
    return statPatterns.some(pattern => pattern.test(content));
  }

  private hasDates(content: string): boolean {
    const datePatterns = [
      /\b(?:19|20)\d{2}\b/,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i,
      /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/
    ];
    
    return datePatterns.some(pattern => pattern.test(content));
  }

  private hasNumbers(content: string): boolean {
    return /\b\d{1,3}(?:,\d{3})*\b/.test(content);
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  private generateContentHash(title: string, url: string): string {
    const combined = `${title}|${url}`;
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  private createSnippet(content: string, maxLength = 300): string {
    if (!content) return '';
    const cleaned = content.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }

  private getSourceUrl(_source: string): string {
    return 'https://search-based-content.com'; // Generic placeholder since we're search-based now
  }

  // Utility method to batch score multiple items
  scoreMultipleItems(items: RawContentItem[], source: string): Omit<ContentItem, 'id' | 'collected_at'>[] {
    console.log(`🔢 Scoring ${items.length} items from ${source}...`);
    
    const scoredItems = items.map(item => {
      const { scored_item } = this.scoreContent(item, source);
      return scored_item;
    });

    const avgScore = scoredItems.reduce((sum, item) => sum + item.composite_score, 0) / scoredItems.length;
    console.log(`📊 Average composite score for ${source}: ${avgScore.toFixed(3)}`);
    
    return scoredItems.sort((a, b) => b.composite_score - a.composite_score);
  }
}