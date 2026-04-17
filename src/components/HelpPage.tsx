const REPO_URL = 'https://github.com/wadatch/browser-ocr-cropper';
const AUTHOR_URL = 'https://github.com/wadatch';

export function HelpPage() {
  return (
    <article className="help-page">
      <section>
        <h2>機能概要</h2>
        <ul>
          <li>画像 (PNG / JPG / WebP) と PDF を読み込んで表示</li>
          <li>PDF はページ送り対応</li>
          <li>表示中ページ上で複数の矩形を描画</li>
          <li>各矩形にラベル名を設定、横書き / 縦書きを切り替え</li>
          <li>範囲ごとに OCR 実行 (日本語 + 英語)</li>
          <li>OCR 結果はテキストエリアに表示、コピー可能</li>
          <li>ファイルはサーバーへ送信されず、すべてブラウザ内で処理</li>
        </ul>
      </section>

      <section>
        <h2>使い方</h2>
        <ol>
          <li>画面上部の「ファイルを選択」から画像か PDF を選ぶ</li>
          <li>表示領域でドラッグして OCR したい範囲を矩形選択する</li>
          <li>サイドパネルで範囲のラベルを編集し、横書き / 縦書きを選ぶ</li>
          <li>「OCR実行」を押す。初回のみ学習データのダウンロード待ちが発生する</li>
          <li>結果は「コピー」ボタンでクリップボードに貼り付け可能</li>
          <li>別ページで作った範囲は <code>P{'{n}'}</code> ボタンでページ移動してから実行する</li>
        </ol>
      </section>

      <section>
        <h2>精度を上げるコツ</h2>
        <ul>
          <li>余白を含めすぎず、文字に近づけて矩形を取る</li>
          <li>縦書きは1列ごとに矩形を分ける (複数列をまとめると精度が落ちる)</li>
          <li>解像度の低い画像は事前に拡大しておくと改善することがある</li>
          <li>傾き・歪みのある画像は補正してから読み込むと安定する</li>
        </ul>
      </section>

      <section>
        <h2>既知の制約</h2>
        <ul>
          <li>OCR の精度は画像品質 (解像度、コントラスト、傾き) に依存する</li>
          <li>初回 OCR 時に学習データ (jpn / jpn_vert) を CDN から取得するため待ち時間がある</li>
          <li>手書き文字、装飾フォント、複雑なレイアウトは認識精度が落ちる</li>
          <li>大きな PDF は完全ブラウザ実行のため重くなることがある</li>
        </ul>
      </section>

      <section>
        <h2>リンク</h2>
        <ul className="help-links">
          <li>
            ソースコード:{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {REPO_URL}
            </a>
          </li>
          <li>
            作者:{' '}
            <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
              {AUTHOR_URL}
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
