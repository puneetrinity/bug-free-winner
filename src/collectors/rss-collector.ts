import FeedParser from 'feedparser';
import axios from 'axios';
import { Readable } from 'stream';
import crypto from 'crypto';
import { RSS_SOURCES, RSSSource } from '../config/rss-sources';
import { RawContentItem } from '../types';

// Removed unused interface - using RawContentItem instead

export class RSSCollector {
  private sources: RSSSource[];

  constructor(sources?: RSSSource[]) {
    this.sources = sources || RSS_SOURCES;
  }

  async collectFromAllFeeds(): Promise<{ articles: RawContentItem[], stats: { [key: string]: number } }> {
    console.log(`📡 Starting RSS collection from ${this.sources.length} feeds...`);
    
    const allArticles: RawContentItem[] = [];
    const stats: { [key: string]: number } = {};
    
    for (const source of this.sources) {
      try {
        const articles = await this.collectFromFeed(source);
        allArticles.push(...articles);
        stats[source.name] = articles.length;
        console.log(`  ✅ ${source.name}: ${articles.length} articles`);
      } catch (error) {
        console.error(`  ❌ ${source.name}: Failed to collect`, error instanceof Error ? error.message : error);
        stats[source.name] = 0;
      }
    }
    
    console.log(`📊 Total RSS articles collected: ${allArticles.length}`);
    return { articles: allArticles, stats };
  }

  async collectFromFeed(source: RSSSource): Promise<RawContentItem[]> {
    return new Promise((resolve, reject) => {
      this.fetchAndParseRSS(source, resolve, reject);
    });
  }

  private async fetchAndParseRSS(source: RSSSource, resolve: (value: RawContentItem[]) => void, reject: (reason?: any) => void): Promise<void> {
    const articles: RawContentItem[] = [];
    
    try {
      // Fetch RSS feed
      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HRResearchBot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      
      // Parse RSS feed
      const feedparser = new FeedParser({
        normalize: true,
        addmeta: false
      });
      
      feedparser.on('error', (error: Error) => {
        reject(error);
      });
      
      feedparser.on('readable', function(this: FeedParser) {
        let item;
        while ((item = this.read())) {
          const article = parseRSSItem(item, source);
          if (article) {
            articles.push(article);
          }
        }
      });
      
      feedparser.on('end', () => {
        resolve(articles);
      });
      
      // Convert response to stream and pipe to feedparser
      const stream = new Readable();
      stream.push(response.data);
      stream.push(null);
      stream.pipe(feedparser);
      
    } catch (error) {
      reject(error);
    }
  }

  async collectByCategory(category: string): Promise<RawContentItem[]> {
    const categoryFeeds = this.sources.filter(s => s.category === category);
    console.log(`📡 Collecting from ${categoryFeeds.length} ${category} feeds...`);
    
    const allArticles: RawContentItem[] = [];
    
    for (const source of categoryFeeds) {
      try {
        const articles = await this.collectFromFeed(source);
        allArticles.push(...articles);
      } catch (error) {
        console.error(`Failed to collect from ${source.name}:`, error);
      }
    }
    
    return allArticles;
  }

  async collectHighPriority(): Promise<RawContentItem[]> {
    const priorityFeeds = this.sources.filter(s => s.priority === 1);
    console.log(`⭐ Collecting from ${priorityFeeds.length} high-priority feeds...`);
    
    const allArticles: RawContentItem[] = [];
    
    for (const source of priorityFeeds) {
      try {
        const articles = await this.collectFromFeed(source);
        allArticles.push(...articles);
      } catch (error) {
        console.error(`Failed to collect from ${source.name}:`, error);
      }
    }
    
    return allArticles;
  }
}

function parseRSSItem(item: any, source: RSSSource): RawContentItem | null {
  try {
    // Extract and clean description
    let description = item.description || item.summary || '';
    description = description.replace(/<[^>]*>/g, ''); // Remove HTML tags
    description = description.replace(/&nbsp;/g, ' '); // Replace &nbsp;
    description = description.replace(/\s+/g, ' ').trim(); // Clean whitespace
    
    // Extract image URL from various RSS fields
    let imageUrl = null;
    
    // Try enclosures first (most reliable)
    if (item.enclosures && item.enclosures.length > 0) {
      const imageEnclosure = item.enclosures.find((enc: any) => 
        enc.type && enc.type.startsWith('image/')
      );
      if (imageEnclosure && imageEnclosure.url) {
        imageUrl = imageEnclosure.url;
      }
    }
    
    // Try description images
    if (!imageUrl && item.description) {
      const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }
    
    // Try media fields - feedparser handles namespaced attributes differently
    if (!imageUrl && item['media:thumbnail']) {
      if (typeof item['media:thumbnail'] === 'string') {
        imageUrl = item['media:thumbnail'];
      } else if (item['media:thumbnail'].url) {
        imageUrl = item['media:thumbnail'].url;
      } else if (item['media:thumbnail']['@'] && item['media:thumbnail']['@'].url) {
        imageUrl = item['media:thumbnail']['@'].url;
      }
    }
    
    // Try media:content (ET HR World format) - feedparser may flatten attributes
    if (!imageUrl && item['media:content']) {
      if (typeof item['media:content'] === 'string') {
        imageUrl = item['media:content'];
      } else if (item['media:content'].url) {
        imageUrl = item['media:content'].url;
      } else if (item['media:content']['@'] && item['media:content']['@'].url) {
        imageUrl = item['media:content']['@'].url;
      } else if (Array.isArray(item['media:content']) && item['media:content'][0]) {
        const mediaContent = item['media:content'][0];
        if (mediaContent.url) {
          imageUrl = mediaContent.url;
        } else if (mediaContent['@'] && mediaContent['@'].url) {
          imageUrl = mediaContent['@'].url;
        }
      }
    }
    
    // Alternative: try direct property access patterns that feedparser might use
    if (!imageUrl) {
      const possibleKeys = ['media$content', 'media_content', 'mediacontent'];
      for (const key of possibleKeys) {
        if (item[key] && item[key].url) {
          imageUrl = item[key].url;
          break;
        }
      }
    }
    
    // Try item image field
    if (!imageUrl && item.image && item.image.url) {
      imageUrl = item.image.url;
    }
    
    // Try content:encoded
    if (!imageUrl && item['content:encoded']) {
      const imgMatch = item['content:encoded'].match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }
    
    // Generate content hash from URL or GUID
    const uniqueId = item.link || item.guid || `${item.title}-${item.pubDate}`;
    const contentHash = crypto.createHash('md5').update(uniqueId).digest('hex');
    
    const rawItem: RawContentItem & { metadata?: any; content_hash?: string; image_url?: string } = {
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      snippet: description.substring(0, 500),
      full_content: description,
      published_at: item.pubDate ? new Date(item.pubDate) : undefined,
      author: item.author || source.name,
      categories: item.categories || [source.category]
    };
    
    // Add metadata as extended properties
    (rawItem as any).content_hash = contentHash;
    (rawItem as any).image_url = imageUrl;
    (rawItem as any).metadata = {
      source_name: source.name,
      source_group: source.source_group,
      rss_category: source.category,
      priority: source.priority,
      guid: item.guid
    };
    
    return rawItem;
  } catch (error) {
    console.error('Error parsing RSS item:', error);
    return null;
  }
}