import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileLoader } from './components/FileLoader';
import { PageViewer } from './components/PageViewer';
import { SidePanel } from './components/SidePanel';
import { HelpPage } from './components/HelpPage';
import { useHashRoute } from './hooks/useHashRoute';
import { copyrightInfo } from './config/copyright';
import { loadPdf } from './utils/pdf';
import { recognizeCanvas } from './utils/ocr';
import { cropCanvas } from './utils/crop';
import { binarizeOtsu, deskew, perspectiveWarp } from './utils/preprocess';
import type { LoadedSource, OCRResult, OCRSelection, Quad, Rect, WritingMode } from './types';

function rectToQuad(rect: Rect): Quad {
  return [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ];
}

function preprocessSelection(
  pageCanvas: HTMLCanvasElement,
  sel: OCRSelection,
): HTMLCanvasElement {
  let processed: HTMLCanvasElement;
  if (sel.perspective && sel.quad) {
    // Perspective warp the source quad directly from the page canvas.
    processed = perspectiveWarp(pageCanvas, sel.quad);
  } else {
    processed = cropCanvas(pageCanvas, sel.rect);
  }
  if (sel.deskew) processed = deskew(processed, sel.writingMode);
  if (sel.binarize) processed = binarizeOtsu(processed);
  return processed;
}

