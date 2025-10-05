import axios from 'axios';
import { QueryAnalysis } from '../types/chat';

export class QueryAnalyzer {
  private groqApiKey: string;
  private groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    if (!this.groqApiKey) {
      console.warn('⚠️ GROQ_API_KEY not set - query analysis will use defaults');
    }
  }

  async analyze(query: string): Promise<QueryAnalysis> {
    // If no API key, return sensible defaults
    if (!this.groqApiKey) {
      return this.getDefaultAnalysis(query);
    }

    const messages = [
      {
        role: 'system',
        content: `You are a query analyzer for an HR research system focused on the Indian job market. Extract research parameters from user questions.

Output ONLY valid JSON with this exact structure:
{
  "topic": "concise research topic (max 100 chars)",
  "intent": "exploratory|factual|comparative|temporal",
  "max_sources": 10-30,
  "time_range_days": 7-365,
  "focus_areas": ["area1", "area2"]
}

Guidelines for analysis:
- For broad exploratory questions ("analyze", "trends", "impact"): max_sources=20-25, time_range_days=90-180, intent=exploratory
- For specific facts ("what is", "how many", statistics): max_sources=10-15, time_range_days=30-90, intent=factual
- For comparisons ("compare", "vs", "difference"): max_sources=15-20, time_range_days=90-180, intent=comparative
- For recent trends ("latest", "2024", "current"): time_range_days=30-90, intent=temporal
- For historical analysis ("history", "evolution"): time_range_days=180-365, intent=temporal
- Extract 2-4 focus areas (key subtopics or dimensions to explore)

Examples:
Q: "Analyze AI adoption in Indian healthcare"
A: {"topic":"AI adoption in Indian healthcare","intent":"exploratory","max_sources":22,"time_range_days":120,"focus_areas":["diagnostics","adoption rates","challenges","case studies"]}

Q: "What is the average attrition rate in IT sector?"
A: {"topic":"IT sector attrition rate in India","intent":"factual","max_sources":12,"time_range_days":60,"focus_areas":["statistics","industry benchmarks","trends"]}

Q: "Compare remote vs hybrid work policies"
A: {"topic":"Remote vs hybrid work policies in India","intent":"comparative","max_sources":18,"time_range_days":90,"focus_areas":["productivity","employee preferences","implementation"]}
`
      },
      {
        role: 'user',
        content: query
      }
    ];

    try {
      console.log('🔍 Analyzing query with Groq AI...');

      const response = await axios.post(this.groqApiUrl, {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.1,
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const content = response.data.choices[0].message.content.trim();

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(jsonStr);

      // Validate and sanitize
      const validated: QueryAnalysis = {
        topic: (analysis.topic || query).substring(0, 200),
        intent: ['exploratory', 'factual', 'comparative', 'temporal'].includes(analysis.intent)
          ? analysis.intent
          : 'exploratory',
        max_sources: Math.min(Math.max(parseInt(analysis.max_sources) || 15, 10), 30),
        time_range_days: Math.min(Math.max(parseInt(analysis.time_range_days) || 30, 7), 365),
        focus_areas: Array.isArray(analysis.focus_areas)
          ? analysis.focus_areas.slice(0, 5).map((area: any) => String(area).substring(0, 50))
          : []
      };

      console.log('✅ Query analysis complete:', validated);
      return validated;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Query analysis failed, using defaults:', errorMsg);
      return this.getDefaultAnalysis(query);
    }
  }

  private getDefaultAnalysis(query: string): QueryAnalysis {
    // Smart defaults based on query keywords
    const lowerQuery = query.toLowerCase();

    let intent: QueryAnalysis['intent'] = 'exploratory';
    let maxSources = 15;
    let timeRangeDays = 60;

    // Detect intent from keywords
    if (lowerQuery.match(/\b(what is|how many|statistics|number of|percentage)\b/)) {
      intent = 'factual';
      maxSources = 12;
      timeRangeDays = 60;
    } else if (lowerQuery.match(/\b(compare|vs|versus|difference|better)\b/)) {
      intent = 'comparative';
      maxSources = 18;
      timeRangeDays = 90;
    } else if (lowerQuery.match(/\b(latest|recent|current|2024|2025|trend)\b/)) {
      intent = 'temporal';
      maxSources = 20;
      timeRangeDays = 60;
    } else if (lowerQuery.match(/\b(history|evolution|over time|past)\b/)) {
      intent = 'temporal';
      timeRangeDays = 180;
    } else if (lowerQuery.match(/\b(analyze|research|study|impact|effect)\b/)) {
      intent = 'exploratory';
      maxSources = 22;
      timeRangeDays = 120;
    }

    return {
      topic: query.substring(0, 200),
      intent,
      max_sources: maxSources,
      time_range_days: timeRangeDays,
      focus_areas: []
    };
  }
}
