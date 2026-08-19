export type UserRole = 'guest' | 'researcher' | 'admin';

export type LLMProvider = 
  | 'modal_gemma' 
  | 'gemini_2_5' 
  | 'nvidia_llama' 
  | 'deepseek_reasoner' 
  | string;

export interface PromptPillsResponse {
  pills: string[];
}

export interface SettingsResponse {
  llm_provider: string;
  google_api_key_configured: boolean;
  nvidia_api_key_configured: boolean;
  deepseek_api_key_configured: boolean;
  hf_token_configured: boolean;
  active_source: string;
}

export interface SettingsRequest {
  llm_provider: string;
}

export interface UserProfile {
  user_id: string;
  role: UserRole;
  custom_instructions?: string;
  query_count?: number;
  max_queries?: number;
  preferred_provider?: string;
}

export interface UserProfileRequest {
  user_id: string;
  custom_instructions?: string;
  preferred_provider?: string;
}

export interface FeedbackRequest {
  log_id: string;
  user_id?: string;
  rating: 1 | -1;
  correction_text?: string;
}

export interface StageLatencyAverages {
  guardian_ms: number;
  architect_ms: number;
  retrieval_ms: number;
  synthesis_ms: number;
}

export interface UserFeedbackMetrics {
  upvotes: number;
  downvotes: number;
  satisfaction_pct: number;
}

export interface EvaluationRun {
  timestamp: string;
  faithfulness_score: number;
  answer_relevance_score: number;
  context_recall_score: number;
  passed: boolean;
}

export interface AdminMetricsResponse {
  total_queries: number;
  cache_hit_rate_pct: number;
  guardian_pass_rate_pct: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  stage_latency_averages: StageLatencyAverages;
  user_feedback: UserFeedbackMetrics;
  recent_evaluations: EvaluationRun[];
}

export interface QueryRequest {
  query: string;
  session_id?: string;
  user_id?: string;
  conversation_history?: Array<{
    role: string;
    content: string;
  }>;
}

export interface SourceChunk {
  title: string;
  authors: string;
  year: number;
  url: string;
  doi: string;
  snippet?: string;
  score?: number;
}

export interface QueryStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  response?: string;
  sources?: SourceChunk[];
  cache_hit?: boolean;
  error?: string;
  stage?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  sources?: SourceChunk[];
  queryId?: string;
  status?: 'processing' | 'completed' | 'failed';
  cacheHit?: boolean;
}
