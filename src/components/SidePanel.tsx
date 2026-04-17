import type { OCRResult, OCRSelection, WritingMode } from '../types';

interface Props {
  selections: OCRSelection[];
  results: Record<string, OCRResult>;
  previews: Record<string, string>;
  currentPageIndex: number;
  onJumpToPage: (pageIndex: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateWritingMode: (id: string, writingMode: WritingMode) => void;
  onUpdatePreprocess: (
    id: string,
    patch: Partial<Pick<OCRSelection, 'deskew' | 'binarize' | 'perspective'>>,
  ) => void;
  onGeneratePreview: (id: string) => void;
  onClearPreview: (id: string) => void;
  onRemove: (id: string) => void;
  onRunOcr: (id: string) => void;
}

export function SidePanel({
  selections,
  results,
  previews,
  currentPageIndex,
  onJumpToPage,
  onUpdateLabel,
  onUpdateWritingMode,
  onUpdatePreprocess,
  onGeneratePreview,
  onClearPreview,
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
                  className="remove"
                  onClick={() => onRemove(sel.id)}
                >
                  削除
                </button>
              </div>
              <div className="selection-item-controls">
                <div className="writing-mode-toggle" role="group" aria-label="書字方向">
                  <button
                    type="button"
                    className={sel.writingMode === 'horizontal' ? 'active' : ''}
                    onClick={() => onUpdateWritingMode(sel.id, 'horizontal')}
                    title="横書き (jpn)"
                  >
                    横書き
                  </button>
                  <button
                    type="button"
                    className={sel.writingMode === 'vertical' ? 'active' : ''}
                    onClick={() => onUpdateWritingMode(sel.id, 'vertical')}
                    title="縦書き (jpn_vert)"
                  >
                    縦書き
                  </button>
                </div>
                <button
                  type="button"
                  className="run-ocr"
                  disabled={result?.status === 'running'}
                  onClick={() => onRunOcr(sel.id)}
                >
                  {result?.status === 'running' ? '実行中…' : 'OCR実行'}
                </button>
              </div>
              <div className="selection-preprocess">
                <label title="OCR 前に小さい角度の傾きを自動補正します (やや時間がかかります)">
                  <input
                    type="checkbox"
                    checked={sel.deskew}
                    onChange={(e) => onUpdatePreprocess(sel.id, { deskew: e.target.checked })}
                  />
                  傾き補正
                </label>
                <label title="Otsu 法で白黒の閾値を自動調整して二値化します">
                  <input
                    type="checkbox"
                    checked={sel.binarize}
                    onChange={(e) => onUpdatePreprocess(sel.id, { binarize: e.target.checked })}
                  />
                  白黒補正
                </label>
                <label title="ページ上に表示される 4 つの隅をドラッグして台形を指定すると、矩形に変形してから OCR します">
                  <input
                    type="checkbox"
                    checked={sel.perspective}
                    onChange={(e) =>
                      onUpdatePreprocess(sel.id, { perspective: e.target.checked })
                    }
                  />
                  台形補正
                </label>
                <button
                  type="button"
                  className="preview-btn"
                  disabled={!isCurrentPage}
                  onClick={() => onGeneratePreview(sel.id)}
                  title={
                    isCurrentPage
                      ? '補正後の画像を生成して表示'
                      : 'プレビューは対象ページに切り替えてから生成できます'
                  }
                >
                  プレビュー
                </button>
              </div>
              {previews[sel.id] && (
                <div className="selection-preview">
                  <img src={previews[sel.id]} alt={`${sel.label} の補正プレビュー`} />
                  <button
                    type="button"
                    className="preview-close"
                    onClick={() => onClearPreview(sel.id)}
                    aria-label="プレビューを閉じる"
                  >
                    ×
                  </button>
                </div>
              )}
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
