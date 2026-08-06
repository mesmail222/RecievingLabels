import type { MoLabel } from '../types/labels';

interface MoLabelDocumentProps {
  label: MoLabel;
}

const COMPONENTS_PER_LABEL = 8;

export function MoLabelDocument({ label }: MoLabelDocumentProps) {
  const pageCount = Math.max(1, Math.ceil(label.components.length / COMPONENTS_PER_LABEL));

  return (
    <>
      {Array.from({ length: pageCount }, (_, pageIndex) => {
        const pageComponents = label.components.slice(
          pageIndex * COMPONENTS_PER_LABEL,
          (pageIndex + 1) * COMPONENTS_PER_LABEL,
        );
        const moNumber =
          pageCount > 1 ? `${label.moNumber} (${pageIndex + 1}/${pageCount})` : label.moNumber;

        return (
          <div
            key={`${label.moNumber}-${label.itemNumber}-${pageIndex}`}
            className="mo-label w-[3.5in] border-2 border-black bg-white p-3 font-mono text-sm text-black"
          >
            <div className="mo-label-date flex justify-end text-xs tracking-wide">
              <span>DATE: {label.createdDate}</span>
            </div>

            <div className="mo-label-header mt-1 flex items-baseline justify-between gap-3 border-b border-black pb-1">
              <span className="mo-label-number text-base font-bold tracking-wide">{moNumber}</span>
              <span className="mo-label-quantity text-sm font-semibold">QTY: {label.qty}</span>
            </div>

            <div className="mo-label-components mt-2 space-y-1">
              {label.components.length === 0 ? (
                <p className="text-xs text-slate-600">No Type N / 5HDL components</p>
              ) : (
                pageComponents.map((component, componentIndex) => (
                  <div
                    key={`${label.moNumber}-${pageIndex}-${component.itemNumber}-${componentIndex}`}
                    className="mo-label-component flex justify-between gap-3"
                  >
                    <span className="truncate">{component.itemNumber}</span>
                    <span className="shrink-0">QTY: {component.qty}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
