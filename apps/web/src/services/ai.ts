import { fetchApi, getAccessToken } from '../lib/api';

export interface AiStatus {
  pipeline: string;
  writesClinicalRecords: boolean;
  gemini: { configured: boolean; model: string };
  elevenlabs: { configured: boolean; model: string };
}

export interface AiRequestRow {
  id: string;
  type: string;
  provider: string;
  model?: string | null;
  status: string;
  createdAt: string;
  outputs: Array<{
    id: string;
    contentType: string;
    content: string;
    isReviewed: boolean;
    createdAt: string;
  }>;
}

export const aiApi = {
  status() {
    return fetchApi<AiStatus>('/ai/status');
  },
  usage() {
    return fetchApi<{
      pendingReview: number;
      requests: Array<{ type: string; status: string; count: number }>;
      usage: Array<{ provider: string; requestType: string; requests: number; promptTokens: number; completionTokens: number }>;
    }>('/ai/usage');
  },
  listRequests(params?: { page?: number; type?: string; status?: string }) {
    const q = new URLSearchParams();
    q.set('page', String(params?.page || 1));
    q.set('limit', '20');
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    return fetchApi<{ data: AiRequestRow[]; meta: { total: number; page: number } }>(`/ai/requests?${q.toString()}`);
  },
  async transcribe(file: File | Blob, languageCode?: string, options?: { toEnglish?: boolean }) {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'voice-note.webm');
    const q = new URLSearchParams();
    if (languageCode) q.set('languageCode', languageCode);
    if (options?.toEnglish) q.set('toEnglish', 'true');
    const qs = q.toString() ? `?${q.toString()}` : '';
    const response = await fetch(`${API_BASE}/ai/transcribe${qs}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      body: form,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Transcription failed' }));
      const msg = Array.isArray(error.message) ? error.message.join(', ') : error.message;
      throw new Error(msg || 'Transcription failed');
    }
    return response.json() as Promise<{
      requestId: string;
      outputId: string;
      text: string;
      originalText?: string;
      isDraft: boolean;
      languageCode?: string;
      provider?: string;
    }>;
  },
  noteDraft(transcript: string) {
    return fetchApi<{ text: string; soap: Record<string, string>; isDraft: boolean }>('/ai/note-draft', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  },
  reviewOutput(id: string) {
    return fetchApi(`/ai/outputs/${id}/review`, { method: 'POST' });
  },
};
