import axios from 'axios';
import * as cheerio from 'cheerio';
import { RawContentItem } from '../types';

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
  guid?: string;
}

interface RSSFeed {
  title: string;
  link: string;
  description: string;
  items: RSSItem[];
}

export class RSSParser {
  constructor() {}

  async parseRSSFeed(url: string, sourceName: string): Promise<RawContentItem[]> {
    const startTime = Date.now();
    console.log(`🔍 Fetching RSS feed: ${sourceName} from ${url}`);
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HR-Research-Bot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
        },
        timeout: 15000
      });

      const feedData = this.parseXML(response.data);
      const items: RawContentItem[] = [];

      console.log(`📰 Found ${feedData.items.length} items in ${sourceName} RSS feed`);

      for (const item of feedData.items.slice(0, 15)) { // Limit to 15 items
        const content = await this.extractContentFromDescription(item.description || '');
        
        items.push({
          title: this.cleanText(item.title),
          url: item.link,
          content: content,
          snippet: this.createSnippet(content || item.description || ''),
          author: item.author || sourceName,
          published_at: this.parseDate(item.pubDate),
          categories: this.extractCategories(item, sourceName)
        });

        console.log(`📄 Processed: ${item.title.substring(0, 60)}...`);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ ${sourceName} RSS parsing completed: ${items.length} items in ${duration}ms`);

      return items;

    } catch (error) {
      console.error(`❌ Failed to parse RSS feed for ${sourceName}:`, error);
      
      // Fallback: try to scrape the main site if RSS fails
      console.log(`🔄 Attempting fallback scraping for ${sourceName}...`);
      return await this.fallbackScraping(url, sourceName);
    }
  }

  private parseXML(xmlString: string): RSSFeed {
    const $ = cheerio.load(xmlString, { xmlMode: true });
    
    const feed: RSSFeed = {
      title: $('channel > title').first().text() || $('feed > title').first().text(),
      link: $('channel > link').first().text() || $('feed > link').attr('href') || '',
      description: $('channel > description').first().text() || $('feed > subtitle').first().text(),
      items: []
    };

    // Parse RSS 2.0 format
    $('item').each((i, element) => {
      const $item = $(element);
      
      const item: RSSItem = {
        title: $item.find('title').text(),
        link: $item.find('link').text(),
        description: $item.find('description').text(),
        pubDate: $item.find('pubDate').text(),
        author: $item.find('author').text() || $item.find('dc\\:creator').text(),
        guid: $item.find('guid').text()
      };

      // Extract categories
      const categories: string[] = [];
      $item.find('category').each((j, cat) => {
        categories.push($(cat).text());
      });
      item.categories = categories;

      if (item.title && item.link) {
        feed.items.push(item);
      }
    });

    // Parse Atom format if no RSS items found
    if (feed.items.length === 0) {
      $('entry').each((i, element) => {
        const $item = $(element);
        
        const item: RSSItem = {
          title: $item.find('title').text(),
          link: $item.find('link').attr('href') || '',
          description: $item.find('summary').text() || $item.find('content').text(),
          pubDate: $item.find('published').text() || $item.find('updated').text(),
          author: $item.find('author name').text(),
          guid: $item.find('id').text()
        };

        if (item.title && item.link) {
          feed.items.push(item);
        }
      });
    }

    return feed;
  }

  private async extractContentFromDescription(description: string): Promise<string> {
    if (!description) return '';
    
    // Clean HTML from description
    const $ = cheerio.load(description);
    
    // Remove unwanted elements
    $('script, style, img').remove();
    
    const text = $.text().trim();
    return this.cleanText(text);
  }

  private async fallbackScraping(rssUrl: string, sourceName: string): Promise<RawContentItem[]> {
    try {
      // Derive main site URL from RSS URL
      const baseUrl = new URL(rssUrl).origin;
      let siteUrl = baseUrl;
      
      // Specific fallback URLs for known sites
      if (sourceName.includes('peoplematters')) {
        siteUrl = 'https://www.peoplematters.in/news';
      } else if (sourceName.includes('hrkatha')) {
        siteUrl = 'https://hrkatha.com/category/news/';
      }
      
      console.log(`🔍 Scraping fallback from: ${siteUrl}`);
      
      const response = await axios.get(siteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: RawContentItem[] = [];

      // Generic article selectors
      const articleSelectors = [
        'article',
        '.post',
        '.news-item',
        '.article-item',
        'a[href*="/article/"]',
        'a[href*="/news/"]',
        'h2 a, h3 a'
      ];

      for (const selector of articleSelectors) {
        const elements = $(selector);
        
        if (elements.length > 0) {
          console.log(`Found ${elements.length} articles with selector: ${selector}`);
          
          elements.each((i, element) => {
            if (i >= 10) return false; // Limit to 10 items
            
            const $el = $(element);
            let title = '';
            let url = '';
            
            if ($el.is('a')) {
              title = $el.text().trim();
              url = $el.attr('href') || '';
            } else {
              const link = $el.find('a').first();
              title = link.text().trim() || $el.find('h2, h3, .title').text().trim();
              url = link.attr('href') || '';
            }
            
            if (title && title.length > 10 && url) {
              const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
              
              items.push({
                title: this.cleanText(title),
                url: fullUrl,
                author: sourceName,
                published_at: new Date(),
                categories: ['hr', 'news'],
                snippet: title.substring(0, 150)
              });
            }
          });
          
          break; // Stop after first successful selector
        }
      }

      console.log(`✅ Fallback scraping found ${items.length} items`);
      return items;

    } catch (error) {
      console.error(`❌ Fallback scraping failed for ${sourceName}:`, error);
      return [];
    }
  }

  private extractCategories(item: RSSItem, sourceName: string): string[] {
    const categories = new Set<string>();
    
    // Add source-based categories
    if (sourceName.includes('peoplematters')) {
      categories.add('hr_media');
      categories.add('people_matters');
    } else if (sourceName.includes('hrkatha')) {
      categories.add('hr_media');
      categories.add('hr_katha');
    }
    
    // Add from RSS categories
    if (item.categories) {
      item.categories.forEach(cat => categories.add(cat.toLowerCase().replace(/\s+/g, '_')));
    }
    
    // Extract from title and description
    const text = `${item.title} ${item.description || ''}`.toLowerCase();
    
    if (text.includes('attrition') || text.includes('turnover')) categories.add('attrition');
    if (text.includes('hiring') || text.includes('recruitment')) categories.add('hiring');
    if (text.includes('salary') || text.includes('compensation')) categories.add('compensation');
    if (text.includes('remote') || text.includes('wfh')) categories.add('remote_work');
    if (text.includes('ai') || text.includes('technology')) categories.add('hr_tech');
    if (text.includes('india') || text.includes('indian')) categories.add('india');
    
    return Array.from(categories);
  }

  private parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    
    try {
      // Handle RSS date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      console.warn(`Failed to parse RSS date: ${dateStr}`);
    }
    
    return new Date();
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,()'"]/g, '')
      .trim();
  }

  private createSnippet(content: string): string {
    const cleaned = content.replace(/<[^>]*>/g, '').trim();
    return cleaned.length > 300 ? cleaned.substring(0, 300) + '...' : cleaned;
  }
}

// Pre-configured RSS feeds
export const RSS_FEEDS = {
  peoplematters: {
    name: 'PeopleMatters',
    urls: [
      'https://www.peoplematters.in/rss/feed',
      'https://www.peoplematters.in/feed',
      'https://feeds.feedburner.com/PeopleMatters' // Alternative feed
    ]
  },
  hrkatha: {
    name: 'HR Katha',
    urls: [
      'https://hrkatha.com/feed',
      'https://www.hrkatha.com/rss',
      'https://hrkatha.com/category/news/feed'
    ]
  }
};