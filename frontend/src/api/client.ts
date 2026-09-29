import type {
  PromptPillsResponse,
  SettingsResponse,
  SettingsRequest,
  UserProfile,
  UserProfileRequest,
  FeedbackRequest,
  AdminMetricsResponse,
  QueryRequest,
  QueryStatusResponse,
  StreamEvent,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://acaicia-backend-production.up.railway.app';

async function handleResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Ignore JSON parse errors for non-JSON response bodies
    }
    throw new Error(`${errorMessage}: ${errorDetail} (${response.status})`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`${errorMessage}: Received non-JSON response from server (${text.slice(0, 50)}...)`);
  }
}

export async function getPromptPills(): Promise<PromptPillsResponse> {
  const res = await fetch(`${API_BASE}/prompt_pills`);
  return handleResponse<PromptPillsResponse>(res, 'Failed to fetch prompt pills');
}

export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch(`${API_BASE}/settings`);
  return handleResponse<SettingsResponse>(res, 'Failed to fetch settings');
}

export async function updateSettings(payload: SettingsRequest): Promise<SettingsResponse> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SettingsResponse>(res, 'Failed to update settings');
}

// Verifies an admin API key against a gated endpoint. Returns true when accepted.
export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/metrics?limit=1`, {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {},
    });
    return res.status !== 401;
  } catch {
    return false;
  }
}

export async function getUserSettings(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/user/settings?user_id=${encodeURIComponent(userId)}`);
  return handleResponse<UserProfile>(res, 'Failed to fetch user settings');
}

export async function updateUserSettings(payload: UserProfileRequest): Promise<{ status: string; profile?: UserProfile }> {
  const res = await fetch(`${API_BASE}/user/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ status: string; profile?: UserProfile }>(res, 'Failed to update user settings');
}

export async function submitFeedback(payload: FeedbackRequest): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ status: string }>(res, 'Failed to submit feedback');
}



export async function submitQuery(payload: QueryRequest): Promise<{ query_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ query_id: string; status: string }>(res, 'Failed to submit query');
}

export async function streamQuery(
  payload: QueryRequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {}
    throw new Error(`Failed to initiate stream: ${errorDetail} (${res.status})`);
  }

  if (!res.body) {
    throw new Error('ReadableStream not supported by browser environment.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr) as StreamEvent;
            onEvent(parsed);
          } catch (e) {
            console.warn('Failed to parse SSE event:', jsonStr, e);
          }
        }
      }
    }
  }

  if (buffer.trim().startsWith('data:')) {
    const jsonStr = buffer.trim().slice(5).trim();
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr) as StreamEvent;
        onEvent(parsed);
      } catch (e) {}
    }
  }
}

export async function getQueryStatus(queryId: string): Promise<QueryStatusResponse> {
  const res = await fetch(`${API_BASE}/query/status/${encodeURIComponent(queryId)}`);
  return handleResponse<QueryStatusResponse>(res, 'Failed to get query status');
}

// Helper to get admin API key from localStorage
function getAdminHeaders(): HeadersInit {
  const key = localStorage.getItem('acaicia_admin_key') || '';
  return key ? { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } : {};
}

export interface AdminFiltersParams {
  start_date?: string;
  end_date?: string;
  topic?: string;
  provider?: string;
  query_type?: string;
  hour_start?: number;
  hour_end?: number;
}

export async function getAdminMetrics(filters?: AdminFiltersParams): Promise<AdminMetricsResponse> {
  const params = new URLSearchParams();
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);
  if (filters?.topic) params.set('topic', filters.topic);
  if (filters?.provider) params.set('provider', filters.provider);
  if (filters?.query_type) params.set('query_type', filters.query_type);
  if (filters?.hour_start != null) params.set('hour_start', String(filters.hour_start));
  if (filters?.hour_end != null) params.set('hour_end', String(filters.hour_end));
  const url = `${API_BASE}/admin/metrics${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers: getAdminHeaders() });
  return handleResponse<AdminMetricsResponse>(res, 'Failed to fetch admin metrics');
}

