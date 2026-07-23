# Fishingforever

ぬし釣りシリーズにインスパイアされた、**釣りシミュ＋収集・鑑賞**ゲームのプロトタイプです。

詳細な企画は [`DESIGN.md`](./DESIGN.md) を参照してください。

## いま遊べること（MVP 縦スライス）

- マップ：**はじまりキャンプ**（簡易 3D）
- 釣法：**ウキ釣り**
  1. キャスト  
  2. ウキ待ち  
  3. アタリ（ウキ沈み）→ アワセ  
  4. 水中ファイト（鑑賞）  
  5. 釣り上げ画面（体長・重量・図鑑）
- 魚：ヤマメ / アマゴ / ニジマス / オイカワ / ウグイ / カジカ
- 図鑑データはブラウザ `localStorage` に保存

## 必要なもの

- Node.js 20+ 推奨
- npm

## ローカル起動

```bash
cd Fishingforever
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開きます。

## 操作

| 操作 | 内容 |
|------|------|
| クリック「釣りをはじめる」 / Space | タイトルから開始 |
| キャストボタン / Space | キャスト |
| アワセる！ / Space | ウキ沈み中にアワセ |
| 岸に戻る / Space | 釣果画面を閉じる |
| 時間帯切替（仮） | 朝・昼・夕を切り替え |

## ビルド

```bash
npm run build
npm run preview
```

## Vercel へのデプロイ

1. GitHub にこのリポジトリを push  
2. [Vercel](https://vercel.com) で Import  
3. Framework Preset は Vite のままで OK  
4. Build Command: `npm run build`  
5. Output Directory: `dist`  

`vercel.json` を同梱しています。プレビュー URL でプレイテストできます。

## 技術スタック

- Vite + React + TypeScript  
- Three.js / React Three Fiber  
- zustand（ゲーム状態）  

## 今後（DESIGN.md より）

- ルアーフロー（巻取り・つつく・水中誘い・逃走）
- 四季・個体数（幼魚保護）
- 魚・水の表現強化
- スマホ最適化

## ライセンス

個人プロジェクト。企画・プレイテスト歓迎。
