import type { MoLabel } from '../types/labels';

interface MoLabelDocumentProps {
  label: MoLabel;
}

export function MoLabelDocument({ label }: MoLabelDocumentProps) {
  return (
    <div className="mo-label w-[3.5in] border-2 border-black bg-white p-3 font-mono text-sm text-black">
      <div className="flex justify-end text-xs tracking-wide">
        <span>DATE: {label.createdDate}</span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3 border-b border-black pb-1">
        <span className="text-base font-bold tracking-wide">{label.moNumber}</span>
        <span className="text-sm font-semibold">QTY: {label.qty}</span>
      </div>

      <div className="mt-2 space-y-1">
        {label.components.length === 0 ? (
          <p className="text-xs text-slate-600">No Type N / 5HDL components</p>
        ) : (
          label.components.map((component) => (
            <div key={`${label.moNumber}-${component.itemNumber}`} className="flex justify-between gap-3">
              <span className="truncate">{component.itemNumber}</span>
              <span className="shrink-0">QTY: {component.qty}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
