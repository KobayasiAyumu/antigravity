# GitHub Stats Dashboard

GitHubユーザーの活動・リポジトリ・言語使用率を美しく可視化するダッシュボードアプリです。

![GitHub Stats Dashboard](https://img.shields.io/badge/GitHub%20Pages-対応-39d353?style=flat-square&logo=github)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-f1e05a?style=flat-square&logo=javascript)
![Chart.js](https://img.shields.io/badge/Chart.js-4.x-ff6384?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ 機能

| 機能 | 説明 |
|---|---|
| 🔍 ユーザー検索 | GitHubユーザー名で検索（公開ユーザー対応） |
| 👤 プロフィールカード | アバター・bio・ location・ブログリンクを表示 |
| 📊 統計カード | 総スター数・リポジトリ数・フォロワー・フォーク数 |
| 🍩 言語使用率 | 上位8言語をドーナツチャートで可視化 |
| 🔥 トップリポジトリ | スター数上位6件をカード表示 |
| 📈 月別アクティビティ | 過去12ヶ月のリポジトリ更新数を棒グラフで表示 |

---

## 🛠 技術スタック

- **HTML5 / CSS3 / JavaScript (ES6+)** — バックエンドなし・フレームワークなし
- **GitHub REST API v3** — 認証不要のパブリックエンドポイントを使用
- **[Chart.js 4.x](https://www.chartjs.org/)** — インタラクティブなグラフ描画
- **Google Fonts (Inter)** — モダンな日本語対応フォント
- **Font Awesome 6** — アイコン

---

## 🚀 GitHub Pagesで公開する方法

1. このリポジトリをGitHubにPushする
2. リポジトリページ → **Settings** → **Pages** を開く
3. **Source** を `Deploy from a branch` に設定
4. **Branch** を `main`、ディレクトリを `/(root)` に設定して **Save**
5. 数分後に以下のURLでアクセス可能になる:
   ```
   https://<あなたのユーザー名>.github.io/<リポジトリ名>/github-stats-dashboard/
   ```

---

## 💻 ローカルで実行する方法

ブラウザで直接 `index.html` を開くだけで動作します。  
（GitHub APIはブラウザから直接アクセス可能なためサーバー不要）

```bash
# このファイルシステム上のパスをブラウザで開く
github-stats-dashboard/index.html
```

---

## 📁 ファイル構成

```
github-stats-dashboard/
├── index.html   # メインHTML・UI構造
├── style.css    # スタイル（ダークモード・グラスモーフィズム）
├── app.js       # GitHub API連携・UI制御
├── charts.js    # Chart.jsグラフ描画ロジック
└── README.md    # このファイル
```

---

## ⚠️ GitHub API レート制限について

GitHub REST API は未認証の場合、**1時間あたり60リクエスト**の制限があります。  
言語情報取得で複数のAPIリクエストを送るため、短時間に多数の検索を行うと制限に達することがあります。

---

## 📄 ライセンス

MIT License

made by Kobayashi