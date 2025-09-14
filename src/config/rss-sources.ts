// Comprehensive RSS feed configuration for HR domain in India
// Based on verified sources - September 2025

export interface RSSSource {
  name: string;
  url: string;
  category: string;
  tier: 1 | 2 | 3;
  authority_score: number;
  description: string;
  update_frequency: string;
}

export const RSS_SOURCES: RSSSource[] = [
  // TIER 1: FULLY VERIFIED WORKING FEEDS - HIGHEST PRIORITY
  {
    name: 'ET HR World - Top Stories',
    url: 'https://hr.economictimes.indiatimes.com/rss/topstories',
    category: 'general',
    tier: 1,
    authority_score: 0.9,
    description: 'Top HR stories from Economic Times HR World',
    update_frequency: 'hourly'
  },
  {
    name: 'ET HR World - Recent Stories',
    url: 'https://hr.economictimes.indiatimes.com/rss/recentstories',
    category: 'general',
    tier: 1,
    authority_score: 0.9,
    description: 'Latest HR news from Economic Times',
    update_frequency: 'hourly'
  },
  {
    name: 'ET HR World - AI in HR',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/ai-in-hr',
    category: 'technology',
    tier: 1,
    authority_score: 0.9,
    description: 'AI and technology trends in HR',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - HR Analytics',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/hr-analytics',
    category: 'analytics',
    tier: 1,
    authority_score: 0.9,
    description: 'HR analytics and data-driven insights',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Leadership',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/leadership',
    category: 'leadership',
    tier: 1,
    authority_score: 0.9,
    description: 'Leadership trends and management insights',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Employee Experience',
    url: 'https://hr.economictimes.indiatimes.com/rss/trends/employee-experience',
    category: 'employee_experience',
    tier: 1,
    authority_score: 0.9,
    description: 'Employee experience and engagement',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Recruitment',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/recruitment',
    category: 'recruitment',
    tier: 1,
    authority_score: 0.9,
    description: 'Recruitment and talent acquisition trends',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Talent Management',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/talent-management',
    category: 'talent_management',
    tier: 1,
    authority_score: 0.9,
    description: 'Talent management strategies and trends',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Learning & Development',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/learning-and-development',
    category: 'learning',
    tier: 1,
    authority_score: 0.9,
    description: 'Learning and development initiatives',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Employee Engagement',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/employee-engagement',
    category: 'engagement',
    tier: 1,
    authority_score: 0.9,
    description: 'Employee engagement strategies',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Diversity & Inclusion',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/diversity-and-inclusion',
    category: 'diversity',
    tier: 1,
    authority_score: 0.9,
    description: 'Diversity and inclusion in workplace',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - Employee Wellbeing',
    url: 'https://hr.economictimes.indiatimes.com/rss/workplace-4-0/employee-wellbeing',
    category: 'wellbeing',
    tier: 1,
    authority_score: 0.9,
    description: 'Employee wellbeing and mental health',
    update_frequency: 'daily'
  },
  {
    name: 'ET HR World - HRTech',
    url: 'https://hr.economictimes.indiatimes.com/rss/hrtech',
    category: 'hrtech',
    tier: 1,
    authority_score: 0.9,
    description: 'HR technology and digital transformation',
    update_frequency: 'daily'
  },
  {
    name: 'Indian Express - Jobs',
    url: 'https://indianexpress.com/section/jobs/feed/',
    category: 'jobs',
    tier: 1,
    authority_score: 0.8,
    description: 'Job market news and career opportunities',
    update_frequency: 'hourly'
  },
  {
    name: 'Times of India - Business',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms',
    category: 'business',
    tier: 1,
    authority_score: 0.8,
    description: 'Business news with HR implications',
    update_frequency: 'hourly'
  },

  // GOOGLE NEWS TARGETED FEEDS - ALWAYS WORKING
  {
    name: 'Google News - HR India',
    url: 'https://news.google.com/rss/search?q=HR+news+India',
    category: 'general',
    tier: 1,
    authority_score: 0.7,
    description: 'Aggregated HR news from Google News India',
    update_frequency: 'continuous'
  },
  {
    name: 'Google News - Attrition India',
    url: 'https://news.google.com/rss/search?q=attrition+rate+India',
    category: 'attrition',
    tier: 1,
    authority_score: 0.7,
    description: 'Employee attrition trends in India',
    update_frequency: 'continuous'
  },
  {
    name: 'Google News - Remote Work India',
    url: 'https://news.google.com/rss/search?q=remote+work+India+policy',
    category: 'remote_work',
    tier: 1,
    authority_score: 0.7,
    description: 'Remote work policies and trends in India',
    update_frequency: 'continuous'
  },
  {
    name: 'Google News - AI HR Technology',
    url: 'https://news.google.com/rss/search?q=AI+HR+technology+India',
    category: 'technology',
    tier: 1,
    authority_score: 0.7,
    description: 'AI and HR technology adoption in India',
    update_frequency: 'continuous'
  },

  // TIER 2: HIGH CONFIDENCE WORKING FEEDS
  {
    name: 'HR Dive',
    url: 'https://hrdive.com/feeds/news',
    category: 'general',
    tier: 2,
    authority_score: 0.8,
    description: 'Global HR news with India coverage',
    update_frequency: 'daily'
  },
  {
    name: 'The HR Digest',
    url: 'https://thehrdigest.com/rss',
    category: 'general',
    tier: 2,
    authority_score: 0.6,
    description: 'HR industry insights and trends',
    update_frequency: 'daily'
  },
  {
    name: 'SmartRecruiters Blog',
    url: 'https://smartrecruiters.com/blog/feed',
    category: 'recruitment',
    tier: 2,
    authority_score: 0.7,
    description: 'Recruitment technology and strategies',
    update_frequency: 'weekly'
  },

  // TIER 3: STANDARD FEEDS (To be tested)
  {
    name: 'People Matters',
    url: 'https://www.peoplematters.in/rss',
    category: 'general',
    tier: 3,
    authority_score: 0.7,
    description: 'Leading HR publication in India',
    update_frequency: 'daily'
  },
  {
    name: 'HR Katha',
    url: 'https://hrkatha.com/feed',
    category: 'general',
    tier: 3,
    authority_score: 0.6,
    description: 'Indian HR news and insights',
    update_frequency: 'daily'
  }
];

// Utility functions for RSS source management
export function getTier1Sources(): RSSSource[] {
  return RSS_SOURCES.filter(source => source.tier === 1);
}

export function getSourcesByCategory(category: string): RSSSource[] {
  return RSS_SOURCES.filter(source => source.category === category);
}

export function getHighAuthorityFeeds(minScore: number = 0.8): RSSSource[] {
  return RSS_SOURCES.filter(source => source.authority_score >= minScore);
}

export function getSourceByName(name: string): RSSSource | undefined {
  return RSS_SOURCES.find(source => source.name === name);
}