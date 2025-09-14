import axios from 'axios';
import * as cheerio from 'cheerio';
import { RawContentItem } from '../types';

interface ScrapingBeeResponse {
  data: string;
  status: number;
  headers: Record<string, string>;
}

interface ScrapingBeeConfig {
  url: string;
  premium_proxy?: boolean;
  country_code?: string;
  render_js?: boolean;
  wait?: number;
  screenshot?: boolean;
  block_ads?: boolean;
  block_resources?: boolean;
  window_width?: number;
  window_height?: number;
}

export class ScrapingBeeScraper {
  private apiKey: string;
  private baseUrl = 'https://app.scrapingbee.com/api/v1/';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async scrapeUrl(url: string, options: Partial<ScrapingBeeConfig> = {}): Promise<string> {
    console.log(`🐝 ScrapingBee: Scraping ${url}`);
    
    const config: ScrapingBeeConfig = {
      url,
      premium_proxy: true,
      country_code: 'IN', // Use Indian proxies for better success with Indian sites
      render_js: false, // Most HR sites don't need JS rendering
      block_ads: true,
      block_resources: false,
      wait: 1000, // Wait 1 second for page to load
      ...options
    };

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          ...config
        },
        timeout: 30000, // 30 second timeout for ScrapingBee
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (response.status === 200) {
        console.log(`✅ ScrapingBee: Successfully scraped ${url}`);
        return response.data;
      } else {
        throw new Error(`ScrapingBee returned status ${response.status}`);
      }

    } catch (error: any) {
      console.error(`❌ ScrapingBee failed for ${url}:`, error.message);
      
      // Fallback to direct scraping
      console.log(`🔄 Falling back to direct scraping for ${url}`);
      return await this.directScrape(url);
    }
  }

  private async directScrape(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      console.log(`✅ Direct scraping successful for ${url}`);
      return response.data;

    } catch (error: any) {
      console.error(`❌ Direct scraping also failed for ${url}:`, error.message);
      return '';
    }
  }

  async extractContent(html: string, url: string): Promise<{title: string, content: string, author?: string}> {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, footer, .advertisement, .ads, .popup, .modal, .sidebar').remove();
    
    let title = '';
    let content = '';
    let author = '';

    // Extract title
    title = $('h1').first().text().trim() || 
            $('title').text().trim() || 
            $('.article-title, .post-title, .entry-title').first().text().trim();

    // Extract author
    author = $('.author, .by-author, .article-author, [rel="author"]').first().text().trim() || 
             $('meta[name="author"]').attr('content') || '';

    // Extract main content - try multiple selectors
    const contentSelectors = [
      '.article-content',
      '.post-content', 
      '.entry-content',
      '.main-content',
      '.content',
      '.story-body',
      '[role="main"]',
      'main',
      '.container .row .col-md-8', // Common Bootstrap layout
      '.container .row .col-lg-8'
    ];

    for (const selector of contentSelectors) {
      const extracted = $(selector).first().text().trim();
      if (extracted && extracted.length > 200) {
        content = extracted;
        break;
      }
    }

    // Fallback: get all paragraphs
    if (!content || content.length < 100) {
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get().join(' ');
      if (paragraphs.length > 100) {
        content = paragraphs;
      }
    }

    // Final fallback: body text but filter out navigation/footer content
    if (!content || content.length < 50) {
      const bodyText = $('body').text().trim();
      content = this.cleanContent(bodyText);
    }

    return {
      title: this.cleanTitle(title),
      content: this.cleanContent(content),
      author: this.cleanAuthor(author)
    };
  }

  async scrapeArticle(url: string): Promise<RawContentItem | null> {
    try {
      console.log(`📰 Scraping full article: ${url}`);
      
      const html = await this.scrapeUrl(url);
      if (!html) {
        console.error(`❌ No HTML content received for ${url}`);
        return null;
      }

      const extracted = await this.extractContent(html, url);
      
      if (!extracted.title && !extracted.content) {
        console.error(`❌ No meaningful content extracted from ${url}`);
        return null;
      }

      // Determine categories based on URL and content
      const categories = this.categorizeContent(url, extracted.title + ' ' + extracted.content);

      return {
        title: extracted.title || 'Untitled Article',
        url: url,
        author: extracted.author || 'Unknown',
        published_at: new Date(), // Will be updated if we can extract date
        categories: categories,
        snippet: extracted.content.length > 200 ? 
                extracted.content.substring(0, 200) + '...' : 
                extracted.content,
        full_content: extracted.content
      };

    } catch (error: any) {
      console.error(`❌ Article scraping failed for ${url}:`, error.message);
      return null;
    }
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,()'"]/g, '')
      .trim()
      .substring(0, 200);
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .trim();
  }

  private cleanAuthor(author: string): string {
    return author
      .replace(/By:?\s*/i, '')
      .replace(/Author:?\s*/i, '')
      .trim()
      .substring(0, 100);
  }

  private categorizeContent(url: string, text: string): string[] {
    const categories: string[] = [];
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    // URL-based categorization
    if (lowerUrl.includes('pib.gov.in')) categories.push('government');
    if (lowerUrl.includes('peoplematters')) categories.push('hr-media');
    if (lowerUrl.includes('hrkatha')) categories.push('hr-media');
    if (lowerUrl.includes('economictimes')) categories.push('business-media');

    // Content-based categorization
    if (lowerText.includes('recruitment') || lowerText.includes('hiring')) categories.push('recruitment');
    if (lowerText.includes('attrition') || lowerText.includes('retention')) categories.push('attrition');
    if (lowerText.includes('remote work') || lowerText.includes('work from home')) categories.push('remote_work');
    if (lowerText.includes('ai') || lowerText.includes('artificial intelligence')) categories.push('hrtech');
    if (lowerText.includes('diversity') || lowerText.includes('inclusion')) categories.push('diversity');
    if (lowerText.includes('learning') || lowerText.includes('training')) categories.push('learning');
    if (lowerText.includes('engagement') || lowerText.includes('employee satisfaction')) categories.push('engagement');
    if (lowerText.includes('wellbeing') || lowerText.includes('mental health')) categories.push('wellbeing');
    if (lowerText.includes('leadership') || lowerText.includes('management')) categories.push('leadership');

    return categories.length > 0 ? categories : ['general'];
  }

  async checkApiQuota(): Promise<{remaining: number, total: number}> {
    try {
      const response = await axios.get('https://app.scrapingbee.com/api/v1/usage', {
        params: {
          api_key: this.apiKey
        }
      });

      return {
        remaining: response.data.max_api_credit - response.data.used_api_credit,
        total: response.data.max_api_credit
      };
    } catch (error) {
      console.error('❌ Failed to check ScrapingBee quota:', error);
      return { remaining: 0, total: 0 };
    }
  }
}

