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
    
    // First, let's test with a simple query to verify API works
    await this.testBraveAPI();
    
    const allResults: RawContentItem[] = [];
    
    for (const query of queries) {
      console.log(`🎯 Searching for: "${query}"`);
      
      try {
        // Try both restricted and unrestricted searches
        let searchResults = await this.braveSearch(query, maxResultsPerQuery);
        
        // If no results with site restriction, try without it
        if (searchResults.length === 0) {
          console.log('🔄 No results with site restriction, trying broader search...');
          searchResults = await this.braveSearchBroad(query, maxResultsPerQuery);
        }
        
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
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error collecting content for query "${query}":`, errorMessage);
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

      console.log('🔍 Brave Search Request:');
      console.log(`   URL: ${this.braveBaseUrl}`);
      console.log(`   Query: "${params.q}"`);
      console.log(`   Count: ${params.count}`);
      console.log(`   API Key: ${this.braveApiKey ? 'Present' : 'Missing'}`);

      const response = await axios.get(this.braveBaseUrl, {
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip'
        },
        params,
        timeout: 10000
      });

      console.log('📊 Brave Search Response:');
      console.log(`   Status: ${response.status}`);
      console.log('   Response structure:', {
        hasWeb: !!response.data?.web,
        hasResults: !!response.data?.web?.results,
        resultCount: response.data?.web?.results?.length || 0,
        errorMessage: response.data?.error?.message || 'None'
      });
      
      // Log actual response for debugging
      if (!response.data?.web?.results) {
        console.log('⚠️ Full response data:', JSON.stringify(response.data, null, 2));
      }

      if (response.data?.web?.results) {
        const results = response.data.web.results.filter((result: BraveSearchResult) => {
          // Only filter out social media and obvious spam
          const url = result.url.toLowerCase();
          const skipSites = ['facebook.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'instagram.com'];
          
          return !skipSites.some(site => url.includes(site));
        });
        
        console.log(`✅ Filtered results: ${results.length} (removed ${response.data.web.results.length - results.length} social media)`);
        return results;
      }

      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Brave Search API error:', errorMessage);
      
      // Log additional error details for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: unknown; statusText?: string } };
        console.error('   HTTP Status:', axiosError.response?.status);
        console.error('   Status Text:', axiosError.response?.statusText);
        console.error('   Response Data:', JSON.stringify(axiosError.response?.data, null, 2));
      }
      
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
        (article as unknown as Record<string, unknown>).search_query = originalQuery;
        (article as unknown as Record<string, unknown>).search_rank = searchResult.url;
        
        return article;
      }
      
      return null;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to scrape ${searchResult.url}:`, errorMessage);
      return null;
    }
  }

  private async braveSearchBroad(query: string, count: number): Promise<BraveSearchResult[]> {
    try {
      const params = {
        q: query, // No site restriction
        count: count,
        offset: 0,
        mkt: 'en-IN',
        safesearch: 'moderate',
        textDecorations: false,
        textFormat: 'raw'
      };

      console.log(`🌍 Broad Brave Search Request: "${params.q}"`);

      const response = await axios.get(this.braveBaseUrl, {
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip'
        },
        params,
        timeout: 10000
      });

      console.log(`🌍 Broad search - Status: ${response.status}, Results: ${response.data?.web?.results?.length || 0}`);

      if (response.data?.web?.results) {
        const results = response.data.web.results.filter((result: BraveSearchResult) => {
          const url = result.url.toLowerCase();
          const skipSites = ['facebook.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'instagram.com'];
          return !skipSites.some(site => url.includes(site));
        });
        
        return results;
      }

      return [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Broad Brave Search API error:', errorMessage);
      return [];
    }
  }
  
  private async testBraveAPI(): Promise<void> {
    console.log('🧪 Testing Brave API with simple query...');
    try {
      const testResults = await this.braveSearchBroad('test', 1);
      console.log(`🧪 API Test Result: ${testResults.length > 0 ? 'SUCCESS' : 'NO RESULTS'} - Found ${testResults.length} results`);
      if (testResults.length > 0) {
        console.log(`🧪 Sample result: ${testResults[0].title}`);
      }
    } catch (error) {
      console.error('🧪 API Test FAILED:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkQuotas(): Promise<{brave: unknown, scrapingBee: {remaining: number, total: number}}> {
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

