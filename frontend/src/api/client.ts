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
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SettingsResponse>(res, 'Failed to update settings');
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

export async function getAdminMetrics(): Promise<AdminMetricsResponse> {
  const res = await fetch(`${API_BASE}/admin/metrics`);
  return handleResponse<AdminMetricsResponse>(res, 'Failed to fetch admin metrics');
}

export async function submitQuery(payload: QueryRequest): Promise<{ query_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ query_id: string; status: string }>(res, 'Failed to submit query');
}

export async function getQueryStatus(queryId: string): Promise<QueryStatusResponse> {
  const res = await fetch(`${API_BASE}/query/status/${encodeURIComponent(queryId)}`);
  return handleResponse<QueryStatusResponse>(res, 'Failed to get query status');
}
