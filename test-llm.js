#!/usr/bin/env node

// Test Groq AI integration
require('dotenv').config();

const Groq = require('groq-sdk');

async function testGroqAI() {
    console.log('🤖 Testing Groq AI Integration');
    console.log('='.repeat(40));
    
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY not found in environment');
        return;
    }

    try {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });

        console.log('📡 Testing connection to Groq AI...');
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: "Generate a brief 100-word summary about HR trends in India, focusing on attrition rates and remote work policies."
                }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 200
        });

        const response = chatCompletion.choices[0]?.message?.content;
        
        console.log('✅ Groq AI Connection: SUCCESS');
        console.log('📝 Sample Response:');
        console.log('-'.repeat(40));
        console.log(response);
        console.log('-'.repeat(40));
        console.log(`📊 Token Usage: ${chatCompletion.usage?.total_tokens || 'N/A'}`);
        
        console.log('\n🎯 LLM Integration is working perfectly!');

    } catch (error) {
        console.error('❌ Groq AI test failed:', error.message);
    }
}

testGroqAI();