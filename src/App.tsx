import { useCallback, useMemo, useRef, useState } from 'react';
import { FileLoader } from './components/FileLoader';
import { PageViewer } from './components/PageViewer';
import { SidePanel } from './components/SidePanel';
import { loadPdf } from './utils/pdf';
import { recognizeCanvas } from './utils/ocr';
import { cropCanvas } from './utils/crop';
import type { LoadedSource, OCRResult, OCRSelection, Rect, WritingMode } from './types';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selections, setSelections] = useState<OCRSelection[]>([]);
  const [results, setResults] = useState<Record<string, OCRResult>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoadError(null);
    setSelections([]);
    setResults({});
    setPageIndex(0);
    try {
      if (file.type === 'application/pdf') {
        const doc = await loadPdf(file);
        setSource({ kind: 'pdf', doc, pageCount: doc.numPages });
      } else if (file.type.startsWith('image/')) {
        const bitmap = await createImageBitmap(file);
        setSource({ kind: 'image', bitmap, pageCount: 1 });
      } else {
        setLoadError('対応していないファイル形式です。');
      }
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。');
    }
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    currentCanvasRef.current = canvas;
  }, []);

  const handleAddSelection = useCallback(
    (rect: Rect) => {
      setSelections((prev) => {
        const onPage = prev.filter((s) => s.pageIndex === pageIndex).length;
        const sel: OCRSelection = {
          id: newId(),
          pageIndex,
          label: `範囲 ${pageIndex + 1}-${onPage + 1}`,
          rect,
          writingMode: 'horizontal',
        };
        return [...prev, sel];
      });
    },
    [pageIndex],
  );

  const handleRemoveSelection = useCallback((id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
    setResults((prev) => {
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleUpdateLabel = useCallback((id: string, label: string) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }, []);

  const handleUpdateWritingMode = useCallback((id: string, writingMode: WritingMode) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, writingMode } : s)));
  }, []);

  const handleRunOcr = useCallback(
    async (id: string) => {
      const sel = selections.find((s) => s.id === id);
      const canvas = currentCanvasRef.current;
      if (!sel || !canvas) return;
      if (sel.pageIndex !== pageIndex) {
        setResults((prev) => ({
          ...prev,
          [id]: { status: 'error', text: '', error: '対象ページに切り替えてから実行してください。' },
        }));
        return;
      }

      setResults((prev) => ({ ...prev, [id]: { status: 'running', text: '' } }));
      try {
        const cropped = cropCanvas(canvas, sel.rect);
        const text = await recognizeCanvas(cropped, { writingMode: sel.writingMode });
        setResults((prev) => ({ ...prev, [id]: { status: 'done', text } }));
      } catch (err) {
        console.error(err);
        setResults((prev) => ({
          ...prev,
          [id]: {
            status: 'error',
            text: '',
            error: err instanceof Error ? err.message : 'OCRに失敗しました',
          },
        }));
      }
    },
    [selections, pageIndex],
  );

  const pageCount = source?.pageCount ?? 0;
  const currentPageSelections = useMemo(
    () => selections.filter((s) => s.pageIndex === pageIndex),
    [selections, pageIndex],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Browser OCR Cropper</h1>
        <FileLoader onFile={handleFile} />
        {source && pageCount > 1 && (
          <div className="page-controls">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
            >
              前へ
            </button>
            <span>
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageIndex >= pageCount - 1}
            >
              次へ
            </button>
          </div>
        )}
      </header>

      {loadError && <div className="error-banner">{loadError}</div>}

      <main className="app-body">
        <section className="viewer-area">
          {source ? (
            <PageViewer
              source={source}
              pageIndex={pageIndex}
              selections={currentPageSelections}
              onAddSelection={handleAddSelection}
              onRemoveSelection={handleRemoveSelection}
              onCanvasReady={handleCanvasReady}
            />
          ) : (
            <div className="placeholder">画像 (png/jpg/webp) または PDF を選択してください</div>
          )}
        </section>

        <SidePanel
          selections={selections}
          results={results}
          currentPageIndex={pageIndex}
          onJumpToPage={setPageIndex}
          onUpdateLabel={handleUpdateLabel}
          onUpdateWritingMode={handleUpdateWritingMode}
          onRemove={handleRemoveSelection}
          onRunOcr={handleRunOcr}
        />
      </main>

      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-left">
        © <a href="https://github.com/wadatch" target="_blank" rel="noopener noreferrer">wadatch</a>
      </div>
      <ul className="app-footer-licenses">
        <li>
          <a href="https://github.com/naptha/tesseract.js" target="_blank" rel="noopener noreferrer">
            Tesseract.js
          </a>{' '}
          (Apache-2.0)
        </li>
        <li>
          <a
            href="https://github.com/tesseract-ocr/tessdata"
            target="_blank"
            rel="noopener noreferrer"
          >
            tessdata (jpn / jpn_vert)
          </a>{' '}
          (Apache-2.0)
        </li>
        <li>
          <a href="https://github.com/mozilla/pdf.js" target="_blank" rel="noopener noreferrer">
            pdf.js
          </a>{' '}
          (Apache-2.0)
        </li>
        <li>
          <a href="https://github.com/facebook/react" target="_blank" rel="noopener noreferrer">
            React
          </a>{' '}
          (MIT)
        </li>
        <li>
          <a href="https://github.com/vitejs/vite" target="_blank" rel="noopener noreferrer">
            Vite
          </a>{' '}
          (MIT)
        </li>
      </ul>
    </footer>
  );
}