const REPO_URL = 'https://github.com/wadatch/browser-ocr-cropper';
const CORP_URL = 'https://corp.mis.dev';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const route = useHashRoute();
  const [source, setSource] = useState<LoadedSource | null>(null);

  // Prevent the browser from navigating to a dropped file when the user misses the drop zone.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);
  const [pageIndex, setPageIndex] = useState(0);
  const [selections, setSelections] = useState<OCRSelection[]>([]);
  const [results, setResults] = useState<Record<string, OCRResult>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
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
          deskew: false,
          binarize: false,
          perspective: false,
          quad: null,
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
    setPreviews((prev) => {
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

  const handleUpdatePreprocess = useCallback(
    (
      id: string,
      patch: Partial<Pick<OCRSelection, 'deskew' | 'binarize' | 'perspective'>>,
    ) => {
      setSelections((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const next: OCRSelection = { ...s, ...patch };
          // Initialize quad from rect on the first time perspective is enabled.
          if (patch.perspective && !s.quad) next.quad = rectToQuad(s.rect);
          return next;
        }),
      );
      // Invalidate the preview so the user re-generates with the new settings.
      setPreviews((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  const handleUpdateQuad = useCallback((id: string, quad: Quad) => {
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, quad } : s)));
    setPreviews((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleGeneratePreview = useCallback(
    (id: string) => {
      const sel = selections.find((s) => s.id === id);
      const canvas = currentCanvasRef.current;
      if (!sel || !canvas || sel.pageIndex !== pageIndex) return;
      try {
        const processed = preprocessSelection(canvas, sel);
        setPreviews((prev) => ({ ...prev, [id]: processed.toDataURL() }));
      } catch (err) {
        console.error('Preview generation failed', err);
      }
    },
    [selections, pageIndex],
  );

  const handleClearPreview = useCallback((id: string) => {
    setPreviews((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
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
        const processed = preprocessSelection(canvas, sel);
        const text = await recognizeCanvas(processed, { writingMode: sel.writingMode });
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
        <nav className="app-nav">
          <a href="#/" className={route === 'app' ? 'active' : ''}>
            アプリ
          </a>
          <a href="#/help" className={route === 'help' ? 'active' : ''}>
            ヘルプ
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
        {route === 'app' && (
          <>
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
          </>
        )}
      </header>

      {route === 'app' && loadError && <div className="error-banner">{loadError}</div>}

      {route === 'help' ? (
        <main className="app-body app-body-single">
          <HelpPage />
        </main>
      ) : (
        <main className="app-body">
          <section className="viewer-area">
            {source ? (
              <PageViewer
                source={source}
                pageIndex={pageIndex}
                selections={currentPageSelections}
                onAddSelection={handleAddSelection}
                onRemoveSelection={handleRemoveSelection}
                onUpdateQuad={handleUpdateQuad}
                onCanvasReady={handleCanvasReady}
              />
            ) : (
              <DropPlaceholder onFile={handleFile} />
            )}
          </section>

          <SidePanel
            selections={selections}
            results={results}
            previews={previews}
            currentPageIndex={pageIndex}
            onJumpToPage={setPageIndex}
            onUpdateLabel={handleUpdateLabel}
            onUpdateWritingMode={handleUpdateWritingMode}
            onUpdatePreprocess={handleUpdatePreprocess}
            onGeneratePreview={handleGeneratePreview}
            onClearPreview={handleClearPreview}
            onRemove={handleRemoveSelection}
            onRunOcr={handleRunOcr}
          />
        </main>
      )}

      <AppFooter />
    </div>
  );
}

function DropPlaceholder({ onFile }: { onFile: (file: File) => void }) {
  const [active, setActive] = useState(false);
  const dragDepth = useRef(0);

  return (
    <div
      className={`placeholder${active ? ' placeholder-active' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      画像 (png/jpg/webp) または PDF をここにドラッグ＆ドロップ、
      <br />
      もしくは画面上部の「ファイルを選択」から開いてください
    </div>
  );
}

function AppFooter() {
  return (
    <>
      <footer className="app-footer">
        <details className="app-footer-details">
          <summary>作者・プロジェクト情報</summary>
          <div className="app-footer-inner">
            <section className="app-footer-section">
              <h3>作者について</h3>
              <ul className="app-footer-list">
                <li className="app-footer-item">
                  <span className="app-footer-icon" aria-hidden="true">
                    <BriefcaseIcon />
                  </span>
                  <p>ソフトウェアエンジニアをしており、中学校PTAの会長をしています</p>
                </li>
                <li className="app-footer-item">
                  <span className="app-footer-icon" aria-hidden="true">
                    <BoltIcon />
                  </span>
                  <p>ITが分かる人にしかできない作業をできるだけ無くしたいです</p>
                </li>
                <li className="app-footer-item">
                  <span className="app-footer-icon" aria-hidden="true">
                    <BriefcaseIcon />
                  </span>
                  <p>
                    お仕事のご依頼はこちら →{' '}
                    <a href={CORP_URL} target="_blank" rel="noopener noreferrer">
                      {CORP_URL}
                    </a>
                  </p>
                </li>
              </ul>
            </section>

            <section className="app-footer-section">
              <h3>プロジェクト情報</h3>
              <ul className="app-footer-list">
                <li className="app-footer-item">
                  <span className="app-footer-icon" aria-hidden="true">
                    <GithubIcon />
                  </span>
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    GitHub で詳細を見る
                  </a>
                </li>
                <li className="app-footer-item app-footer-licenses">
                  <span className="app-footer-icon" aria-hidden="true">
                    <BookIcon />
                  </span>
                  <div>
                    <div className="app-footer-licenses-title">使用ライブラリ</div>
                    <ul>
                      <li>
                        <a
                          href="https://github.com/naptha/tesseract.js"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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
                        <a
                          href="https://github.com/mozilla/pdf.js"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          pdf.js
                        </a>{' '}
                        (Apache-2.0)
                      </li>
                      <li>
                        <a
                          href="https://github.com/facebook/react"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          React
                        </a>{' '}
                        (MIT) /{' '}
                        <a
                          href="https://github.com/vitejs/vite"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Vite
                        </a>{' '}
                        (MIT)
                      </li>
                    </ul>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </details>
      </footer>

      <section className="app-copyright">
        <p>
          {copyrightInfo.text}{' '}
          <a href={copyrightInfo.link} target="_blank" rel="noopener noreferrer">
            {copyrightInfo.linkText}
          </a>
        </p>
      </section>
    </>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
      />
    </svg>
  );
}
