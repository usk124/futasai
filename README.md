# 👛 ふたりの財布（ふたサイ）

カップル・夫婦のための割り勘管理PWAアプリ。

---

## 🚀 Vercelで公開する手順

### ステップ1：アイコン画像を生成する

1. `public/generate-icons.html` をブラウザで開く
2. 3つのボタンを順番にクリックして画像を保存
3. 保存した `icon-192.png`、`icon-512.png`、`apple-touch-icon.png` を `public/` フォルダに入れる

### ステップ2：GitHubにアップロードする

1. [github.com](https://github.com) でアカウントを作成（無料）
2. 「New repository」→ リポジトリ名を `futasai` に設定→「Create」
3. ページに表示されたコマンドをターミナルで実行：

```bash
# このフォルダで実行
npm install
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのID/futasai.git
git push -u origin main
```

### ステップ3：Vercelにデプロイする

1. [vercel.com](https://vercel.com) でGitHubアカウントでログイン（無料）
2. 「Add New Project」→ `futasai` リポジトリを選択
3. 設定はそのままで「Deploy」をクリック
4. 数分でURLが発行される（例：`https://futasai.vercel.app`）

### ステップ4：iPhoneのホーム画面に追加する

1. iPhoneのSafariでURLを開く
2. 画面下の「共有ボタン（□↑）」をタップ
3. 「ホーム画面に追加」→「追加」
4. アプリとしてホーム画面に表示される ✅

---

## 📁 ファイル構成

```
futasai/
├── public/
│   ├── manifest.json        # PWA設定
│   ├── favicon.svg          # ブラウザタブアイコン
│   ├── icon-192.png         # ★要生成
│   ├── icon-512.png         # ★要生成
│   ├── apple-touch-icon.png # ★要生成（iOS用）
│   └── generate-icons.html  # アイコン生成ツール
├── src/
│   ├── App.jsx              # メインアプリ
│   └── main.jsx             # エントリーポイント
├── index.html               # PWAメタタグ設定済み
├── vite.config.js           # Vite + PWA設定
├── package.json
├── vercel.json
└── .gitignore
```

## 🛠 ローカルで動かす

```bash
npm install
npm run dev
# → http://localhost:5173 で確認
```

## 📦 ビルド

```bash
npm run build
# → dist/ フォルダにビルド済みファイルが出力される
```

---

## PWAとして認識される条件

- ✅ HTTPS で配信（Vercelは自動対応）
- ✅ manifest.json が正しく設定されている
- ✅ アイコン画像が存在する
- ✅ Service Worker が登録されている（vite-plugin-pwaが自動生成）
