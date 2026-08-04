import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { getBackendUnreachableMessage } from '../config/api';
import type { ApiHealthStatus } from '../hooks/useApiHealth';

interface ApiConnectionBannerProps {
  status: ApiHealthStatus;
}

export function ApiConnectionBanner({ status }: ApiConnectionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!import.meta.env.DEV || status !== 'unreachable' || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">Backend API is not running</p>
          <p className="text-amber-900/90">{getBackendUnreachableMessage()}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
