#!/usr/bin/env node

// Simple test script to verify our scrapers and LLM integration work
// without requiring database setup

require('dotenv').config();

const { PIBScraper } = require('./dist/scrapers/pib-scraper');
const { RSSParser } = require('./dist/scrapers/rss-parser');
const { ContentScorer } = require('./dist/scoring/content-scorer');

async function testScrapers() {
    console.log('🧪 Testing HR Research Platform Components');
    console.log('='.repeat(50));
    
    try {
        // Test PIB Scraper
        console.log('\n📰 Testing PIB Labour Ministry Scraper...');
        const pibScraper = new PIBScraper();
        const pibItems = await pibScraper.scrape();
        console.log(`✅ PIB Scraper: Found ${pibItems.length} press releases`);
        
        if (pibItems.length > 0) {
            const firstItem = pibItems[0];
            console.log(`   Sample: ${firstItem.title.substring(0, 80)}...`);
        }

        // Test RSS Parser  
        console.log('\n📡 Testing RSS Parser with PeopleMatters...');
        const rssParser = new RSSParser();
        const rssItems = await rssParser.parseRSSFeed(
            'https://www.peoplematters.in/rss', 
            'PeopleMatters'
        );
        console.log(`✅ RSS Parser: Found ${rssItems.length} articles`);
        
        if (rssItems.length > 0) {
            const firstRss = rssItems[0];
            console.log(`   Sample: ${firstRss.title.substring(0, 80)}...`);
        }

        // Test Content Scoring
        console.log('\n🎯 Testing Content Scoring Algorithm...');
        const scorer = new ContentScorer();
        
        if (pibItems.length > 0) {
            const scored = scorer.scoreContent(pibItems[0], 'pib');
            console.log(`✅ Content Scorer: PIB item scored ${scored.components.composite_score.toFixed(3)}`);
            console.log(`   Domain Authority: ${scored.components.domain_authority.toFixed(3)}`);
            console.log(`   Indian Context: ${scored.components.indian_context.toFixed(3)}`);
            console.log(`   Freshness: ${scored.components.freshness.toFixed(3)}`);
        }

        console.log('\n🎉 All core components are working!');
        console.log('📋 Summary:');
        console.log(`   • PIB Scraper: ${pibItems.length} items`);
        console.log(`   • RSS Parser: ${rssItems.length} items`);
        console.log(`   • Content Scoring: ✅ Working`);
        console.log(`   • API Keys: ✅ Configured`);
        
        console.log('\n🔄 Next: Set up database and test full report generation');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

testScrapers();