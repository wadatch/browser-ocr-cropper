import { useEffect, useRef, useState, useCallback } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import type { LoadedSource, OCRSelection, Quad, Rect } from '../types';
import { isRenderingCancelled, startPdfPageRender } from '../utils/pdf';

interface Props {
  source: LoadedSource;
  pageIndex: number;
  selections: OCRSelection[];
  onAddSelection: (rect: Rect) => void;
  onRemoveSelection: (id: string) => void;
  onUpdateQuad: (id: string, quad: Quad) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

interface RectDrag {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

interface QuadDrag {
  selectionId: string;
  cornerIndex: 0 | 1 | 2 | 3;
}

const PDF_RENDER_SCALE = 1.5;

export function PageViewer({
  source,
  pageIndex,
  selections,
  onAddSelection,
  onRemoveSelection,
  onUpdateQuad,
  onCanvasReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [drag, setDrag] = useState<RectDrag | null>(null);
  const [quadDrag, setQuadDrag] = useState<QuadDrag | null>(null);
  // Bumped after each render so positioning calculations re-run.
  const [renderTick, setRenderTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    // Cancel any in-flight pdfjs render before starting a new one
    // (StrictMode double-invokes effects in dev).
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;

    (async () => {
      if (source.kind === 'image') {
        canvas.width = source.bitmap.width;
        canvas.height = source.bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(source.bitmap, 0, 0);
      } else {
        const task = await startPdfPageRender(source.doc, pageIndex, canvas, PDF_RENDER_SCALE);
        if (cancelled) {
          task.cancel();
          // Swallow the rejection from cancel() so it doesn't surface as an unhandled rejection.
          task.promise.catch(() => {});
          return;
        }
        renderTaskRef.current = task;
        try {
          await task.promise;
        } catch (err) {
          if (isRenderingCancelled(err)) return;
          throw err;
        } finally {
          if (renderTaskRef.current === task) renderTaskRef.current = null;
        }
      }
      if (cancelled) return;
      onCanvasReady(canvas);
      setRenderTick((t) => t + 1);
    })().catch((err) => {
      console.error('Failed to render page', err);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [source, pageIndex, onCanvasReady]);

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  const toDisplayRect = useCallback(
    (r: Rect) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) {
        return { left: 0, top: 0, width: 0, height: 0 };
      }
      const bounds = canvas.getBoundingClientRect();
      const sx = bounds.width / canvas.width;
      const sy = bounds.height / canvas.height;
      return {
        left: r.x * sx,
        top: r.y * sy,
        width: r.width * sx,
        height: r.height * sy,
      };
    },
    // renderTick triggers recomputation of the memoized closure when canvas size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [renderTick],
  );

  const toDisplayPoint = useCallback(
    (p: [number, number]) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) return { left: 0, top: 0 };
      const bounds = canvas.getBoundingClientRect();
      const sx = bounds.width / canvas.width;
      const sy = bounds.height / canvas.height;
      return { left: p[0] * sx, top: p[1] * sy };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [renderTick],
  );

  // Window-level drag for quad corner handles, so the user can drag past the overlay.
  useEffect(() => {
    if (!quadDrag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: PointerEvent) => {
      const sel = selections.find((s) => s.id === quadDrag.selectionId);
      if (!sel || !sel.quad) return;
      const p = toCanvasCoords(e.clientX, e.clientY);
      const clampedX = Math.max(0, Math.min(canvas.width, p.x));
      const clampedY = Math.max(0, Math.min(canvas.height, p.y));
      const next = sel.quad.map((c, i) =>
        i === quadDrag.cornerIndex ? [clampedX, clampedY] : c,
      ) as Quad;
      onUpdateQuad(sel.id, next);
    };
    const onUp = () => setQuadDrag(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [quadDrag, selections, toCanvasCoords, onUpdateQuad]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toCanvasCoords(e.clientX, e.clientY);
    setDrag({ start: p, current: p });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    setDrag({ start: drag.start, current: p });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const r: Rect = {
      x: Math.min(drag.start.x, drag.current.x),
      y: Math.min(drag.start.y, drag.current.y),
      width: Math.abs(drag.current.x - drag.start.x),
      height: Math.abs(drag.current.y - drag.start.y),
    };
    setDrag(null);
    if (r.width > 5 && r.height > 5) onAddSelection(r);
  };

  const dragRect: Rect | null = drag
    ? {
        x: Math.min(drag.start.x, drag.current.x),
        y: Math.min(drag.start.y, drag.current.y),
        width: Math.abs(drag.current.x - drag.start.x),
        height: Math.abs(drag.current.y - drag.start.y),
      }
    : null;

  return (
    <div className="viewer-stage">
      <canvas ref={canvasRef} className="viewer-canvas" />
      <div
        className="viewer-overlay"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {selections.map((sel) => {
          const d = toDisplayRect(sel.rect);
          const showQuad = sel.perspective && sel.quad;
          return (
            <div key={sel.id}>
              <div
                className="selection-box"
                style={{ left: d.left, top: d.top, width: d.width, height: d.height }}
              >
                <span className="selection-label">{sel.label}</span>
                <button
                  type="button"
                  className="selection-remove"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSelection(sel.id);
                  }}
                >
                  ×
                </button>
              </div>
              {showQuad && sel.quad && (
                <QuadOverlay
                  quad={sel.quad}
                  toDisplayPoint={toDisplayPoint}
                  onCornerPointerDown={(idx, e) => {
                    e.stopPropagation();
                    setQuadDrag({ selectionId: sel.id, cornerIndex: idx });
                  }}
                />
              )}
            </div>
          );
        })}
        {dragRect && (() => {
          const d = toDisplayRect(dragRect);
          return (
            <div
              className="selection-box selection-box-drag"
              style={{ left: d.left, top: d.top, width: d.width, height: d.height }}
            />
          );
        })()}
      </div>
    </div>
  );
}

function QuadOverlay({
  quad,
  toDisplayPoint,
  onCornerPointerDown,
}: {
  quad: Quad;
  toDisplayPoint: (p: [number, number]) => { left: number; top: number };
  onCornerPointerDown: (cornerIndex: 0 | 1 | 2 | 3, e: React.PointerEvent) => void;
}) {
  const display = quad.map(toDisplayPoint);
  const points = display.map((p) => `${p.left},${p.top}`).join(' ');

  return (
    <>
      <svg className="quad-overlay" aria-hidden="true">
        <polygon points={points} />
      </svg>
      {display.map((p, i) => (
        <button
          key={i}
          type="button"
          className="quad-handle"
          style={{ left: p.left, top: p.top, touchAction: 'none' }}
          onPointerDown={(e) => onCornerPointerDown(i as 0 | 1 | 2 | 3, e)}
          aria-label={`corner ${i + 1}`}
        />
      ))}
    </>
  );
}
