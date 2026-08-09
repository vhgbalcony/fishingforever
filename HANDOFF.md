# Fishingforever — セッション引継ぎメモ

> **次の Grok へ:** このファイルを最初に読んでから作業すること。  
> 最終更新: **2026-08-09**（イラスト魚6種＋水中BGを Imagine 級に差し替え）

---

## 30秒サマリ

- **何:** ぬし釣り系インスパイアの清流釣りシミュ（収集・鑑賞）。Web / Vite + React + TS。
- **どこ:** `C:\Users\まい\Fishingforever`
- **GitHub:** https://github.com/vhgbalcony/fishingforever （`master`）
- **本番テスト URL:** https://fishingforever-game.vercel.app  
  （ユーザーPCが弱いので **ローカル `npm run dev` より Git push → Vercel を優先**）
- **いまのフェーズ:** コア・ループは通っている。**感触詰め**（ウキ釣り＋水中ファイト）が主戦場。
- **直近の実装:** 水中は **長押しで寄せる**。種ごとの `pullPower`。0未満で「{種名}に逃げられた。」

---

## ユーザーについて（重要）

| 項目 | 内容 |
|------|------|
| 言語 | 日本語・くだけたトーンでOK |
| ゲーム開発 | ガチ初心者。基礎の説明を歓迎 |
| テスト環境 | **Vercel 経由**（ローカル起動は重いので避ける） |
| モデル原作 | SFC『**川のぬし釣り2**』＋シリーズの操作感 |
| 参考GIF | `C:\Users\まい\Downloads\IMG_8533.GIF`（ヤマノカミ成功） / `IMG_8532.GIF`（ニジマス逃げ） |
| 攻略ブログ | https://oyururi.info/game-retro-20210914-1/ |
| 図鑑参考 | https://oyururi.info/kawanonushitsuri2-sakanazukan1/ 〜 3 |

### 開発の進め方（ユーザー合意済み）

1. **遊べる芯 → 感触 → コンテンツ → 見た目本格** の順
2. 背景マップから作り込まない。判定ガバは **マップ本仕上げ後** でOK
3. 週次の道筋は `WEEKLY.md`、仕様は `DESIGN.md`
4. 変更したら **commit → push `master` → Vercel 自動デプロイ確認** までやるのが定番

---

## いま動いているもの（MVP）

- はじまりキャンプ・縦3パネル探索（上流／中流／下流）、橋のみ横断
- ウキ釣り: キャスト → 待ち → アタリ（沈み）→ アワセ → **水中ファイト** → 釣果
- 魚6種: ヤマメ / アマゴ / ニジマス / オイカワ / ウグイ / カジカ
- 画風切替: イラスト / ピクセル（`artStyle` + `public/art/`）
- 図鑑: localStorage
- 幼魚・成魚・大物ラベル、キープ／リリース

### 水中ファイト（2026-08-06 時点）

```
ヒット → まず暴れる (running)
  ↔ 休む (resting)
休み中に Space/ボタン【長押し】→ 寄せ↑
暴れ中に長押し → 寄せ↓（すぐ離せば軽い傷／ムズ魚は短くても危険）
寄せ 100% → 釣果
寄せ < 0 → 「{種名}に逃げられた。」→ 岸へ
```

- 難易度の芯: `FishSpecies.pullPower`（体長は弱い補正のみ）
- データ: `src/game/fishData.ts`
- ロジック: `src/game/store.ts`（`tickFight` / `setPullHeld` / `escapeFight`）
- UI: `src/game/ui/HUD.tsx`、キー: `src/App.tsx`

| 魚 | pullPower 目安 |
|----|----------------|
| オイカワ | 0.55 |
| カジカ | 0.65 |
| ウグイ | 0.75 |
| ヤマメ | 1.0 |
| アマゴ | 1.05 |
| ニジマス | 1.4 |

### アート（2026-08-09）

