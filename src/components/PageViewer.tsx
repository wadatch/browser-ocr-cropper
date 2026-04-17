import { useEffect, useRef, useState, useCallback } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import type { LoadedSource, OCRSelection, Rect } from '../types';
import { isRenderingCancelled, startPdfPageRender } from '../utils/pdf';

interface Props {
  source: LoadedSource;
  pageIndex: number;
  selections: OCRSelection[];
  onAddSelection: (rect: Rect) => void;
  onRemoveSelection: (id: string) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

interface Drag {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

const PDF_RENDER_SCALE = 1.5;

export function PageViewer({
  source,
  pageIndex,
  selections,
  onAddSelection,
  onRemoveSelection,
  onCanvasReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
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

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    setDrag({ start: p, current: p });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    setDrag({ start: drag.start, current: p });
  };

  const onMouseUp = () => {
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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {selections.map((sel) => {
          const d = toDisplayRect(sel.rect);
          return (
            <div
              key={sel.id}
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
