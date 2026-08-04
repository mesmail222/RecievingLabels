export const DEFAULT_API_PORT = 3011;
export const DEV_API_HOST = '127.0.0.1';

export function getBackendUnreachableMessage(): string {
  if (import.meta.env.DEV) {
    return (
      'Backend API is not reachable on port 3011. ' +
      'From the repo root run: npm run setup, then npm run dev.'
    );
  }
  return 'The Receiving Labels API is not responding. Contact your administrator.';
}

export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return '/api';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }

  return `http://localhost:${DEFAULT_API_PORT}/api`;
}
