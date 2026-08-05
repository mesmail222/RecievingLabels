import { getApiBaseUrl, getBackendUnreachableMessage } from '../config/api';
import type { MoLabel, MorningLabelsResponse } from '../types/labels';

export interface BarTenderPrintStatus {
  configured: boolean;
  printerName: string | null;
  message: string;
}

export interface BarTenderPrintResult {
  status: 'queued';
  labelsQueued: number;
  mosSubmitted: number;
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
    let message = text;
    try {
      const payload = JSON.parse(text) as { error?: string; message?: string };
      message = payload.error || payload.message || text;
    } catch {
      // Keep a plain-text error response unchanged.
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function fetchMorningLabels(date?: string): Promise<MorningLabelsResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<MorningLabelsResponse>(`/labels/morning${query}`);
}

export function fetchBarTenderPrintStatus(): Promise<BarTenderPrintStatus> {
  return apiFetch<BarTenderPrintStatus>('/labels/print-status');
}

export function printWithBarTender(labels: MoLabel[]): Promise<BarTenderPrintResult> {
  return apiFetch<BarTenderPrintResult>('/labels/print', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labels }),
  });
}
