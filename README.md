# 「さわるチャート」

※supabaseなどで別アプリ扱いしないと動作しない。
タッチデバイスで操作することに全振りした、タブレットデバイスでクイズに回答するコンテンツのUIを構築する。

## Context

NYT「You Draw It」やFlourish「Draw The Line」に触発された、ユーザーがトレンドを予想して描画し、実際のデータと比較するインタラクティブ折れ線グラフをテンプレート化する。`_temp`フォルダにNYTの参考実装（build.js内の`drawLine`関数）があり、そのロジックをD3 v7 + vanilla JSでモダンに再実装する。

## ファイル構成

```
drawing-line-chart/
├── index.html          # メインテンプレート（HTML + CSS + JS 一体型）
├── data/
│   └── sample.json     # サンプルデータ（外部データ読み込みのデモ用）
└── _temp/              # 参考資料（既存）
```

**設計判断**: ビルドツール不要。D3 v7はCDNから読み込み。1ファイルで完結させ、コピーするだけで使えるテンプレートにする。

## データ形式

```javascript
const charts = [
  {
    id: "unemployment",              // 一意のID（DOM・clipPath用）
    title: "失業率はどう変化した？",    // チャート上部の見出し（HTML可）
    data: [
      { x: 2000, y: 4.0 },          // x: 横軸値, y: 縦軸値
      { x: 2001, y: 4.7 },
      // ...
    ],
    drawStartX: 2008,               // ここからユーザーが描画する
    // --- 以下オプション（デフォルト値あり） ---
    unit: "%",                       // 値の接尾辞
    yFormat: ",.0f",                 // D3 format文字列
    precision: 0,                    // 小数点以下桁数
    yExtent: 1.5,                    // Y軸上限の倍率
    colors: { known: "#e41a1c", actual: "#377eb8", user: "#ffc700" },
    height: 300,
    margin: { top: 20, right: 60, bottom: 40, left: 50 },
    buttonText: "答え合わせ",
    drawPrompt: ["線を描いて", "予想してみよう"],
    afterRevealHTML: "<p>実際のトレンドは...</p>",
  }
];
```

## 実装の核心ロジック（NYT `drawLine`関数ベース）

### 1. SVG構造

```
<svg>
  <g class="grid">           <!-- グリッド線 -->
  <g class="x-axis">         <!-- X軸 -->
  <g class="y-axis">         <!-- Y軸（NYTは非表示だがオプション化） -->
  <clipPath id="clip-{id}">  <!-- 実データ隠蔽用clipPath -->
    <rect width="{drawStartXのピクセル位置}">
  </clipPath>
  <g clip-path="url(#clip-{id})">
    <path class="area">      <!-- 実データの面積 -->
    <path class="actual-line"> <!-- 実データの線 -->
    <circle>                  <!-- 終点マーカー -->
    <text class="end-value">  <!-- 終点の値ラベル -->
  </g>
  <path class="known-line">  <!-- 既知データの線 -->
  <g class="flash-rects">    <!-- 描画フィードバック用の黄色セル -->
  <path class="user-line">   <!-- ユーザー描画線 -->
  <circle class="user-endpoint"> <!-- ユーザー線の終点 -->
  <text class="user-value">  <!-- ユーザー値ラベル -->
  <text class="draw-prompt"> <!-- 「線を描いて予想」指示テキスト -->
  <rect class="drag-rect">   <!-- 透明なドラッグ領域 -->
</svg>
```

### 2. 描画インタラクション

NYTのロジック（build.js:17375-17430行目）をD3 v7で再実装:

- `d3.drag()` を使用（pointer eventsでマウス・タッチ統合）
- デスクトップ: SVG全体にdrag適用、モバイル: drag-rectのみ
- ドラッグ中:
  1. ポインタ座標 → `xScale.invert()` / `yScale.invert()` でデータ座標に変換
  2. `clamp(drawStartX+1step, endX, x)` と `clamp(0, yMax, y)` で範囲制限
  3. **補間処理**: 高速マウス移動で飛ばされた中間ポイントを線形補間で埋める（NYTの核心ロジック）
  4. `d3.line().defined(d => d.defined)` でユーザー線を描画更新
  5. flash-rectの色を更新（描画済み→透明、未描画→黄色点滅）
  6. 終点マーカーと値ラベルを更新

### 3. 状態遷移

```
idle → drawing（最初のドラッグで`.drag-started`クラス付与、指示テキスト非表示）
drawing → ready（全ポイント描画完了で`.ready`クラス付与、ボタン活性化）
ready → revealed（ボタンクリックで`.guessed`クラス付与、clipPathアニメ開始）
```

### 4. Reveal アニメーション

clipPathの`<rect>`のwidthをトランジション:
```javascript
clipRect.transition().duration(1000)
  .attr('width', innerWidth + margin.right);
```
左から右に実データが「描かれていく」効果。CSSトランジションでボタン→結果テキストの切替。

### 5. スコア計算（オプション）

NYT方式: 各ポイントの `(userValue / actualValue)` の誤差合計。カスタムイベント `you-draw-it:revealed` でスコアを通知。

## CSS設計

`.you-draw-it` スコープで名前衝突回避。主要ルール:

- `.known-line`: stroke-width: 3, fill: none
- `.actual-line`: stroke-width: 3, fill: none
- `.user-line`: stroke-width: 3, stroke-dasharray: 1 7, stroke-linecap: round（点線スタイル）
- `.area`: fill-opacity: 0.15
- `.flash-rect`: animation: flash 0.5s alternate infinite
- `.drag-rect`: fill-opacity: 0, cursor: pointer
- 状態クラス(`.drag-started`, `.ready`, `.guessed`)でUI要素の表示/非表示切替
- `@media (max-width: 600px)` でモバイル対応

## 実装順序

### Step 1: 静的チャート描画
- `index.html` 作成、D3 v7 CDN読み込み
- `YouDrawIt` クラス（複数チャート管理）と `ChartInstance` クラス（個別チャート）
- SVG構造構築、スケール設定、グリッド・軸描画
- 既知データ線と実データ線（clipPathで隠蔽）の描画
- サンプルデータ2-3個を内蔵

### Step 2: 描画インタラクション
- `d3.drag()` によるドラッグ処理
- 補間ロジック実装
- flash-rect、指示テキスト、状態遷移
- タッチ対応テスト

### Step 3: Reveal・仕上げ
- clipPathトランジションによるRevealアニメ
- ボタン、before/after コンテンツ切替
- 終点マーカー・値ラベル（衝突回避含む）
- ResizeObserverでレスポンシブ対応
- スコア計算・カスタムイベント

### Step 4: サンプルデータ
- `data/sample.json` に外部データ読み込みのデモ用データ作成
- `index.html` にインラインデータと外部データ両方の使用例

## 検証方法

1. `index.html` をブラウザで直接開いて動作確認
2. 複数チャートが独立して動作すること
3. マウスとタッチの両方で描画できること
4. 全ポイント描画後にボタンが活性化すること
5. Revealアニメーションが左→右にスムーズに動くこと
6. ウィンドウリサイズでレイアウトが崩れないこと
7. モバイル幅（600px以下）での表示確認

## 評価

条件	現在	提案
totalError < 0.5	ほぼ正解！	ほぼ正解！
totalError < 2	惜しい！	惜しい！
avgRatio < 0.7	低すぎ！	控えめな予想でした
avgRatio > 1.3	高すぎ！	攻めた予想でした
else	ずれていますね	ずれていますね
