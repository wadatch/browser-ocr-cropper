const REPO_URL = 'https://github.com/wadatch/browser-ocr-cropper';
const AUTHOR_URL = 'https://github.com/wadatch';

export function HelpPage() {
  return (
    <article className="help-page">
      <section className="help-callout">
        <h2>処理データはクラウドにアップロードされません</h2>
        <p>
          このアプリの最大の特徴は、読み込んだ画像 / PDF
          がブラウザの外に出ない (=サーバーに送信されない) ことです。OCR
          処理もすべてあなたのブラウザの中で完結します。社外秘の資料や個人情報を含むファイルでも、
          外部のクラウドサービスに送信したくない場面で安心してお使いいただけます。
        </p>
        <ul>
          <li>画像 / PDF はブラウザのメモリ上だけで扱います</li>
          <li>OCR は WebAssembly 版 Tesseract がブラウザ内で実行されます</li>
          <li>外部通信は初回のみ。Tesseract の学習データ (`jpn` / `jpn_vert`) と pdf.js worker を CDN から取得するだけで、ファイル本体は送信されません</li>
          <li>サーバー側の保存先 / DB / アカウント機能はありません</li>
        </ul>
      </section>

      <section>
        <h2>機能概要</h2>
        <ul>
          <li>画像 (PNG / JPG / WebP) と PDF の読み込み (ファイル選択 or ドラッグ＆ドロップ)</li>
          <li>PDF はページ送り対応</li>
          <li>表示中ページ上で複数の矩形を描画</li>
          <li>各矩形に以下を設定可能:
            <ul>
              <li>任意のラベル名</li>
              <li>横書き (`jpn`) / 縦書き (`jpn_vert`) の切替</li>
              <li>傾き補正 (自動角度推定)</li>
              <li>白黒補正 (Otsu 法による二値化、極性自動反転付き)</li>
              <li>台形補正 (4 隅をドラッグして指定 → 矩形に変形)</li>
            </ul>
          </li>
          <li>補正結果のプレビュー (OCR 実行前に確認可能)</li>
          <li>範囲ごとに OCR 実行 (日本語 + 英語、または日本語縦書き)</li>
          <li>OCR 結果はテキストエリアに表示、コピー可能</li>
        </ul>
      </section>

      <section>
        <h2>使い方</h2>
        <ol>
          <li>画面上部の「ファイルを選択」、または表示領域に画像 / PDF を直接ドラッグ＆ドロップ</li>
          <li>表示領域でドラッグして OCR したい範囲を矩形選択する</li>
          <li>サイドパネルで範囲のラベルを編集し、横書き / 縦書きを選ぶ</li>
          <li>必要に応じて「傾き補正」「白黒補正」「台形補正」をチェック。台形補正は表示中ページに 4 つの緑色のハンドルが表示されるので、ドラッグして実際の文書四隅に合わせる</li>
          <li>「プレビュー」で補正後の画像を確認できる</li>
          <li>「OCR実行」を押す。初回のみ学習データのダウンロード待ちが発生する</li>
          <li>結果は「コピー」ボタンでクリップボードに貼り付け可能</li>
          <li>別ページで作った範囲は <code>P{'{n}'}</code> ボタンでページ移動してから実行する</li>
        </ol>
      </section>

      <section>
        <h2>精度を上げるコツ</h2>
        <ul>
          <li>余白を含めすぎず、文字に近づけて矩形を取る</li>
          <li>縦書きは 1 列ごとに矩形を分ける (複数列をまとめると精度が落ちる)</li>
          <li>解像度の低い画像は事前に拡大しておくと改善することがある</li>
          <li>傾きが目立つときは「傾き補正」、コントラストが弱いときは「白黒補正」、斜めから撮った文書は「台形補正」が効きやすい</li>
          <li>補正の効きはプレビューで確認してから OCR を回すのがおすすめ</li>
        </ul>
      </section>

      <section>
        <h2>既知の制約</h2>
        <ul>
          <li>OCR の精度は画像品質 (解像度、コントラスト、傾き) に依存する</li>
          <li>初回 OCR 時に学習データ (jpn / jpn_vert) を CDN から取得するため待ち時間がある</li>
          <li>手書き文字、装飾フォント、複雑なレイアウトは認識精度が落ちる</li>
          <li>大きな PDF は完全ブラウザ実行のため重くなることがある</li>
          <li>傾き補正は ±8° の範囲を 1° 刻みで探索する簡易実装。それより大きい傾きには対応しない</li>
          <li>OCR / プレビュー / 台形ハンドルの操作は対象ページを表示しているときのみ可能</li>
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
