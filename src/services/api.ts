import { getApiBaseUrl, getBackendUnreachableMessage } from '../config/api';
import type { MorningLabelsResponse } from '../types/labels';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(getBackendUnreachableMessage());
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function fetchMorningLabels(date?: string): Promise<MorningLabelsResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<MorningLabelsResponse>(`/labels/morning${query}`);
}
