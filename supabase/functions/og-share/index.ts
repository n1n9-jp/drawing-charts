// Supabase Edge Function: OGP対応シェアページ
// SNSクローラーにOGPメタタグを返し、人間のユーザーはshare.htmlにリダイレクトする
//
// デプロイ: supabase functions deploy og-share --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEPLOY_ORIGIN = "https://drawing-line-chart.dataviz.jp";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const shareUrl = `${DEPLOY_ORIGIN}/share.html?id=${id}`;

  // レスポンスデータを取得
  const { data: response } = await supabase
    .from("quiz_responses")
    .select("score_label, quiz_quizzes(title)")
    .eq("id", id)
    .single();

  const title = escapeHtml(
    response?.quiz_quizzes?.title || "描いて答える折れ線グラフ"
  );
  const scoreLabel = escapeHtml(response?.score_label || "結果");
  const ogTitle = `${title} — ${scoreLabel}`;
  const ogDesc = "折れ線グラフの予測結果をチェック！あなたも予測してみよう";
  const ogImage = `${SUPABASE_URL}/storage/v1/object/public/quiz-og-images/${id}.png`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta property="og:type" content="website">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:site_name" content="描いて答える折れ線グラフ">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(shareUrl)}">
<title>${ogTitle}</title>
</head>
<body>
<p>リダイレクト中... <a href="${escapeHtml(shareUrl)}">こちらをクリック</a></p>
</body>
</html>`;

  const body = new TextEncoder().encode(html);
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
