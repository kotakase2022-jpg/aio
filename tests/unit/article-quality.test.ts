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

  test("passes primary information reflection when first-party terms return in the body", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、現場の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、一次情報は冒頭と各H2の例に戻すべきです。当社の支援現場では、一人親方の事務作業がLINEで進み、帳票不在のまま確認が止まる相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用、帳票の有無を比較します。</td></tr></table>
        <ul><li>失敗例を先に確認します。</li><li>手順と注意点を公開前に照合します。</li></ul>
        <h2>LINEに残る承認と帳票不在をどう記事で説明するか</h2>
        <p>FAQとして、未確認情報は断定せず、参照元と自社の観察を分けて書く必要があります。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("recognizes reflected English first-party information", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には一次情報を戻す必要があります。Our support team sees one-person contractors using LINE for back-office approvals, and forms are often missing at review time.</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用、forms の有無を比較します。</td></tr></table>
        <ul><li>失敗例を先に確認します。</li><li>手順と注意点を公開前に照合します。</li></ul>
        <h2>LINEに残る承認とforms missingの状態をどう説明するか</h2>
        <p>FAQとして、未確認情報は断定せず、参照元と自社の観察を分けて書く必要があります。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "Our support team often sees one-person contractors manage back-office work through LINE, leaving forms missing.",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: true }),
    );
  });

  test("flags article bodies that ignore provided first-party information", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。参照元と照合し、未確認情報は断定しません。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>運用手順を決めます。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、導入前には既存記事、営業資料、問い合わせ履歴を参照します。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("一次情報の固有語彙");
    expect(result.score).toBeLessThan(100);
  });

  test("passes closing CTA reflection when the closing text intent appears near the end", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、導入前には判断基準を決める必要があります。当社の支援現場では、10件の相談で公開前の確認手順が課題でした。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に問い合わせ導線まで確認する</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        closingText:
          "AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "cta-reflection", passed: true }),
    );
  });

  test("flags article bodies that drop the provided closing CTA", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、導入前には判断基準を決める必要があります。当社の支援現場では、10件の相談で公開前の確認手順が課題でした。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        closingText:
          "AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "cta-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("結び文章/CTAの固有語彙");
  });

  test("flags closing CTA terms that appear only outside the ending section", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。この記事では、その前提となる判断基準を整理します。</p>
        <p>結論として、導入前には判断基準を決める必要があります。当社の支援現場では、10件の相談で公開前の確認手順が課題でした。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報</h2>
        <p>${"参照元と照合し、未確認情報は断定しません。".repeat(120)}</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        closingText:
          "AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "cta-reflection", passed: false }),
    );
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

  test("penalizes structured but commodity article HTML without editorial evidence", () => {
    const result = evaluateArticleQuality(`
      <h2>AI活用とは、業務を効率化する取り組みを指します</h2>
      <p>結論として、AI活用は大切です。多くの企業にとって効果的です。</p>
      <table><tr><th>項目</th><td>内容</td></tr></table>
      <ul><li>準備します。</li><li>確認します。</li></ul>
      <h2>FAQ</h2>
      <p>よくある質問に回答します。</p>
      <p>参考: https://example.com/reference</p>
    `);

    expect(result.score).toBeLessThan(85);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "editorial-evidence", passed: false }),
    );
  });

  test("penalizes mechanical headings even when the body has structure", () => {
    const result = evaluateArticleQuality(`
      <h2>重要なポイント</h2>
      <p>結論として、AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します。当社の支援現場では、12件の相談で承認手順の不足が問題になりました。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
      <ul><li>失敗例を確認する</li><li>注意点を整理する</li></ul>
      <h2>まとめ</h2>
      <p>FAQとして、導入前には既存記事、営業資料、問い合わせ履歴を参照します。未確認情報は断定しません。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "editorial-headings", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("機械的な見出し");
    expect(result.score).toBeLessThan(92);
  });

  test("flags strong claims that need conditions or evidence", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>結論として、この方法なら誰でも必ず成果が出ます。すべて解決でき、完全に手作業をなくせます。</p>
      <p>当社の支援現場では、3名体制で確認手順を決める相談が多くあります。参照元の情報と照合し、未確認情報は断定しません。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用を見る</td></tr></table>
      <ul><li>失敗例を確認する</li><li>注意点を整理する</li></ul>
      <h2>FAQ</h2>
      <p>よくある質問として、公開前の確認方法があります。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "unsupported-claims", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("強い断定候補");
  });
});
