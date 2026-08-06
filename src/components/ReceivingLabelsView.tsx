import { useEffect, useMemo, useState } from 'react';
import { Loader2, Printer, RefreshCw, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { MoLabelDocument } from './MoLabelDocument';
import { fetchMorningLabels } from '../services/api';
import { labelKey, type MoLabel, type MorningLabelsResponse } from '../types/labels';

function todayInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ReceivingLabelsView() {
  const [date, setDate] = useState(todayInputValue);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<MorningLabelsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async (selectedDate = date) => {
    setLoading(true);
    try {
      const data = await fetchMorningLabels(selectedDate);
      setPayload(data);
      setSelected(new Set(data.labels.map((label) => labelKey(label))));
    } catch (error) {
      setPayload(null);
      toast.error(error instanceof Error ? error.message : 'Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLabels = useMemo(
    () => (payload?.labels ?? []).filter((label) => selected.has(labelKey(label))),
    [payload, selected],
  );

  const toggleAll = (checked: boolean) => {
    if (!payload) return;
    setSelected(checked ? new Set(payload.labels.map((label) => labelKey(label))) : new Set());
  };

  const toggleOne = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handlePrint = () => {
    if (selectedLabels.length === 0) {
      toast.error('Select at least one MO label to print');
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Receiving Kit Labels</h2>
          <p className="mt-1 text-sm text-slate-600">
            Print bag labels for MOs created that morning from{' '}
            <span className="font-medium">ScheduleDB.dbo.OpenMO</span>, with Type{' '}
            <span className="font-medium">N</span> components from <span className="font-medium">dbo.BOM</span>.
            Point Use filter deferred.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
          />
          <Button variant="outline" onClick={() => void load(date)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={handlePrint} disabled={loading || selectedLabels.length === 0}>
            <Printer className="h-4 w-4" />
            Print {selectedLabels.length || ''} Label{selectedLabels.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      <div className="no-print grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-blue-600" />
              Morning MOs
            </CardTitle>
            <CardDescription>
              {payload
                ? `${payload.labels.length} MO${payload.labels.length === 1 ? '' : 's'} · Type ${payload.filter.componentType}${
                    payload.filter.pointUse ? ` @ ${payload.filter.pointUse}` : ''
                  }`
                : 'Loading…'}
              {payload?.source === 'database' ? ' · OpenMO' : payload?.source === 'sample' ? ' · sample data' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !payload || payload.labels.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No MOs found for this date.</p>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm text-slate-700">
                  <Checkbox
                    checked={selected.size === payload.labels.length && payload.labels.length > 0}
                    onCheckedChange={(value) => toggleAll(value === true)}
                  />
                  Select all
                </label>
                <ul className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                  {payload.labels.map((label: MoLabel) => {
                    const key = labelKey(label);
                    return (
                      <li key={key}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(key)}
                            onCheckedChange={(value) => toggleOne(key, value === true)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-900">{label.moNumber}</span>
                              <span className="text-xs text-slate-500">QTY {label.qty}</span>
                            </div>
                            <p className="truncate text-xs text-slate-500">
                              {label.itemNumber}
                              {label.itemDescription ? ` — ${label.itemDescription}` : ''}
                            </p>
                            <p className="text-xs text-slate-400">
                              {label.components.length} component{label.components.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Label preview</CardTitle>
            <CardDescription>
              Print at 3 × 4 in, Portrait, 100% scale, no margins, one page per sheet, with headers and
              footers off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedLabels.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">Select one or more MOs to preview labels.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {selectedLabels.map((label) => (
                  <MoLabelDocument key={labelKey(label)} label={label} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="print-labels hidden print:block">
        {selectedLabels.map((label) => (
          <MoLabelDocument key={`print-${labelKey(label)}`} label={label} />
        ))}
      </div>
    </div>
  );
}
