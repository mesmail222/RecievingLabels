export interface LabelComponent {
  itemNumber: string;
  qty: number;
  description?: string;
}

export interface MoLabel {
  moNumber: string;
  createdDate: string;
  qty: number;
  itemNumber: string;
  itemDescription?: string;
  components: LabelComponent[];
}

export interface MorningLabelsResponse {
  date: string;
  filter: {
    componentType: string;
    /** null until Point Use (5HDL) is wired */
    pointUse: string | null;
  };
  labels: MoLabel[];
  source: 'sample' | 'database';
}

export function labelKey(label: Pick<MoLabel, 'moNumber' | 'itemNumber'>): string {
  return `${label.moNumber}|${label.itemNumber}`;
}
