export interface LabelComponent {
  itemNumber: string;
  qty: number;
}

export interface MoLabel {
  moNumber: string;
  createdDate: string;
  qty: number;
  itemNumber: string;
  components: LabelComponent[];
}

/**
 * Sample morning MOs with Type N / Point Use 5HDL components already filtered.
 * Replace with Fourth Shift / SQL once the BILL query is wired.
 */
export const SAMPLE_MORNING_LABELS: MoLabel[] = [
  {
    moNumber: 'MF-48201',
    createdDate: '08/04/26',
    qty: 12,
    itemNumber: 'FR-2505',
    components: [
      { itemNumber: 'GPN-1102', qty: 12 },
      { itemNumber: 'GPN-2218', qty: 12 },
      { itemNumber: 'GPN-3340', qty: 24 },
      { itemNumber: 'PRE-4481', qty: 12 },
    ],
  },
  {
    moNumber: 'MF-48202',
    createdDate: '08/04/26',
    qty: 6,
    itemNumber: 'FR-1800',
    components: [
      { itemNumber: 'GPN-1102', qty: 6 },
      { itemNumber: 'GPN-5521', qty: 6 },
      { itemNumber: 'PRE-2209', qty: 6 },
    ],
  },
  {
    moNumber: 'MF-48203',
    createdDate: '08/04/26',
    qty: 24,
    itemNumber: 'NRX+-843S',
    components: [
      { itemNumber: 'GPN-1102', qty: 24 },
      { itemNumber: 'GPN-2218', qty: 24 },
      { itemNumber: 'GPN-3340', qty: 48 },
      { itemNumber: 'GPN-4412', qty: 24 },
      { itemNumber: 'GPN-5521', qty: 24 },
      { itemNumber: 'PRE-4481', qty: 24 },
      { itemNumber: 'PRE-6610', qty: 24 },
    ],
  },
];