// Enhanced PIB scraper using ScrapingBee
export class EnhancedPIBScraper {
  private scrapingBee: ScrapingBeeScraper;
  private baseUrl = 'https://pib.gov.in';
  private labourMinistryUrl = 'https://pib.gov.in/PressRelease.aspx?MinId=7';

  constructor(scrapingBeeApiKey: string) {
    this.scrapingBee = new ScrapingBeeScraper(scrapingBeeApiKey);
  }

  async scrape(): Promise<RawContentItem[]> {
    console.log('🏛️ Enhanced PIB scraping with ScrapingBee...');
    
    try {
      const html = await this.scrapingBee.scrapeUrl(this.labourMinistryUrl, {
        render_js: false,
        wait: 2000 // PIB might be slow
      });

      if (!html) {
        console.error('❌ Failed to get PIB page content');
        return [];
      }

      const $ = cheerio.load(html);
      const items: RawContentItem[] = [];

      // Use the same selectors as original PIB scraper
      const selectors = [
        'a[href*="PressReleaseDetailm"]',
        'a[href*="PRID"]',
        '.container .row .col-md-12 a'
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} PIB items with selector: ${selector}`);
          
          const promises: Promise<RawContentItem | null>[] = [];
          elements.each((i, element) => {
            if (i >= 8) return false; // Limit to 8 items to save API quota
            
            const $el = $(element);
            const title = $el.text().trim();
            const url = $el.attr('href') || '';
            const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
            
            if (title && title.length > 10 && url) {
              promises.push(this.scrapingBee.scrapeArticle(fullUrl));
            }
          });

          const results = await Promise.all(promises);
          const validResults = results.filter(item => item !== null) as RawContentItem[];
          
          // Add PIB-specific metadata
          validResults.forEach(item => {
            item.author = 'Ministry of Labour & Employment';
            item.categories = [...(item.categories || []), 'government', 'policy'];
          });

          items.push(...validResults);
          break;
        }
      }

      console.log(`✅ Enhanced PIB scraping completed: ${items.length} items`);
      return items;

    } catch (error) {
      console.error('❌ Enhanced PIB scraping failed:', error);
      return [];
    }
  }
}