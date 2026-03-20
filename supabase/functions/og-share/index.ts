// Supabase Edge Function: OGP対応シェアページ
// SNSクローラーにOGPメタタグを返し、人間のユーザーはshare.htmlにリダイレクトする
//
// デプロイ: supabase functions deploy og-share --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEPLOY_ORIGIN = "https://drawing-line-chart.dataviz.jp";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HTML特殊文字のエスケープ + 非ASCII文字を数値文字参照に変換
// これによりレスポンスが純ASCIIになり、エンコーディング問題を回避
function escapeToAsciiHtml(str: string): string {
  let result = "";
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (ch === "&") result += "&amp;";
    else if (ch === '"') result += "&quot;";
    else if (ch === "<") result += "&lt;";
    else if (ch === ">") result += "&gt;";
    else if (code > 127) result += `&#x${code.toString(16)};`;
    else result += ch;
  }
  return result;
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

  const title = escapeToAsciiHtml(
    response?.quiz_quizzes?.title || "\u63cf\u3044\u3066\u7b54\u3048\u308b\u6298\u308c\u7dda\u30b0\u30e9\u30d5"
  );
  const scoreLabel = escapeToAsciiHtml(response?.score_label || "\u7d50\u679c");
  const ogTitle = `${title} &#x2014; ${scoreLabel}`;
  const ogDesc = escapeToAsciiHtml("\u6298\u308c\u7dda\u30b0\u30e9\u30d5\u306e\u4e88\u6e2c\u7d50\u679c\u3092\u30c1\u30a7\u30c3\u30af\uff01\u3042\u306a\u305f\u3082\u4e88\u6e2c\u3057\u3066\u307f\u3088\u3046");
  const siteName = escapeToAsciiHtml("\u63cf\u3044\u3066\u7b54\u3048\u308b\u6298\u308c\u7dda\u30b0\u30e9\u30d5");
  const redirectMsg = escapeToAsciiHtml("\u30ea\u30c0\u30a4\u30ec\u30af\u30c8\u4e2d...");
  const clickHere = escapeToAsciiHtml("\u3053\u3061\u3089\u3092\u30af\u30ea\u30c3\u30af");
  const ogImage = `${SUPABASE_URL}/storage/v1/object/public/quiz-og-images/${id}.png`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta property="og:type" content="website">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:site_name" content="${siteName}">
<meta property="og:url" content="${shareUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${ogImage}">
<meta http-equiv="refresh" content="0;url=${shareUrl}">
<title>${ogTitle}</title>
</head>
<body>
<p>${redirectMsg} <a href="${shareUrl}">${clickHere}</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
