import type { OCRResult, OCRSelection } from '../types';

interface Props {
  selections: OCRSelection[];
  results: Record<string, OCRResult>;
  currentPageIndex: number;
  onJumpToPage: (pageIndex: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onRunOcr: (id: string) => void;
}

export function SidePanel({
  selections,
  results,
  currentPageIndex,
  onJumpToPage,
  onUpdateLabel,
  onRemove,
  onRunOcr,
}: Props) {
  if (selections.length === 0) {
    return (
      <aside className="side-panel">
        <p className="empty-hint">
          画像/PDFを表示したら、ドラッグでOCR範囲を矩形選択してください。
        </p>
      </aside>
    );
  }

  return (
    <aside className="side-panel">
      <h2>選択範囲</h2>
      <ul className="selection-list">
        {selections.map((sel) => {
          const result = results[sel.id];
          const isCurrentPage = sel.pageIndex === currentPageIndex;
          return (
            <li key={sel.id} className="selection-item">
              <div className="selection-item-header">
                <input
                  className="selection-label-input"
                  type="text"
                  value={sel.label}
                  onChange={(e) => onUpdateLabel(sel.id, e.target.value)}
                />
                <button
                  type="button"
                  className="page-jump"
                  disabled={isCurrentPage}
                  onClick={() => onJumpToPage(sel.pageIndex)}
                  title="このページに移動"
                >
                  P{sel.pageIndex + 1}
                </button>
                <button
                  type="button"
                  className="run-ocr"
                  disabled={result?.status === 'running'}
                  onClick={() => onRunOcr(sel.id)}
                >
                  {result?.status === 'running' ? '実行中…' : 'OCR実行'}
                </button>
                <button
                  type="button"
                  className="remove"
                  onClick={() => onRemove(sel.id)}
                >
                  削除
                </button>
              </div>
              <ResultView result={result} />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function ResultView({ result }: { result?: OCRResult }) {
  if (!result || result.status === 'idle') {
    return <p className="result-empty">未実行</p>;
  }
  if (result.status === 'running') {
    return <p className="result-running">OCR実行中…</p>;
  }
  if (result.status === 'error') {
    return <p className="result-error">エラー: {result.error}</p>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
    } catch (err) {
      console.error('Clipboard write failed', err);
      alert('コピーに失敗しました');
    }
  };

  return (
    <div className="result">
      <textarea className="result-text" value={result.text} readOnly />
      <button type="button" className="copy" onClick={copy}>コピー</button>
    </div>
  );
}
