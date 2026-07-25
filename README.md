# Fishingforever

ぬし釣りシリーズにインスパイアされた、**釣りシミュ＋収集・鑑賞**ゲームのプロトタイプです。

見た目は **イラスト 2.5D**（Web 3D ポリゴン案はクローズ）。詳細な企画は [`DESIGN.md`](./DESIGN.md) を参照してください。

## いま遊べること（MVP 縦スライス）

- マップ：**はじまりキャンプ**（イラスト 2.5D）
- 釣法：**ウキ釣り**
  1. 岸を歩いて好きな場所へ  
  2. 水際でキャスト  
  3. ウキ待ち → アタリ（ウキ沈み）→ アワセ  
  4. 水中ファイト（魚イラスト鑑賞）  
  5. 釣り上げ画面（体長・重量・図鑑）
- 魚：ヤマメ / アマゴ / ニジマス / オイカワ / ウグイ / カジカ（各種イラストあり）
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
| **WASD** / 矢印 | 岸を移動（**W** で川へ近づく） |
| キャストボタン / Space | 水際でキャスト |
| アワセる！ / Space | ウキ沈み中にアワセ |
| 岸に戻る / Space | 釣果画面を閉じる |
| 時間帯切替（仮） | 朝・昼・夕を切り替え |

## ビルド

```bash
npm run build
npm run preview
```

## アセット

イラストは `public/art/` に配置：

- `bg-camp.jpg` … はじまりキャンプ背景
- `bg-underwater.jpg` … 水中ファイト背景
- `player.png` … プレイヤー
- `bobber.png` … ウキ
- `fish-*.png` … 各種魚

## Vercel へのデプロイ

1. GitHub にこのリポジトリを push  
2. [Vercel](https://vercel.com) で Import  
3. Framework Preset は Vite のままで OK  
4. Build Command: `npm run build`  
5. Output Directory: `dist`  

`vercel.json` を同梱しています。プレビュー URL でプレイテストできます。
