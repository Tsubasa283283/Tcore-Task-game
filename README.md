# T-core 修行型タスク管理ゲーム

HTML / CSS / JavaScriptのみで動く完全ローカルアプリです。外部APIは使いません。

## ファイル構成

- `index.html`
- `styles.css`
- `app.js`
- `assets/coach.png`（任意。なくてもプレースホルダー表示）

## 使い方

1. `index.html` をブラウザで開く
2. タスクを追加する
3. 完了ボタンでEXPとステータスを上げる
4. `月末ボス戦` を押して当月達成率で勝敗判定

## 保存データ

- `localStorage.tcore_tasks`
- `localStorage.tcore_stats`

リロード後も状態を維持します。
