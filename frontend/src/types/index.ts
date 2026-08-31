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
  log_id?: string;
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
  run_id?: string;
  timestamp: string;
  dataset_name?: string;
  num_questions?: number;
  hit_rate_at_5?: number;
  context_precision?: number;
  avg_latency_ms?: number;
  model_provider?: string;
  faithfulness_score?: number;
  answer_relevance_score?: number;
  context_recall_score?: number;
  passed?: boolean;
}

export interface FeedbackEntry {
  feedback_id: string;
  rating: number;
  correction_text?: string;
  created_at: string;
  user_id?: string;
}

export interface AdminMetricsResponse {
  filter_state: {
    start_date: string;
    end_date: string;
    topic?: string;
    provider?: string;
    query_type?: string;
    hour_start?: number;
    hour_end?: number;
  };
  total_queries: number;
  unique_users: number;
  guest_queries: number;
  cache_hit_rate_pct: number;
  guardian_pass_rate_pct: number;
  fallback_rate_pct: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  stage_latency_averages: StageLatencyAverages;
  total_tokens_used: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_total_cost_usd: number;
  cost_by_provider: Record<string, number>;
  topic_distribution: Record<string, number>;
  query_type_distribution: Record<string, number>;
  timeseries: TimeSeriesPoint[];
  hourly_heatmap: HeatmapPoint[];
  user_feedback: UserFeedbackMetrics;
  recent_evaluations: EvaluationRun[];
  recent_feedback?: FeedbackEntry[];
  ragas_scores?: RAGASScore[];
  system_alerts?: SystemAlert[];
}

// ─── NEW ANALYTICS TYPES ───────────────────────────────────────────────────

export interface AdminFilters {
  dateRange: '1d' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  topic?: string;
  provider?: string;
  queryType?: string;
  hourStart?: number;
  hourEnd?: number;
}

export interface TimeSeriesPoint {
  day: string;
  total_queries: number;
  cache_hits: number;
  avg_latency_ms: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface HeatmapPoint {
  day_of_week: number; // 0=Mon..6=Sun
  hour_utc: number;
  query_count: number;
  cache_hits: number;
  avg_latency_ms: number;
}

export interface UserCostEntry {
  user_key: string;
  email?: string;
  total_queries: number;
  cache_hits: number;
  total_tokens: number;
  estimated_cost_usd: number;
  avg_satisfaction?: number;
  top_topic?: string;
}

export interface PopularDocument {
  document_id: string;
  title: string;
  doi?: string;
  authors?: string[];
  publication_year?: number;
  query_count: number;
  avg_rrf_score: number;
  last_retrieved_at?: string;
}

export interface TopicEntry {
  topic_id: string;
  label: string;
  icon?: string;
  query_count: number;
}

export interface RAGASScore {
  eval_id: string;
  timestamp: string;
  faithfulness?: number;
  answer_relevance?: number;
  context_precision?: number;
  overall_score?: number;
  judge_model?: string;
}

export interface SystemAlert {
  alert_id: string;
  created_at: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  value?: number;
  threshold?: number;
  resolved: boolean;
}

export interface ProductionRAGAS {
  sample_count: number;
  avg_faithfulness?: number;
  avg_answer_relevance?: number;
  avg_context_precision?: number;
  avg_overall_score?: number;
  recent_scores: RAGASScore[];
}

export interface QueryRequest {
  query: string;
  session_id?: string;
  user_id?: string;
  guest_session_id?: string;
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

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
