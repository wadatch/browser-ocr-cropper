# Browser OCR Cropper

ブラウザ完結型の OCR Web アプリです。画像 / PDF をアップロードし、表示中ページの上で矩形を複数選択し、選択した範囲ごとに日本語 OCR を実行できます。サーバーへファイルを送信せず、すべてブラウザ内で処理します。

公開先: https://wadatch.github.io/browser-ocr-cropper/

## 主な機能

- 画像 (PNG / JPG / WebP) と PDF の読み込み
- 画像 / PDF をプレースホルダ領域にドラッグ＆ドロップして読み込み
- PDF はページ送りに対応
- 表示中ページ上での複数矩形選択
- 範囲ごとに以下を設定可能:
  - 任意のラベル名
  - 横書き / 縦書き (`jpn` と `jpn_vert` を切替)
  - 傾き補正 (投影プロファイル法による自動角度推定)
  - 白黒補正 (Otsu 法による適応的二値化、極性自動反転付き)
  - 台形補正 (4 隅をドラッグして指定 → ホモグラフィで矩形に変形)
- 補正結果のプレビュー (OCR 実行前に確認可能)
- 範囲ごとに OCR を実行 (日本語 + 英語 / 日本語縦書き)
- OCR 結果の一覧表示とクリップボードへのコピー
- 矩形の削除
- ヘルプページ (機能概要 / 使い方 / 既知の制約 / リンク) を内蔵 (`#/help`)
- 折りたたみ式の自己紹介 / プロジェクト情報フッター

## 技術スタック

- React 18
- TypeScript
- Vite 5
- [tesseract.js](https://github.com/naptha/tesseract.js) (OCR エンジン)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) (PDF レンダリング)

CSS フレームワークなし、状態管理は React hooks のみ、ルーティングは hash ベースの自前実装です。

## ディレクトリ構成

```
src/
├── App.tsx              # 画面構成・状態管理
├── main.tsx
├── index.css
├── types.ts             # OCRSelection / Quad / LoadedSource など
├── components/
│   ├── FileLoader.tsx
│   ├── PageViewer.tsx   # canvas 描画 + 矩形 / 台形ハンドル
│   ├── SidePanel.tsx    # 範囲一覧と OCR 結果
│   └── HelpPage.tsx
├── hooks/
│   └── useHashRoute.ts
├── config/
│   └── copyright.ts
└── utils/
    ├── pdf.ts           # pdfjs ラッパ
    ├── ocr.ts           # tesseract.js ラッパ + CJK スペース整形
    ├── crop.ts          # canvas クロップ
    └── preprocess.ts    # 傾き補正 / 白黒補正 / 台形補正
```

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

## 使い方

1. 画面上部の「ファイルを選択」または、表示領域のプレースホルダにファイルを直接ドラッグ＆ドロップ
2. 表示領域でドラッグして OCR したい範囲を矩形選択
3. サイドパネルでラベルや書字方向、補正オプションを設定
4. 必要なら「プレビュー」で補正結果を確認
5. 「OCR実行」を押す。初回のみ学習データ (`jpn` / `jpn_vert`) のダウンロード待ちあり
6. 結果は「コピー」ボタンでクリップボードへ。別ページで作った範囲は `P{n}` ボタンでページ移動してから実行

## GitHub Pages デプロイ方法

`main` ブランチへの push をトリガーに [.github/workflows/deploy.yml](.github/workflows/deploy.yml) が走り、GitHub Pages へ自動デプロイされます。

事前準備 (リポジトリ側で 1 度だけ):

1. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定

`gh` CLI で 1 行で済ませる場合:

```bash
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

公開 URL は `https://<username>.github.io/browser-ocr-cropper/` です。リポジトリ名を変更する場合は [vite.config.ts](vite.config.ts) の `repoName` をリポジトリ名に合わせて変更してください (Pages のサブパス配信のため `base` に使われます)。

## 既知の制約

- OCR の精度は画像品質 (解像度、コントラスト、傾き) に依存します。
- 初回 OCR 実行時に学習データ (`jpn`, `jpn_vert`) を CDN からダウンロードするため待ち時間があります。
- 日本語 OCR は万能ではなく、手書き文字 / 縦書きの複雑なレイアウト / 装飾フォントなどでは精度が落ちます。縦書きは 1 列ごとに矩形を分けるとより安定します。
- GitHub Pages 上では完全にブラウザ実行のため、ページ数の多い PDF や高解像度ファイルでは描画 / OCR が重くなることがあります。
- 傾き補正は ±8° の範囲を 1° 刻みで探索する簡易実装です。それより大きい傾きや極端に小さなクロップではうまく機能しません。
- 台形補正のドラッグ UI は対象ページを表示している時のみ操作可能です。OCR / プレビューも対象ページ表示中のみ実行可能です。

## 今後の拡張候補

- 矩形のドラッグ移動 / リサイズ
- 全選択範囲の一括 OCR
- OCR 結果の CSV / JSON エクスポート
- より高度な画像前処理 (適応的二値化, ノイズ除去, 自動回転検出)
- 認識言語の切り替え UI
- 学習データのローカルキャッシュ / オフライン対応 (Service Worker)
- レスポンシブ最適化 (タブレット / モバイル)
- E2E / ユニットテストの整備
