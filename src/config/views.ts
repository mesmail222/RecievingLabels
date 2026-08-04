export const VIEW_KEYS = ['dashboard', 'receiving-labels'] as const;

export type ViewKey = (typeof VIEW_KEYS)[number];

export const DEFAULT_VIEW: ViewKey = 'receiving-labels';

export const VIEW_LABELS: Record<ViewKey, string> = {
  dashboard: 'Dashboard',
  'receiving-labels': 'Receiving Labels',
};
