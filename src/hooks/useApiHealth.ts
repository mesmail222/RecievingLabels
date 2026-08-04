import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../config/api';

export type ApiHealthStatus = 'checking' | 'ok' | 'unreachable';

export function useApiHealth(): ApiHealthStatus {
  const [status, setStatus] = useState<ApiHealthStatus>('checking');

  useEffect(() => {
    if (!import.meta.env.DEV) {
      setStatus('ok');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/health`, {
          signal: controller.signal,
        });
        if (!cancelled) setStatus(res.ok ? 'ok' : 'unreachable');
      } catch {
        if (!cancelled) setStatus('unreachable');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return status;
}
