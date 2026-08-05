import { getApiBaseUrl, getBackendUnreachableMessage } from '../config/api';
import type { MoLabel, MorningLabelsResponse } from '../types/labels';

const LOCAL_PRINT_AGENT_URL = 'http://127.0.0.1:38177';

export interface LocalPrinter {
  name: string;
  model: string;
  port: string;
  isDefault: boolean;
}

export interface LocalPrintAgentHealth {
  status: 'ok';
  template: string;
  printers: LocalPrinter[];
}

export interface LocalPrintResult {
  status: 'printed';
  labelsPrinted: number;
  printerName: string;
}

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

export async function fetchLocalPrintAgent(): Promise<LocalPrintAgentHealth | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${LOCAL_PRINT_AGENT_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as LocalPrintAgentHealth;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function printWithLocalBarTender(
  printerName: string,
  labels: MoLabel[],
): Promise<LocalPrintResult> {
  const response = await fetch(`${LOCAL_PRINT_AGENT_URL}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ printerName, labels }),
  });

  const payload = (await response.json().catch(() => null)) as
    | LocalPrintResult
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload && 'error' in payload && payload.error ? payload.error : 'BarTender printing failed');
  }
  return payload as LocalPrintResult;
}
