// Comprehensive RSS feed configuration for HR domain in India
// Verified sources - September 2025

export interface RSSSource {
  name: string;
  url: string;
  category: 'general' | 'technology' | 'recruitment' | 'analytics' | 'leadership' | 'diversity' | 'wellbeing' | 'jobs' | 'business';
  source_group: 'et_hr' | 'indian_express' | 'toi' | 'google_news' | 'global_hr' | 'government' | 'indian_hr_blogs';
  priority: 1 | 2 | 3;
  update_frequency: 'hourly' | 'daily' | 'weekly';
}

export const RSS_SOURCES: RSSSource[] = [
  // Economic Times HR World - Top Priority
  {
    name: 'ET HR World - Top Stories',
    url: 'https://hr.economictimes.indiatimes.com/rss/topstories',
    category: 'general',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'hourly'
  },
  {
    name: 'ET HR World - AI in HR',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/ai-in-hr',
    category: 'technology',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - HR Analytics',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/hr-analytics',
    category: 'analytics',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Leadership',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/leadership',
    category: 'leadership',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Recruitment',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/recruitment',
    category: 'recruitment',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Talent Management',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/talent-management',
    category: 'recruitment',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Diversity & Inclusion',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/diversity-and-inclusion',
    category: 'diversity',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Employee Wellbeing',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/employee-wellbeing',
    category: 'wellbeing',
    source_group: 'et_hr',
    priority: 1,
    update_frequency: 'daily'
  },

  // Indian Express Jobs
  {
    name: 'Indian Express - Jobs',
    url: 'https://indianexpress.com/section/jobs/feed/',
    category: 'jobs',
    source_group: 'indian_express',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Indian Express - Bank Jobs',
    url: 'https://indianexpress.com/section/jobs/bank-jobs/feed/',
    category: 'jobs',
    source_group: 'indian_express',
    priority: 2,
    update_frequency: 'daily'
  },

  // Times of India
  {
    name: 'Times of India - Business',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms',
    category: 'business',
    source_group: 'toi',
    priority: 2,
    update_frequency: 'hourly'
  },

  // Google News Targeted Feeds
  {
    name: 'Google News - HR India',
    url: 'https://news.google.com/rss/search?q=HR+news+India',
    category: 'general',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'hourly'
  },
  {
    name: 'Google News - Attrition India',
    url: 'https://news.google.com/rss/search?q=attrition+rate+India',
    category: 'analytics',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - Remote Work India',
    url: 'https://news.google.com/rss/search?q=remote+work+India+policy',
    category: 'general',
    source_group: 'google_news',
    priority: 2,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - AI HR Technology',
    url: 'https://news.google.com/rss/search?q=AI+HR+technology+India',
    category: 'technology',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - Employee Engagement India',
    url: 'https://news.google.com/rss/search?q=employee+engagement+India',
    category: 'wellbeing',
    source_group: 'google_news',
    priority: 2,
    update_frequency: 'daily'
  },

  // Additional Indian HR Publications
  {
    name: 'HRKatha - HR News India',
    url: 'https://www.hrkatha.com/feed/',
    category: 'general',
    source_group: 'indian_hr_blogs',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'SHRM HR News',
    url: 'https://rss.shrm.org/hrnews',
    category: 'general',
    source_group: 'global_hr',
    priority: 1,
    update_frequency: 'hourly'
  },
  {
    name: 'Google News - SHRM India',
    url: 'https://news.google.com/rss/search?q=SHRM+India+human+resources',
    category: 'general',
    source_group: 'google_news',
    priority: 2,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - HR Tech India',
    url: 'https://news.google.com/rss/search?q=HR+technology+India+software',
    category: 'technology',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - Talent Management India',
    url: 'https://news.google.com/rss/search?q=talent+management+India+recruitment',
    category: 'recruitment',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - Workplace Diversity India',
    url: 'https://news.google.com/rss/search?q=workplace+diversity+India+inclusion',
    category: 'diversity',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - Employee Benefits India',
    url: 'https://news.google.com/rss/search?q=employee+benefits+India+compensation',
    category: 'wellbeing',
    source_group: 'google_news',
    priority: 2,
    update_frequency: 'daily'
  },
  {
    name: 'Google News - HR Analytics India',
    url: 'https://news.google.com/rss/search?q=HR+analytics+India+data',
    category: 'analytics',
    source_group: 'google_news',
    priority: 1,
    update_frequency: 'daily'
  }
];

// Helper function to get feeds by category
export function getFeedsByCategory(category: string): RSSSource[] {
  return RSS_SOURCES.filter(source => source.category === category);
}

// Helper function to get high priority feeds
export function getHighPriorityFeeds(): RSSSource[] {
  return RSS_SOURCES.filter(source => source.priority === 1);
}

// Helper function to get feeds by update frequency
export function getHourlyFeeds(): RSSSource[] {
  return RSS_SOURCES.filter(source => source.update_frequency === 'hourly');
}