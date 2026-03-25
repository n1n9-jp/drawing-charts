# タブレットデバイス特化の最適化プラン

## Context
このアプリは「描いて予想する折れ線グラフ」クイズ。現在のレスポンシブ対応は600px（モバイル）と900px（レイアウト切り替え）の2段階のみで、タブレット（768〜1080px）向けの最適化がない。タブレット専用に操作性・表示品質を向上させる。

## 対象ファイル
- [quiz.html](quiz.html) — メインのクイズページ（最優先）
- [share.html](share.html) — 結果共有ページ
- [index.html](index.html) — エディタページ

---

## Phase 1: quiz.html CSS — タブレット用メディアクエリ追加

`@media (max-width: 600px)` ブロック（L146）の前にタブレット用ブロックを追加:

```css
@media (min-width: 600px) and (max-width: 1080px) {
  .quiz-app { max-width: 900px; padding: 32px 24px 24px; }
  .ydi-chart-wrap { padding: 20px 24px; }
  .ydi-chart-wrap h2 { font-size: 1.3rem; margin-bottom: 16px; }
  .quiz-lead { font-size: 1rem; margin-bottom: 12px; }
  .ydi-draw-prompt { font-size: 17px; }
  .ydi-value-label { font-size: 14px; }
  .ydi-chart-wrap .axis text { font-size: 13px; }
  .ydi-legend-label { font-size: 13px; }

  /* ボタン・タップターゲット: 44px以上を確保 */
  .ydi-button { padding: 14px 36px; font-size: 17px; border-radius: 6px; }
  .ydi-share-btn { padding: 12px 20px; font-size: 15px; }
  .ydi-share-url input { padding: 10px 14px; font-size: 1rem; }
  .ydi-score { padding: 8px 20px; font-size: 1rem; }
  .site-links { font-size: 0.9rem; padding: 24px 0; }
  .site-links a { padding: 8px 4px; }
}
```

## Phase 2: quiz.html JS — タッチ操作の改善

### 2a. タブレット検出と余白・チャート高さの最適化
`_render()` (L283付近):

```javascript
const screenW = window.innerWidth;
const isMobile = screenW < 600;
const isTablet = screenW >= 600 && screenW <= 1080;

if (isMobile) { margin.right = 70; margin.left = 40; }
else if (isTablet) { margin.right = 110; margin.left = 50; }

// タブレットではチャートを大きく表示（最大400px）
const height = isTablet
  ? Math.min(400, Math.round(window.innerHeight * 0.4))
  : cfg.height;
```

### 2b. 描画線・エンドポイントを太く
タブレットでは指での操作が中心なので視認性を向上:

```javascript
// L463付近
const userStrokeWidth = isTablet ? 4 : 3;
this.userLineSel = g.append("path").attr("class", "ydi-user-line")
  .attr("stroke", cfg.colors.user).attr("stroke-width", userStrokeWidth);

// L464付近
const endpointR = isTablet ? 7 : 5;
this.userCircleSel = g.append("circle").attr("class", "ydi-endpoint")
  .attr("r", endpointR).attr("fill", cfg.colors.user).attr("opacity", 0);
```

### 2c. getCoalescedEvents() で描画をスムーズに
`_bindPointerHandlers()` (L559)のpointermoveハンドラを改善:

```javascript
dragNode.addEventListener("pointermove", function(e) {
  if (!active) return;
  e.preventDefault();
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ce of events) {
    const [mx, my] = d3.pointer(ce, self.g.node());
    self._handleDrag(null, null, mx, my);
  }
}, { passive: false });
```

### 2d. 描画中のタッチカーソルインジケータ
ドラッグ中に半透明の円を表示し、タッチ位置のフィードバックを提供:

```javascript
// _handleDrag内で表示、pointerup時に非表示
```

### 2e. 描画中のスクロール防止を強化
チャートラッパーにtouchmoveイベントのpreventDefaultを追加。

## Phase 3: quiz.html viewport

ピンチズームによる描画中断を防止:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

## Phase 4: share.html

- 同様のタブレット用メディアクエリCSS追加
- JS: `isTablet` 検出とマージン調整

## Phase 5: index.html

- レイアウト切り替えのブレークポイントを900px→1080pxに変更（タブレットでは1カラム表示）
- タブレット用メディアクエリ: フォーム入力のmin-height 44px、font-size 16px（iOS拡大防止）
- ボタン類のタップターゲット44px以上確保

## Phase 6: GPU最適化

タブレットでSVG描画のパフォーマンス向上:
```css
@media (min-width: 600px) and (max-width: 1080px) {
  .ydi-chart-wrap svg { transform: translateZ(0); }
}
```

---

## 検証方法
1. iPad Safari / Chrome でquiz.htmlを開き、描画操作のスムーズさを確認
2. ピンチズームが描画中にブロックされることを確認
3. すべてのボタンが44px以上のタップターゲットを持つことをDevToolsで検証
4. ポートレート・ランドスケープ両方でレイアウトが崩れないことを確認
5. チャートの高さが画面サイズに応じて適切にスケールすることを確認
