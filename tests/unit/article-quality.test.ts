import { describe, expect, test } from "vitest";
import { evaluateArticleQuality } from "@/lib/article-quality";

describe("evaluateArticleQuality", () => {
  test("rewards concrete, structured, source-aware article HTML", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>当社の支援現場では、10名以下のチームで承認がLINEに偏り、帳票が残らない相談が多くあります。参照元の情報と照合し、未確認の数字は断定しません。</p>
      <table><tr><th>判断基準</th><td>担当者、期間、費用を確認してください。</td></tr></table>
      <ul><li>失敗例を先に確認するためです。</li><li>運用手順を決めると、公開前の手戻りを減らせます。</li></ul>
      <h2>FAQ</h2>
      <p>よくある質問として、導入前にどの資料を集めるべきかがあります。最初は既存記事、営業資料、問い合わせ履歴の3点で十分です。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  test("flags generic AI-like and underspecified article HTML", () => {
    const result = evaluateArticleQuality(`
      <h2>重要なポイント</h2>
      <p>近年、多くの企業で注目されています。さまざまな取り組みが重要です。重要です。重要です。</p>
      <p>まとめると、必要不可欠と言えるでしょう。いかがでしょうか。</p>
    `);

    expect(result.score).toBeLessThan(70);
    expect(result.improvements.join(" ")).toContain("凡庸表現");
    expect(result.checks.some((check) => check.id === "concrete-detail" && !check.passed)).toBe(
      true,
    );
  });
});
