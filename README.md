# Browser OCR Cropper

ブラウザ完結型の OCR Web アプリです。画像 / PDF をアップロードし、表示中ページの上で矩形を選択し、選択した範囲ごとに日本語 OCR を実行できます。サーバーへファイルを送信せず、すべてブラウザ内で処理します。

## 主な機能

- 画像 (png / jpg / webp) と PDF の読み込み
- PDF はページ送りに対応
- 表示中ページ上での複数矩形選択
- 各矩形にラベル名を設定
- 各矩形ごとに OCR 実行 (日本語 / 英語)
- OCR 結果の一覧表示とクリップボードへのコピー
- 矩形の削除

## 技術スタック

- React 18
- TypeScript
- Vite 5
- [tesseract.js](https://github.com/naptha/tesseract.js) (OCR)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) (PDF レンダリング)

## ローカル起動方法

前提: Node.js LTS (18 以上推奨) と npm。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173/` を開きます。

その他のコマンド:

```bash
npm run typecheck   # 型チェック
npm run build       # 本番ビルド (dist/)
npm run preview     # ビルド成果物のプレビュー
```

## GitHub Pages デプロイ方法

このリポジトリには `.github/workflows/deploy.yml` が含まれており、`main` ブランチへの push で GitHub Pages に自動デプロイされます。

事前準備 (リポジトリ側):

1. GitHub リポジトリの **Settings → Pages** を開く
2. **Build and deployment** の **Source** を **GitHub Actions** に設定する

設定後、`main` に push するとワークフローが実行され、`https://<username>.github.io/browser-ocr-cropper/` で公開されます。

> リポジトリ名を変更する場合は [vite.config.ts](vite.config.ts) の `repoName` を新しいリポジトリ名に合わせて変更してください。これは GitHub Pages のサブパス配信のための `base` 設定に使われます。

## 既知の制約

- OCR の精度は画像品質 (解像度、コントラスト、傾き) に依存します。
- 初回 OCR 実行時に学習データ (`jpn`, `eng`) を CDN からダウンロードするため、待ち時間が発生します。
- 日本語 OCR は万能ではなく、手書き文字・縦書き・複雑なレイアウト・装飾フォントなどでは認識精度が落ちます。
- GitHub Pages 上では完全にブラウザ実行のため、ページ数の多い PDF や高解像度ファイルでは描画・OCR が重くなることがあります。
- 現状 OCR は表示中ページの矩形に対してのみ実行可能です。別ページの矩形を OCR したい場合は、サイドパネルの `P{n}` ボタンでそのページに移動してから実行してください。

## 今後の拡張候補

- 矩形のドラッグ移動 / リサイズ
- 全選択範囲の一括 OCR
- OCR 結果の CSV / JSON エクスポート
- 画像前処理 (二値化、傾き補正、台形補正)
- 認識言語の切り替え UI
- 学習データのローカルキャッシュ / オフライン対応 (Service Worker)
- レスポンシブ最適化 (タブレット / モバイル)
- E2E / ユニットテストの整備
