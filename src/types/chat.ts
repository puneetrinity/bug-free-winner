// Chat System Types

export interface ChatSession {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  user_id: string | null;
  metadata: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  report_id: string | null;
  created_at: Date;
  metadata: Record<string, any>;
}

export type ChatEventType = 'status' | 'progress' | 'content' | 'report_complete' | 'error';

export interface ChatEvent {
  type: ChatEventType;
  stage?: 'analyzing_query' | 'searching' | 'scraping' | 'analyzing' | 'synthesizing' | 'finalizing' | 'complete';
  message?: string;
  percentage?: number;
  content?: string;
  report?: any;
}

export interface QueryAnalysis {
  topic: string;
  intent: 'exploratory' | 'factual' | 'comparative' | 'temporal';
  max_sources: number;
  time_range_days: number;
  focus_areas: string[];
}
