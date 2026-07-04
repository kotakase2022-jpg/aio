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

  test("passes theme and keyword reflection when topic terms return in the body", () => {
    const result = evaluateArticleQuality(
      `
        <h2>一人親方の労災保険とは、現場で働く個人事業主が業務上の事故に備える特別加入制度を指します</h2>
        <p>結論として、一人親方が最初に確認すべきなのは加入条件、給付基礎日額、補償開始日の3点です。参照元と照合し、未確認情報は断定しません。</p>
        <table><tr><th>判断基準</th><td>加入条件、給付基礎日額、費用、手続き期間を比較します。</td></tr></table>
        <ul><li>失敗例は、加入条件だけを見て補償開始日を確認しないことです。</li><li>注意点として、労働保険事務組合ごとの運用差があります。</li></ul>
        <h2>加入前に給付基礎日額と費用を並べて見る理由</h2>
        <p>FAQとして、想定読者が「自分は対象か」を判断できるように、条件と例外を分けて説明します。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        themeText:
          "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用。想定読者: 建設業の一人親方。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "theme-keyword-reflection", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("flags article bodies that drift away from the provided theme and keywords", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        themeText:
          "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用。想定読者: 建設業の一人親方。",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "theme-keyword-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("テーマ・キーワードの固有語彙");
    expect(result.score).toBeLessThan(100);
  });

  test("passes reference information reflection when source-specific terms return in the body", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、参照情報から固有の確認項目を戻す必要があります。現場の相談では、3つの資料を照合して未確認情報を断定しないことが大切です。</p>
        <table><tr><th>判断基準</th><td>厚生労働省の説明、特別加入、給付基礎日額、補償開始日を比較します。</td></tr></table>
        <ul><li>失敗例として、加入条件だけを見て期間や費用を確認しないケースがあります。</li><li>注意点は労働保険事務組合の手続きと参照元を分けて書くことです。</li></ul>
        <h2>一人親方労災保険で読者が最初に見るべき確認軸</h2>
        <p>FAQとして、参照元にない数字は断定せず、条件と例外を添えます。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        referenceTexts: [
          "厚生労働省の一人親方労災保険では、特別加入、給付基礎日額、労働保険事務組合、補償開始日を確認する必要がある。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "reference-info-reflection", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("flags article bodies that ignore provided reference information", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。現場の相談では、3つの資料を照合して未確認情報を断定しないことが大切です。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        referenceTexts: [
          "厚生労働省の一人親方労災保険では、特別加入、給付基礎日額、労働保険事務組合、補償開始日を確認する必要がある。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "reference-info-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("参照情報の固有語彙");
    expect(result.score).toBeLessThan(100);
  });

  test("passes competitor insight reflection when comparison axes return in the body", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造と差別化軸を同時に設計する記事を指します</h2>
        <p>結論として、競合記事が料金表と導入期間を前面に出す場合、自社記事では運用定着と承認フローの失敗例まで踏み込むと比較されやすくなります。</p>
        <table><tr><th>比較軸</th><td>料金表、導入期間、補助金申請、運用定着、承認フローを比較します。</td></tr></table>
        <ul><li>失敗例として、費用だけで判断し、運用定着の担当や期間を決めないケースがあります。</li><li>注意点は、補助金申請の一般論と自社の支援範囲を分けることです。</li></ul>
        <h2>競合が料金表で訴求するなら、承認フローの詰まりを差別化する</h2>
        <p>FAQでは、参照元と競合LPを照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        competitorTexts: [
          "競合記事Aは料金表と導入期間を強調。競合LP Bは補助金申請を訴求。差別化ポイントは運用定着と承認フローの支援。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-reflection", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("flags article bodies that ignore provided competitor insights", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      {
        competitorTexts: [
          "競合記事Aは料金表と導入期間を強調。競合LP Bは補助金申請を訴求。差別化ポイントは運用定着と承認フローの支援。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("競合情報の固有語彙");
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

  test("flags articles where most H2/H3 sections are thin even if the article has structure", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>結論として、定義を明確にします。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
      <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
      <h2>導入前に整理すること</h2>
      <p>準備と確認を進めます。</p>
      <h3>公開前のチェック</h3>
      <p>FAQとしてよくある質問に回答します。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "section-specificity", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("薄いセクション");
    expect(result.score).toBeLessThan(90);
  });

  test("allows one short FAQ-style section when the other sections are concrete", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、最初の400文字以内に判断基準を示す必要があります。当社の支援現場では、10件中6件で承認担当と出典確認の手順が曖昧になり、公開直前の手戻りが起きていました。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>編集者が公開前に見るべき3つの確認軸</h2>
      <p>1つ目は参照元との照合、2つ目は現場例の出どころ、3つ目はWordPress投稿前の承認状態です。担当者と期限を決めると、公開後の修正リスクを下げられます。</p>
      <h2>FAQ</h2>
      <p>よくある質問として、参照元にない情報をどう扱うべきかがあります。未確認情報は断定しません。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "section-specificity", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
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