export async function getAdminUsers(params?: { start_date?: string; end_date?: string; page?: number; limit?: number }) {
  const p = new URLSearchParams();
  if (params?.start_date) p.set('start_date', params.start_date);
  if (params?.end_date) p.set('end_date', params.end_date);
  if (params?.page) p.set('page', String(params.page));
  if (params?.limit) p.set('limit', String(params.limit));
  const res = await fetch(`${API_BASE}/admin/users?${p}`, { headers: getAdminHeaders() });
  return handleResponse<{ users: any[]; total: number; page: number; limit: number }>(res, 'Failed to fetch admin users');
}

export async function getAdminTopics() {
  const res = await fetch(`${API_BASE}/admin/topics`, { headers: getAdminHeaders() });
  return handleResponse<{ topics: any[] }>(res, 'Failed to fetch topics');
}

export async function getAdminPopularDocuments(limit = 20) {
  const res = await fetch(`${API_BASE}/admin/documents/popular?limit=${limit}`, { headers: getAdminHeaders() });
  return handleResponse<{ documents: any[] }>(res, 'Failed to fetch popular documents');
}

export async function getAdminCacheStats() {
  const res = await fetch(`${API_BASE}/admin/cache/stats`, { headers: getAdminHeaders() });
  return handleResponse<any>(res, 'Failed to fetch cache stats');
}

export async function clearSemanticCache() {
  const res = await fetch(`${API_BASE}/admin/cache/clear`, { method: 'POST', headers: getAdminHeaders() });
  return handleResponse<{ status: string; message: string }>(res, 'Failed to clear cache');
}

export async function getAdminEvaluations(page = 1, limit = 20) {
  const res = await fetch(`${API_BASE}/admin/evaluations?page=${page}&limit=${limit}`, { headers: getAdminHeaders() });
  return handleResponse<any>(res, 'Failed to fetch evaluations');
}

export async function triggerEvaluationRun(params: {
  dataset?: string;
  limit?: number;
  eval_mode?: string;
}): Promise<{ run_id: string; status: string; message: string }> {
  const p = new URLSearchParams();
  if (params.dataset) p.set('dataset', params.dataset);
  if (params.limit) p.set('limit', String(params.limit));
  if (params.eval_mode) p.set('eval_mode', params.eval_mode);
  const res = await fetch(`${API_BASE}/admin/evaluations/trigger?${p}`, {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  return handleResponse(res, 'Failed to trigger evaluation');
}

export async function getEvaluationRunDetails(runId: string): Promise<{
  run: any;
  details: any[];
}> {
  const res = await fetch(`${API_BASE}/admin/evaluations/${runId}/details`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(res, 'Failed to fetch evaluation details');
}

export async function getEvaluationTrends(limit = 30): Promise<{
  trends: any[];
}> {
  const res = await fetch(`${API_BASE}/admin/evaluations/trends?limit=${limit}`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(res, 'Failed to fetch evaluation trends');
}

export async function getSystemAlerts(resolved = false) {
  const res = await fetch(`${API_BASE}/admin/alerts?resolved=${resolved}`, { headers: getAdminHeaders() });
  return handleResponse<{ alerts: any[] }>(res, 'Failed to fetch alerts');
}

export async function resolveAlert(alertId: string) {
  const res = await fetch(`${API_BASE}/admin/alerts/${alertId}/resolve`, { method: 'POST', headers: getAdminHeaders() });
  return handleResponse<{ status: string }>(res, 'Failed to resolve alert');
}

export function getExportCsvUrl(startDate?: string, endDate?: string): string {
  const key = localStorage.getItem('acaicia_admin_key') || '';
  const p = new URLSearchParams();
  if (startDate) p.set('start_date', startDate);
  if (endDate) p.set('end_date', endDate);
  if (key) p.set('authorization', `Bearer ${key}`);
  return `${API_BASE}/admin/export/csv?${p}`;
}
