import type { MoLabel } from '../types/labels';

interface MoLabelDocumentProps {
  label: MoLabel;
}

export function MoLabelDocument({ label }: MoLabelDocumentProps) {
  const densityClass =
    label.components.length > 16
      ? 'mo-label--dense'
      : label.components.length > 10
        ? 'mo-label--compact'
        : '';

  return (
    <div
      className={`mo-label box-border flex h-[4in] w-[3in] flex-col overflow-hidden border-2 border-black bg-white p-3 font-mono text-sm text-black ${densityClass}`}
    >
      <div className="mo-label-date flex shrink-0 justify-end text-xs tracking-wide">
        <span>DATE: {label.createdDate}</span>
      </div>

      <div className="mo-label-header mt-1 flex shrink-0 items-baseline justify-between gap-3 pb-1">
        <span className="mo-label-number text-base font-bold tracking-wide">{label.moNumber}</span>
        <span className="mo-label-quantity text-sm font-semibold">QTY: {label.qty}</span>
      </div>

      <div className="mo-label-components flex min-h-0 flex-1 flex-col justify-evenly">
        {label.components.length === 0 ? (
          <p className="text-xs text-slate-600">No Type N / 5HDL components</p>
        ) : (
          label.components.map((component, componentIndex) => (
            <div
              key={`${label.moNumber}-${component.itemNumber}-${componentIndex}`}
              className="mo-label-component flex shrink-0 justify-between gap-3"
            >
              <span className="truncate">{component.itemNumber}</span>
              <span className="shrink-0">QTY: {component.qty}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
