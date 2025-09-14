import axios from 'axios';
import { RawContentItem } from '../types';
import { ScrapingBeeScraper } from '../scrapers/scrapingbee-scraper';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  language?: string;
  locations?: string[];
}

interface BraveSearchResponse {
  web: {
    results: BraveSearchResult[];
  };
}

export class BraveScrapingBeeCollector {
  private braveApiKey: string;
  private scrapingBee: ScrapingBeeScraper;
  private braveBaseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(braveApiKey: string, scrapingBeeApiKey: string) {
    this.braveApiKey = braveApiKey;
    this.scrapingBee = new ScrapingBeeScraper(scrapingBeeApiKey);
  }

  async collectHRContent(queries: string[], maxResultsPerQuery: number = 5): Promise<RawContentItem[]> {
    console.log('🔍 Starting Brave Search + ScrapingBee collection...');
    
    const allResults: RawContentItem[] = [];
    
    for (const query of queries) {
      console.log(`🎯 Searching for: "${query}"`);
      
      try {
        // Search for query results
        const searchResults = await this.braveSearch(query, maxResultsPerQuery);
        console.log(`📊 Found ${searchResults.length} results for "${query}"`);
        
        // Scrape full content using ScrapingBee
        const scrapePromises = searchResults.map(result => 
          this.scrapeSearchResult(result, query)
        );
        
        const scrapedResults = await Promise.all(scrapePromises);
        const validResults = scrapedResults.filter(result => result !== null) as RawContentItem[];
        
        console.log(`✅ Successfully scraped ${validResults.length} articles for "${query}"`);
        allResults.push(...validResults);
        
        // Small delay between queries to be respectful
        await this.delay(1000);
        
      } catch (error: any) {
        console.error(`❌ Error collecting content for query "${query}":`, error.message);
      }
    }
    
    console.log(`🎉 Total collection complete: ${allResults.length} articles from ${queries.length} queries`);
    return allResults;
  }


  private async braveSearch(query: string, count: number): Promise<BraveSearchResult[]> {
    try {
      const params = {
        q: `${query} site:india OR site:.in`,
        count: count,
        offset: 0,
        mkt: 'en-IN',
        safesearch: 'moderate',
        textDecorations: false,
        textFormat: 'raw'
      };

      const response = await axios.get(this.braveBaseUrl, {
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip'
        },
        params,
        timeout: 10000
      });

      if (response.data?.web?.results) {
        return response.data.web.results.filter((result: BraveSearchResult) => {
          // Only filter out social media and obvious spam
          const url = result.url.toLowerCase();
          const skipSites = ['facebook.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'instagram.com'];
          
          return !skipSites.some(site => url.includes(site));
        });
      }

      return [];
    } catch (error: any) {
      console.error('❌ Brave Search API error:', error.message);
      return [];
    }
  }

  private async scrapeSearchResult(searchResult: BraveSearchResult, originalQuery: string): Promise<RawContentItem | null> {
    try {
      console.log(`🐝 Scraping: ${searchResult.title.substring(0, 50)}...`);
      
      const article = await this.scrapingBee.scrapeArticle(searchResult.url);
      
      if (article) {
        // Enhance with search context
        article.categories = [...(article.categories || []), 'search-result'];
        article.snippet = searchResult.description || article.snippet;
        
        // Add search metadata
        (article as any).search_query = originalQuery;
        (article as any).search_rank = searchResult.url;
        
        return article;
      }
      
      return null;
      
    } catch (error: any) {
      console.error(`❌ Failed to scrape ${searchResult.url}:`, error.message);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkQuotas(): Promise<{brave: any, scrapingBee: {remaining: number, total: number}}> {
    console.log('📊 Checking API quotas...');
    
    const scrapingBeeQuota = await this.scrapingBee.checkApiQuota();
    
    // Brave doesn't have a direct quota check endpoint, but we can estimate
    const braveQuota = {
      note: 'Brave Search quota depends on your subscription plan',
      status: 'Check Brave Search dashboard for usage'
    };
    
    return {
      brave: braveQuota,
      scrapingBee: scrapingBeeQuota
    };
  }
}

// HR-specific search queries for India
export const HR_SEARCH_QUERIES = [
  'HR trends India 2024',
  'employee attrition rate India',
  'remote work policy India companies',
  'HR technology adoption India',
  'talent retention strategies India',
  'workplace diversity inclusion India',
  'employee engagement survey India',
  'HR analytics India',
  'recruitment challenges India IT',
  'learning development programs India',
  'employee wellbeing initiatives India',
  'HR compliance regulations India',
  'performance management trends India',
  'compensation benefits trends India',
  'future of work India HR'
];