- **スタイル錨:** `public/art/ref/anchor-nijimasu-white.jpg`（アプリ Imagine のニジマス）
- **イラスト魚6種** を同画風で差し替え（白背景キーイング済み PNG）
- **水中BG:** 魚なしプレート `bg-underwater.jpg`（横スクロール用に3枚タイル）
- 水中スクロール: 暴れ中は速く流れる／休みは緩い／長押しで速度変化（`Scene2D.tsx`）
- 旧ファイル: `public/art/legacy/`
- **ピクセル画風**は未更新（`public/art/pixel/` のまま）
- マップ3パネルはまだ旧イラスト

最新作業: 長押しファイト + 魚イラスト刷新 + 水中BGスクロール

---

## プレイ感想から出た「次にやりたい」候補

優先はユーザーと確認してから。候補だけ:

| 優先候補 | 内容 | メモ |
|----------|------|------|
| A | 長押しの数字バランス調整 | ニジマスキツすぎ／全体甘い等のフィードバック待ち |
| B | 休み逃しをもう少しシビアに | 連続逃しで逃げ、など |
| C | 水中の魚の動き量・背景感 | 原作GIF参考。ヒレ／横スクロールは後でも可 |
| D | 釣果の吊り上げ1カット | 成功のごほうび |
| E | ウキのツンツン → 本アタリ／見切り | 待ちの変化 |
| F | 竿システム | **未実装**。小物竿＋大物＝休みなし遠泳→理不尽ライン切れ（原作思い出）。感触が固まってから |
| G | マップ当たり判定 | 陸が水扱い・橋が渡れない等。**マップ本仕上げ後**が効率的 |

---

## 触ってよい／まだ広げない

**触ってよい**

- ファイトの秒数・`pullPower`・メッセージ
- 小さめのUI／演出
- ドキュメント（このファイル, DESIGN, WEEKLY）

**まだ広げない（先走り）**

- ルアー完全実装、新マップ量産、魚10種一気追加
- 竿・エサ本実装（設計メモのみ DESIGN にあり）
- マルチ・ランキング

---

## ファイル地図

| パス | 役割 |
|------|------|
| `DESIGN.md` | 企画・仕様 |
| `WEEKLY.md` | 週次リスト・プレイメモ・実装メモ |
| `HANDOFF.md` | **この引継ぎ**（セッションまたぎ用） |
| `README.md` | 起動・操作 |
| `src/game/store.ts` | 状態機械・ファイト |
| `src/game/fishData.ts` | 魚データ・抽選 |
| `src/game/types.ts` | 型 |
| `src/game/world.ts` | マップ・水際・ゾーン |
| `src/game/artAssets.ts` | アセットパス |
| `src/game/scenes/Scene2D.tsx` | 2.5D 描画・ループ |
| `src/game/ui/HUD.tsx` / `CatchResult.tsx` | UI |
| `public/art/` | イラスト／ピクセル素材 |
| `vercel.json` | Vite ビルド設定 |

※ ルートの `_poll_deploy*.mjs` / `payload-*.json` は昔のデプロイ用ゴミ。コミット不要。

---

## デプロイ手順（定番）

```bash
cd C:\Users\まい\Fishingforever
# 変更後
git add <関連ファイルのみ>
git commit -m "英語の完結した文で what + why"
git push origin master
# Vercel が production 自動デプロイ
# 確認: gh api repos/vhgbalcony/fishingforever/commits/<sha>/status
# 本番: https://fishingforever-game.vercel.app
```

チーム: Vercel `vegetable1` / プロジェクト名 `fishingforever-game`

---

## 次セッションの開き方（ユーザー向け）

チャットで例えば:

> Fishingforever の続き。`HANDOFF.md` 読んで。長押しファイトのバランス調整から。

または:

> `C:\Users\まい\Fishingforever\HANDOFF.md` を読んで続きお願い

---

## 中断時の状態（2026-08-06）

- [x] 長押しファイト実装・push・Vercel 成功
- [ ] ユーザーの長押し版プレイ感想・バランス調整
- [ ] 次機能は未決定（上の候補表から選ぶ）
- ユーザーはこのあと **Grok Build 自体のアプデ**に入る予定
