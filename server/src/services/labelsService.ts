import sql from 'mssql';
import { getDbConnection } from '../config/database';
import {
  EXCLUDED_PARENT_ITEM_PREFIX,
  EXCLUDED_PARENT_ITEM_SUFFIX,
  LABEL_COMPONENT_TYPE,
} from '../config/constants';

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

export interface MorningLabelsResult {
  date: string;
  filter: {
    componentType: string;
    pointUse: string | null;
  };
  labels: MoLabel[];
  source: 'database';
}

function toStr(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatShortDate(value: unknown, fallbackIsoDate?: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SQL date-only values arrive as UTC midnight; use UTC parts to avoid day shift.
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    const yy = String(value.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  }
  if (typeof value === 'string' && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return formatShortDate(d, fallbackIsoDate);
    }
  }
  if (fallbackIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackIsoDate)) {
    const [, y, m, d] = fallbackIsoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
    return `${m}/${d}/${y.slice(-2)}`;
  }
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function resolveDateParam(dateParam?: string): string {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam;
  }
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Morning MO kit labels from ScheduleDB:
 * - Open MOs created on the selected date (dbo.OpenMO.MOCreatedDate)
 * - Excludes blanks (item # starts with 2, or description contains BLANK)
 * - Excludes RT TIP parent items whose item number ends in -02
 * - Excludes parent items whose item number starts with 4
 * - BOM components where ComponentType = 'N', OperationSequenceNumber starts with 5,
 *   and not blank/winding comps (comp # starts with 2 / desc contains BLANK or WINDING)
 * - Point Use (5HDL) filter deferred
 */
export async function getMorningLabels(dateParam?: string): Promise<MorningLabelsResult> {
  const date = resolveDateParam(dateParam);
  const pool = await getDbConnection();

  const result = await pool
    .request()
    .input('createdDate', sql.Date, date)
    .input('componentType', sql.VarChar(10), LABEL_COMPONENT_TYPE)
    .input('excludedParentPrefix', sql.VarChar(1), EXCLUDED_PARENT_ITEM_PREFIX)
    .input('excludedParentPattern', sql.VarChar(20), `%${EXCLUDED_PARENT_ITEM_SUFFIX}`)
    .query(`
      SELECT
        LTRIM(RTRIM(mo.[MONumber])) AS MONumber,
        LTRIM(RTRIM(mo.[ItemNumber])) AS ItemNumber,
        LTRIM(RTRIM(ISNULL(mo.[ItemDescription], ''))) AS ItemDescription,
        mo.[ItemOrderedQuantity] AS MoQty,
        mo.[MOCreatedDate] AS MOCreatedDate,
        LTRIM(RTRIM(bom.[CompNumber])) AS CompNumber,
        LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) AS CompDesc,
        bom.[RequiredQuantity] AS RequiredQuantity,
        bom.[OperationSequenceNumber] AS OperationSequenceNumber
      FROM [ScheduleDB].[dbo].[OpenMO] mo
      LEFT JOIN [ScheduleDB].[dbo].[BOM] bom
        ON LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[ItemNumber]))
       AND LTRIM(RTRIM(bom.[ComponentType])) = @componentType
       AND LEFT(LTRIM(RTRIM(bom.[CompNumber])), 1) <> '2'
       AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) NOT LIKE '%BLANK%'
       AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) NOT LIKE '%WINDING%'
       AND LEFT(LTRIM(RTRIM(CAST(bom.[OperationSequenceNumber] AS VARCHAR(20)))), 1) = '5'
       AND (
            bom.[InEffectivityDate] IS NULL
         OR CAST(bom.[InEffectivityDate] AS DATE) <= CAST(mo.[MOCreatedDate] AS DATE)
       )
       AND (
            bom.[OutEffectivityDate] IS NULL
         OR CAST(bom.[OutEffectivityDate] AS DATE) >= CAST(mo.[MOCreatedDate] AS DATE)
       )
      WHERE CAST(mo.[MOCreatedDate] AS DATE) = @createdDate
        AND LEFT(LTRIM(RTRIM(mo.[ItemNumber])), 1) <> '2'
        AND LEFT(LTRIM(RTRIM(mo.[ItemNumber])), 1) <> @excludedParentPrefix
        AND LTRIM(RTRIM(mo.[ItemNumber])) NOT LIKE @excludedParentPattern
        AND LTRIM(RTRIM(ISNULL(mo.[ItemDescription], ''))) NOT LIKE '%BLANK%'
      ORDER BY
        mo.[MONumber],
        bom.[OperationSequenceNumber],
        bom.[CompNumber]
    `);

  const byMo = new Map<string, MoLabel>();

  for (const row of result.recordset || []) {
    const moNumber = toStr(row.MONumber);
    const itemNumber = toStr(row.ItemNumber);
    if (!moNumber || !itemNumber) continue;
    // Keep these guards even though SQL applies the same filters, so future
    // query changes cannot accidentally put excluded labels back in the list.
    if (
      itemNumber.startsWith(EXCLUDED_PARENT_ITEM_PREFIX) ||
      itemNumber.endsWith(EXCLUDED_PARENT_ITEM_SUFFIX)
    ) {
      continue;
    }

    const key = `${moNumber}|${itemNumber}`;
    let label = byMo.get(key);
    if (!label) {
      label = {
        moNumber,
        itemNumber,
        itemDescription: toStr(row.ItemDescription) || undefined,
        qty: toNum(row.MoQty),
        createdDate: formatShortDate(row.MOCreatedDate, date),
        components: [],
      };
      byMo.set(key, label);
    }

    const compNumber = toStr(row.CompNumber);
    if (!compNumber) continue;

    const perUnit = toNum(row.RequiredQuantity);
    const extendedQty = Math.round(perUnit * label.qty * 10000) / 10000;

    label.components.push({
      itemNumber: compNumber,
      qty: extendedQty,
      description: toStr(row.CompDesc) || undefined,
    });
  }

  const labels = Array.from(byMo.values()).sort((a, b) =>
    a.moNumber.localeCompare(b.moNumber, undefined, { numeric: true }),
  );

  return {
    date,
    filter: {
      componentType: LABEL_COMPONENT_TYPE,
      // Point Use (5HDL) ignored for now — not present on dbo.BOM
      pointUse: null,
    },
    labels,
    source: 'database',
  };
}
