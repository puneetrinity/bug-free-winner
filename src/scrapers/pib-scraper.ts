import axios from 'axios';
import * as cheerio from 'cheerio';
import { RawContentItem } from '../types';

export class PIBScraper {
  private baseUrl = 'https://pib.gov.in';
  private labourMinistryUrl = 'https://pib.gov.in/PressRelease.aspx?MinId=7';
  
  constructor() {}

  async scrape(): Promise<RawContentItem[]> {
    const startTime = Date.now();
    console.log('🔍 Starting PIB Labour Ministry scraping...');
    
    try {
      // Get the main page with press releases
      const response = await axios.get(this.labourMinistryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: RawContentItem[] = [];

      console.log('📄 Parsing PIB press releases...');

      // PIB uses different selectors - let's find the press release items
      // Try multiple possible selectors
      const selectors = [
        '.content-area .press-release',
        '.main-content .release-item',
        '.press-list .press-item',
        '.container .row .col-md-12 a',
        'a[href*="PressReleaseDetailm"]',
        'a[href*="PRID"]'
      ];

      let foundItems = false;
      
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} items with selector: ${selector}`);
          foundItems = true;
          
          elements.each((i, element) => {
            if (i >= 10) return false; // Limit to 10 items
            
            const $el = $(element);
            let title = '';
            let url = '';
            let dateText = '';
            
            // Extract title and URL
            if ($el.is('a')) {
              title = $el.text().trim();
              url = $el.attr('href') || '';
            } else {
              const link = $el.find('a').first();
              title = link.text().trim() || $el.find('.title, h3, h4').text().trim();
              url = link.attr('href') || '';
            }
            
            // Extract date
            dateText = $el.find('.date, .press-date, .publish-date').text().trim();
            if (!dateText) {
              // Try to extract from parent or sibling elements
              dateText = $el.parent().find('.date').text().trim() || 
                         $el.siblings('.date').text().trim();
            }
            
            if (title && title.length > 10 && url) {
              const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
              
              items.push({
                title: this.cleanTitle(title),
                url: fullUrl,
                author: 'Ministry of Labour & Employment',
                published_at: this.parseDate(dateText),
                categories: ['government', 'policy', 'labour'],
                snippet: title.length > 150 ? title.substring(0, 150) + '...' : title
              });
              
              console.log(`📰 Found: ${title.substring(0, 60)}...`);
            }
          });
          
          break; // Stop after finding items with first successful selector
        }
      }
      
      if (!foundItems) {
        console.log('⚠️ No items found with standard selectors, trying fallback...');
        
        // Fallback: Look for any links containing labour-related keywords
        const allLinks = $('a').filter((i, el) => {
          const text = $(el).text().toLowerCase();
          const href = $(el).attr('href') || '';
          return (
            (text.includes('labour') || text.includes('employment') || 
             text.includes('worker') || text.includes('epfo') || 
             text.includes('esi')) &&
            href.includes('PRID') &&
            text.length > 10
          );
        });
        
        console.log(`🔍 Found ${allLinks.length} labour-related links as fallback`);
        
        allLinks.each((i, element) => {
          if (i >= 8) return false; // Limit fallback to 8 items
          
          const $el = $(element);
          const title = $el.text().trim();
          const url = $el.attr('href') || '';
          const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
          
          items.push({
            title: this.cleanTitle(title),
            url: fullUrl,
            author: 'Ministry of Labour & Employment',
            published_at: new Date(), // Use current date as fallback
            categories: ['government', 'policy', 'labour'],
            snippet: title.length > 150 ? title.substring(0, 150) + '...' : title
          });
          
          console.log(`📰 Fallback found: ${title.substring(0, 60)}...`);
        });
      }

      const duration = Date.now() - startTime;
      console.log(`✅ PIB scraping completed: ${items.length} items in ${duration}ms`);
      
      return items;

    } catch (error) {
      console.error('❌ PIB scraping failed:', error);
      return [];
    }
  }

  async fetchFullContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, footer, .advertisement, .ads').remove();
      
      // Try different content selectors for PIB
      const contentSelectors = [
        '.press-content',
        '.main-content',
        '.content-area',
        '.container .row .col-md-12',
        '#content',
        '.post-content'
      ];
      
      for (const selector of contentSelectors) {
        const content = $(selector).first().text().trim();
        if (content && content.length > 200) {
          return this.cleanContent(content);
        }
      }
      
      // Fallback: get body text
      const bodyContent = $('body').text().trim();
      return this.cleanContent(bodyContent);
      
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
      return '';
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
      .trim();
  }

  private parseDate(dateText: string): Date {
    if (!dateText) return new Date();
    
    // Try to parse various Indian date formats
    const patterns = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,      // YYYY/MM/DD or YYYY-MM-DD
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i
    ];
    
    for (const pattern of patterns) {
      const match = dateText.match(pattern);
      if (match) {
        try {
          let date: Date;
          if (pattern.toString().includes('Jan|Feb')) {
            // Month name format
            const day = parseInt(match[1]);
            const monthName = match[2];
            const year = parseInt(match[3]);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames.indexOf(monthName.substring(0, 3));
            date = new Date(year, month, day);
          } else if (match[3]) {
            // DD/MM/YYYY format (assuming Indian format)
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1; // JS months are 0-indexed
            const year = parseInt(match[3]);
            date = new Date(year, month, day);
          } else {
            date = new Date(dateText);
          }
          
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (e) {
          console.warn(`Failed to parse date: ${dateText}`);
        }
      }
    }
    
    return new Date(); // Fallback to current date
  }
}