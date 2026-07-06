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

  test("does not treat English attribution fragments inside other words as first-party context", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article operations require source notes and approval owners</h2>
        <p>The opening reviews approval owners, LINE workflows, missing forms, and back-office records. However, this paragraph only describes the workflow hour and the review power structure; it never attributes the claim to a company team.</p>
        <table><tr><th>Decision point</th><td>Approval owner, LINE workflow, forms status, and review timing are checked before publication.</td></tr></table>
        <ul><li>Failure pattern: teams publish field-like claims without attribution.</li><li>Review note: keep source notes and caveats near operational claims.</li></ul>
        <h2>Back-office records need attributed operating claims</h2>
        <p>FAQ: editors separate source evidence from unsupported operational anecdotes. Source: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "Our support team sees LINE approvals, missing forms, and unclear back-office records in review workflows.",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-opening-placement", passed: false }),
    );
  });

  test("does not count English first-party signal terms inside longer words", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article operations require attributed operational evidence</h2>
        <p>Our editors describe platform alpha beta evidence before publication, but this copy never mentions the missing document term from the input.</p>
        <table><tr><th>Decision point</th><td>Alpha, beta evidence and publication timing are checked before approval.</td></tr></table>
        <ul><li>Failure pattern: teams treat platform wording as if it reflected the original field input.</li><li>Review note: keep exact operational terms visible when they matter.</li></ul>
        <h2>Platform wording is not enough for original evidence</h2>
        <p>FAQ: editors separate source evidence from first-party claims. Source: https://example.com/reference</p>
      `,
      {
        primaryInfo: "Our form alpha beta",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: false }),
    );
  });

  test("flags first-party information that is only mentioned after a generic opening", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article operations require source notes and approval owners</h2>
        <p>The opening should give readers a concrete decision point before background context. Editors compare source status, owner, timing, and caveats before publication.</p>
        <p>${"Before approval, editors separate confirmed source claims, publication caveats, owner names, review timing, and visible source notes so readers can verify the final recommendation. ".repeat(4)}</p>
        <table><tr><th>Decision point</th><td>Owner, timing, source check, and publication caveat are compared before the draft is approved.</td></tr></table>
        <ul><li>Failure pattern: unsupported claims are published without a source note.</li><li>Review note: keep the source URL visible near the claim.</li></ul>
        <h2>Field notes from the support team change the article angle</h2>
        <p>Our support team observed one-person contractors using LINE for back-office approvals, with forms missing at review time.</p>
        <p>Source: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "Our support team often sees one-person contractors manage back-office work through LINE, leaving forms missing.",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-reflection", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-opening-placement", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("一次情報の固有語彙");
    expect(result.score).toBeLessThan(100);
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

  test("flags primary information that is pasted verbatim instead of editorially digested", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、現場の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、一次情報は読者が判断できる材料に編集して戻す必要があります。当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。</p>
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
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-digestion", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("入力文が長くそのまま使われています");
    expect(result.score).toBeLessThan(100);
  });

  test("allows short exact input phrases when the surrounding article is editorially rewritten", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元と現場観察を分けて判断材料にする記事を指します</h2>
        <p>結論として、本文には短い固有語句を残してよい一方、長い入力文は判断基準へ言い換える必要があります。当社の支援現場では、LINE承認と帳票不在を公開前の確認軸に置きます。</p>
        <table><tr><th>判断基準</th><td>特別加入、給付基礎日額と補償開始日、料金表と導入期間、承認担当を比較します。</td></tr></table>
        <ul><li>失敗例として、参照元の制度説明と自社経験を同じ根拠として断定するケースがあります。</li><li>注意点は、競合の訴求を写さず、自社記事の不足論点として再構成することです。</li></ul>
        <h2>短い固有語句を残し、長い文は判断基準へ変える</h2>
        <p>FAQとして、参照情報は出典注記へ、競合情報は比較軸へ、一次情報は現場観察として分けます。出典: https://example.com/reference</p>
      `,
      {
        primaryInfo:
          "当社の支援現場では、LINE承認と帳票不在が公開前レビューの詰まりになりやすい。",
        referenceTexts: [
          "一人親方労災保険では、特別加入、給付基礎日額と補償開始日、労働保険事務組合を確認する必要がある。",
        ],
        competitorTexts: [
          "競合記事Aは料金表と導入期間を強調し、補助金申請を訴求する一方、運用定着と承認フローの支援は薄い。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "primary-info-digestion", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "reference-info-digestion", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-digestion", passed: true }),
    );
    expect(result.improvements.join(" ")).not.toContain("長い文がそのまま");
    expect(result.improvements.join(" ")).not.toContain("入力文が長くそのまま");
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

  test("passes target length alignment when the body is close to the selected word count", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照情報と現場判断をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。${"現場の判断基準と失敗例を参照情報にもとづいて確認し、担当者、費用、期間、注意点を読者が比較できる形にします。".repeat(28)}</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
      `,
      { targetWordCount: 2000 },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "target-length-alignment", passed: true }),
    );
  });

  test("flags bodies that are far shorter than the selected word count", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照情報を整理する記事を指します</h2>
        <p>結論として、公開前には出典と一次情報を確認します。</p>
        <table><tr><th>判断基準</th><td>担当者を確認します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>出典確認の進め方</h2>
        <p>FAQとして、参照元を確認します。出典: https://example.com/reference</p>
      `,
      { targetWordCount: 3000 },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "target-length-alignment", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("指定された3,000字");
    expect(result.score).toBeLessThan(100);
  });

  test("flags bodies that are far longer than the selected word count", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。${"現場の判断基準、失敗例、担当者、費用、期間、注意点、比較軸を確認し、読者が公開前に迷わないよう整理します。".repeat(38)}</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
      `,
      { targetWordCount: 1000 },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "target-length-alignment", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("指定された1,000字");
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

  test("flags source-aware bodies that omit the actual source URL", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。</p>
      `,
      { sourceUrls: ["https://example.com/reference"] },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("参照元URL");
    expect(result.score).toBeLessThan(100);
  });

  test("recognizes source URLs that are kept as article links", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。</p>
        <p>出典: <a href="https://example.com/reference">Reference page</a></p>
      `,
      { sourceUrls: ["https://example.com/reference/"] },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("recognizes source URLs when the article drops a leading www prefix", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: teams quote claims without keeping a visible source URL.</li><li>Review note: keep the source URL beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference">Reference page</a></p>
      `,
      { sourceUrls: ["https://www.example.com/reference/"] },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("requires each main source URL to remain visible when multiple references are provided", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。</p>
        <p>出典: https://example.com/reference-a</p>
      `,
      {
        sourceUrls: [
          "https://example.com/reference-a",
          "https://example.com/reference-b",
          "https://example.com/reference-c",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("https://example.com/reference-b");
    expect(result.improvements.join(" ")).toContain("https://example.com/reference-c");
  });

  test("deduplicates www variants before choosing the main source URLs to verify", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: duplicate source variants can hide a missing second source.</li><li>Review note: keep each distinct source URL beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference">Reference page</a></p>
      `,
      {
        sourceUrls: [
          "https://www.example.com/reference/",
          "https://example.com/reference",
          "https://www.example.com/reference",
          "https://example.com/second-source",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("https://example.com/second-source");
  });

  test("deduplicates http and https source variants before checking distinct sources", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: protocol variants can hide a missing second source.</li><li>Review note: keep each distinct source URL beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference">Reference page</a></p>
      `,
      {
        sourceUrls: [
          "http://example.com/reference/",
          "https://example.com/reference",
          "https://example.com/second-source",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("https://example.com/second-source");
  });

  test("deduplicates tracking query variants without hiding a distinct source URL", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: tracking query variants can hide a missing second source.</li><li>Review note: keep each distinct source URL beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference">Reference page</a></p>
      `,
      {
        sourceUrls: [
          "https://example.com/reference?utm_source=newsletter&utm_campaign=aio",
          "https://example.com/reference?fbclid=tracking-value",
          "https://example.com/second-source",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("https://example.com/second-source");
  });

  test("keeps meaningful query parameters distinct when checking source URLs", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: meaningful query parameters can point to different source records.</li><li>Review note: keep each distinct source URL beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference?id=primary">Primary reference</a></p>
      `,
      {
        sourceUrls: [
          "https://example.com/reference?id=primary&utm_source=newsletter",
          "https://example.com/reference?id=secondary&utm_source=newsletter",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("https://example.com/reference?id=secondary");
  });

  test("recognizes a source URL when only tracking query parameters are omitted in the article", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: tracking query parameters should not force noisy source notes.</li><li>Review note: keep the meaningful source identifier beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference?id=primary">Primary reference</a></p>
      `,
      {
        sourceUrls: ["https://example.com/reference?id=primary&utm_source=newsletter"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("recognizes visible source URLs when meaningful query parameters appear in a different order", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: query parameter ordering should not create duplicate source requirements.</li><li>Review note: keep the meaningful source identifier beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference?page=1&id=primary">Primary reference</a></p>
      `,
      {
        sourceUrls: ["https://example.com/reference?id=primary&page=1&utm_source=newsletter"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("recognizes escaped source URLs with uppercase HTML ampersand entities", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: escaped source links can otherwise look missing to the quality checker.</li><li>Review note: keep the meaningful source identifier beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference?page=1&AMP;id=primary">Primary reference</a></p>
      `,
      {
        sourceUrls: ["https://example.com/reference?id=primary&page=1&utm_source=newsletter"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("recognizes escaped source URLs with numeric HTML ampersand entities", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: CMS-exported numeric entities can otherwise make visible source links look missing.</li><li>Review note: keep the meaningful source identifier beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: <a href="https://example.com/reference?page=1&#038;id=primary">Primary reference</a></p>
      `,
      {
        sourceUrls: ["https://example.com/reference?id=primary&page=1&utm_source=newsletter"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("recognizes source URLs from fully escaped anchor attributes in quality checks", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article draft source handling</h2>
        <p>Before publication, the editor confirms source conditions and keeps the primary reference visible for readers.</p>
        <table><tr><th>Decision point</th><td>Compare owner, timing, source check, and practical follow-up.</td></tr></table>
        <ul><li>Failure pattern: escaped anchor markup can otherwise make visible source links look missing.</li><li>Review note: keep the meaningful source identifier beside the supporting claim.</li></ul>
        <h2>Source notes readers can verify</h2>
        <p>Use the source note for facts that influence the final recommendation.</p>
        <p>Source: &lt;a href=&quot;https://example.com/reference?page=1&amp;id=primary&quot;&gt;Primary reference&lt;/a&gt;</p>
      `,
      {
        sourceUrls: ["https://example.com/reference?id=primary&page=1&utm_source=newsletter"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
  });

  test("passes when all main source URLs are kept in a compact source note", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照元の判断材料まで引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。</p>
        <p>出典: https://example.com/reference-a / https://example.com/reference-b / https://example.com/reference-c</p>
      `,
      {
        sourceUrls: [
          "https://example.com/reference-a",
          "https://example.com/reference-b",
          "https://example.com/reference-c",
          "https://example.com/reference-d",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "source-url-presence", passed: true }),
    );
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

  test("flags reference information that is pasted verbatim instead of source-edited", () => {
    const result = evaluateArticleQuality(
      `
        <h2>一人親方労災保険とは、特別加入の条件と補償開始日を確認して判断する制度を指します</h2>
        <p>結論として、加入前には条件、費用、補償開始日を分けて確認する必要があります。厚生労働省の一人親方労災保険では、特別加入、給付基礎日額、労働保険事務組合、補償開始日を確認する必要がある。</p>
        <table><tr><th>判断基準</th><td>特別加入、給付基礎日額、費用、補償開始日を比較します。</td></tr></table>
        <ul><li>失敗例は、加入条件だけを見て補償開始日を確認しないことです。</li><li>注意点として、労働保険事務組合ごとの運用差があります。</li></ul>
        <h2>給付基礎日額と補償開始日を先に照合する理由</h2>
        <p>FAQとして、参照元にない費用や対象範囲は断定しません。出典: https://example.com/reference</p>
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
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "reference-info-digestion", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("参照情報の長い文");
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

  test("does not treat lp fragments inside English words as competitor positioning", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article operations require source-aware publishing workflows</h2>
        <p>Conclusion: the article should explain pricing, implementation timeline, grant support, onboarding, and approval flow without pretending that these terms alone are a competitive comparison.</p>
        <table><tr><th>Decision point</th><td>Pricing, implementation timeline, grant support, onboarding, and approval flow are organized for publication checks.</td></tr></table>
        <ul><li>Failure pattern: multiple operational points appear without a contrast.</li><li>Review note: help readers verify source notes and caveats.</li></ul>
        <h2>Publishing workflows still need a clear contrast</h2>
        <p>FAQ: editors should add actual comparison axes before calling this a differentiated article. Source: https://example.com/reference</p>
      `,
      {
        competitorTexts: [
          "A rival article emphasizes pricing and implementation timeline. Another landing page promotes grant support, while onboarding and approval flow are thinner.",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-reflection", passed: false }),
    );
  });

  test("does not count English competitor signal terms inside longer words", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO article operations need a real comparison axis</h2>
        <p>Compared with rival pages, the platform explains grant support, onboarding, and pricing, but it does not mention the missing document term from the competitor input.</p>
        <table><tr><th>Decision point</th><td>Grant support, onboarding, pricing, and publication caveats are compared.</td></tr></table>
        <ul><li>Failure pattern: platform wording can hide a missing competitor term.</li><li>Review note: add the actual comparison axis before approval.</li></ul>
        <h2>Missing terms should not pass competitor reflection</h2>
        <p>FAQ: editors should verify competitor-specific terms before publishing. Source: https://example.com/reference</p>
      `,
      {
        competitorTexts: ["Form grant onboarding pricing"],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-reflection", passed: false }),
    );
  });

  test("flags competitor information that is pasted verbatim instead of reframed", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、AI検索で引用されやすい構造と差別化軸を同時に設計する記事を指します</h2>
        <p>結論として、競合がどこまで説明しているかを比較し、自社記事では不足論点まで補う必要があります。競合記事Aは料金表と導入期間を強調し、競合LP Bは補助金申請を訴求する一方、運用定着と承認フローの支援は薄い。</p>
        <table><tr><th>比較軸</th><td>料金表、導入期間、補助金申請、運用定着、承認フローを比較します。</td></tr></table>
        <ul><li>失敗例として、費用だけで判断し、運用定着の担当や期間を決めないケースがあります。</li><li>注意点は、補助金申請の一般論と自社の支援範囲を分けることです。</li></ul>
        <h2>料金表訴求だけでは拾えない承認フローの詰まり</h2>
        <p>FAQでは、参照元と競合LPを照合し、未確認情報は断定しません。出典: https://example.com/reference</p>
      `,
      {
        competitorTexts: [
          "競合記事Aは料金表と導入期間を強調し、競合LP Bは補助金申請を訴求する一方、運用定着と承認フローの支援は薄い。",
        ],
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-reflection", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "competitor-insight-digestion", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("競合情報の長い文");
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

  test("flags boilerplate opening frames even when the article has some concrete details", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>本記事では、AIO記事の作成方法について解説します。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>公開前に確認すべき3つの編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-opening-frame", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("テンプレ表現");
    expect(result.score).toBeLessThan(100);
  });

  test("flags dense generic phrases in the opening even when later sections are concrete", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、AIO記事では参照元、一次情報、競合差分を分けて公開前に確認します。本記事では、この確認体制が重要です。公開前レビューでは、承認担当、出典、未確認情報の扱いを同じ表で見比べます。</p>
      <p>当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。一人親方支援ではLINEで相談が進み、帳票や確認履歴が残らないまま原稿化されるケースがあります。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-opening-density", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("冒頭420文字以内");
    expect(result.score).toBeLessThan(100);
  });

  test("flags repeated explain-and-introduce boilerplate beyond the opening", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。参照URL、一次情報、競合差分、WordPress承認状態を分けると、公開直前の差し戻し理由を説明しやすくなります。特に一人親方支援の現場では、LINEで相談が進み、帳票や確認履歴が残らないまま原稿化されるケースがあります。この前提を先に示すと、読者はどの情報を根拠として扱い、どの情報を自社経験として読むべきか判断できます。公開前レビューでは、担当者、期限、出典、未確認情報の扱いを同じ表で見比べると、修正責任の所在が曖昧になりにくくなります。</p>
      <p>レビュー担当者は、引用可能な制度情報と、支援現場で観察した相談傾向を別々に確認します。競合記事が一般論だけで構成されている場合は、自社で見た失敗例、確認手順、問い合わせ前に準備する情報を本文へ戻します。こうした編集手順があると、AI検索に引用されても根拠と経験の境界が読者に伝わります。</p>
      <p>公開前チェックをわかりやすく解説します。次に、競合比較の見方を詳しく解説します。最後に、WordPress投稿前の確認軸を紹介します。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、公開前に承認担当と修正責任を決めることです。</li></ul>
      <h2>公開前に確認する判断基準</h2>
      <p>FAQとして、未確認情報は断定せず、参照元と自社の観察を分けて書きます。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-phrases", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-opening-frame", passed: true }),
    );
    expect(result.improvements.join(" ")).toContain("凡庸表現");
  });

  test("flags softened generic claims that still make the opening sound AI-written", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前の確認体制が重要になります。記事作成では、参照元の整理が求められます。競合との差分を確認することも欠かせません。</p>
      <p>当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、公開前に承認担当と修正責任を決めることです。</li></ul>
      <h2>公開前に確認する判断基準</h2>
      <p>FAQとして、未確認情報は断定せず、参照元と自社の観察を分けて書きます。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-phrases", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-opening-frame", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("凡庸表現");
  });

  test("flags generic ending frames that make the article close like commodity AI copy", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用されやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認する必要があります。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧なまま公開前に差し戻されました。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>公開前に承認担当を決めます。</li><li>未確認の数字は条件付きで書きます。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>FAQでは、どの情報を本文に残し、どの情報を未確認として扱うかを明確にします。出典: https://example.com/reference</p>
      <p>いかがでしたでしょうか。ぜひ参考にしてください。</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-ending-frame", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("定型表現");
    expect(result.score).toBeLessThan(100);
  });

  test("flags repetitive connector patterns that make copy sound machine-written", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、最初に判断基準を示す必要があります。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <p>また、参照元と自社の経験を分けて書きます。また、未確認の数字は断定しません。また、公開前に担当者と期限を確認します。また、WordPress投稿前に承認状態を確認します。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>公開前に確認すべき3つの編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "connector-variety", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("同じ接続表現");
    expect(result.score).toBeLessThan(100);
  });

  test("flags verbose AI-like predicates that make copy sound generated", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前の判断基準を明確にすることが重要です。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <p>参照元と自社の経験を分けることができます。未確認の数字は断定しないことができます。公開前に担当者と期限を確認することが大切です。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>公開前に確認すべき3つの編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "verbose-ai-phrasing", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("冗長なAI風表現");
    expect(result.score).toBeLessThan(100);
  });

  test("flags English commodity AI phrases in bilingual generated copy", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO article quality means source-aware editorial judgment for AI search</h2>
      <p>In this article, we explain how to utilize AI content in order to create various useful drafts. It is important to align sources before publishing. AIO can help teams improve efficiency, follow best practices, streamline reviews, enhance productivity, and leverage automation, but our support team observed 12 review cases where approval owners and source checks were unclear.</p>
      <table><tr><th>Decision point</th><td>Owner, timing, source URL, caveat, and WordPress approval status are compared before publication.</td></tr></table>
      <ul><li>Failure pattern: editors mix source claims and first-party observations without attribution.</li><li>Review note: keep source notes and conditions close to the claim.</li></ul>
      <h2>Where approval owners cause last-minute editorial rework</h2>
      <p>FAQ: teams should separate source evidence, field observations, and unsupported information before approval. Source: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-phrases", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "generic-opening-frame", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "verbose-ai-phrasing", passed: false }),
    );
    expect(result.score).toBeLessThan(100);
  });

  test("flags repeated formulaic sentence frames that make copy feel templated", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前の判断基準を先に示す必要があります。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <p>具体的には、参照元と自社の経験を分けて書きます。具体的には、未確認の数字は断定しません。具体的には、公開前に担当者と期限を確認します。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>公開前に確認すべき3つの編集判断</h2>
      <p>具体的には、WordPress投稿前に承認状態を確認します。FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "sentence-frame-variety", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("定型的な文頭");
    expect(result.score).toBeLessThan(100);
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

  test("flags thin placeholder tables that do not help decision making", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、社内経験、競合との差分を分けて確認する必要があります。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧なまま公開直前に差し戻されました。</p>
      <table><tr><th>項目</th><td>内容</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件や参照元を書くことです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>編集者は担当、期間、費用、未確認情報の扱いを分けます。参照元: https://example.com/reference</p>
      <h2>FAQ</h2>
      <p>よくある質問では、参照元にない数字をどう扱うべきかを条件付きで回答します。</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "comparison-table", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("表はありますが");
  });

  test("passes useful decision tables with concrete comparison axes", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、社内経験、競合との差分を分けて確認する必要があります。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧なまま公開直前に差し戻されました。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件や参照元を書くことです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>編集者は担当、期間、費用、未確認情報の扱いを分けます。参照元: https://example.com/reference</p>
      <h2>FAQ</h2>
      <p>よくある質問では、参照元にない数字をどう扱うべきかを条件付きで回答します。</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "comparison-table", passed: true }),
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

  test("penalizes vague about-style headings that hide the editorial angle", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、最初の400文字以内に判断基準を示す必要があります。当社の支援現場では、10件中6件で承認担当と出典確認の手順が曖昧になり、公開直前の手戻りが起きていました。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない数字を条件なしで書かないことです。</li></ul>
      <h2>導入について</h2>
      <p>担当者、期間、費用を分けて確認します。現場では、承認者が決まらないままWordPress投稿直前に手戻りになる相談があります。</p>
      <h2>注意点について</h2>
      <p>FAQとして、参照元にない情報をどう扱うべきかがあります。未確認情報は断定せず、出典と自社経験を分けます。</p>
      <p>出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "editorial-headings", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("機械的な見出し");
    expect(result.score).toBeLessThan(100);
  });

  test("flags mechanical sequence headings that make the article feel templated", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では、12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
      <h2>まず準備すること</h2>
      <p>担当者と期限を決め、参照元と自社の観察を照合します。</p>
      <h2>次に確認すること</h2>
      <p>費用、期間、体制、公開後の修正リスクを比較します。</p>
      <h2>最後に公開すること</h2>
      <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "heading-storyline", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("連番・手順型の見出し");
    expect(result.score).toBeLessThan(100);
  });

  test("allows numbered-looking headings when they state a concrete editorial angle", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
      <h2>編集者が公開前に見るべき3つの確認軸</h2>
      <p>1つ目は参照元との照合、2つ目は現場例の出どころ、3つ目はWordPress投稿前の承認状態です。担当者と期限を決めると、公開後の修正リスクを下げられます。</p>
      <h2>承認担当が決まらない記事で起きる公開直前の手戻り</h2>
      <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "heading-storyline", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("flags overly long sentences that hurt readability", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。当社の支援現場では12件の相談で、承認担当が決まらないまま参照元の制度説明と自社の観察と競合記事の比較軸と問い合わせ時の失敗例と費用や期間の条件と公開後の修正責任を一文に詰め込んでしまうと、読者がどこを判断すべきか追えなくなり、社内確認でも論点が戻りやすくなります。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、条件と例外を短い文に分けることです。</li></ul>
      <h2>承認担当が決まらない記事で起きる公開直前の手戻り</h2>
      <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "sentence-length", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("130字を超える長い一文");
    expect(result.score).toBeLessThan(100);
  });

  test("allows concise sentences that split conditions and examples", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。当社の支援現場では、承認担当が決まらない相談が12件ありました。制度説明、現場観察、競合比較は別文で示します。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、条件と例外を短い文に分けることです。</li></ul>
      <h2>承認担当が決まらない記事で起きる公開直前の手戻り</h2>
      <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "sentence-length", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("ignores long source URLs when checking sentence readability", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。当社の支援現場では、承認担当が決まらない相談が12件ありました。</p>
      <p>出典: https://example.com/articles/very-long-reference-path-for-aio-editorial-review-source-note-with-query-string-and-tracking-code-2026-07-05?utm_source=article&utm_medium=reference&utm_campaign=aio-quality-check</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、条件と例外を短い文に分けることです。</li></ul>
      <h2>承認担当が決まらない記事で起きる公開直前の手戻り</h2>
      <p>FAQとして、未確認情報は断定せず、出典と条件を本文に残します。</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "sentence-length", passed: true }),
    );
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

  test("flags numeric performance claims that lack nearby source or conditions", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。記事を改善すると問い合わせが300%増え、運用費用は50万円削減できます。</p>
      <p>当社の支援現場では、承認担当と出典確認の手順が曖昧な相談があります。未確認情報は断定せず、参照元の情報と照合します。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "numeric-claim-support", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("数字や実績らしい表現");
    expect(result.improvements.join(" ")).toContain("300%");
  });

  test("allows numeric claims when an immediate follow-up sentence provides the source note", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。公開後30日で問い合わせが12件増えました。出典: 2026年6月時点の自社支援記録。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "numeric-claim-support", passed: true }),
    );
  });

  test("allows numeric claims when nearby text provides first-party context or caveats", () => {
    const result = evaluateArticleQuality(`
      <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
      <p>結論として、公開前には参照元と自社経験を分けて確認します。当社の支援現場では12件の相談で承認担当と出典確認の手順が曖昧でした。</p>
      <p>費用は条件により50万円前後が目安で、参照資料の時点と自社の観察を分けて書く必要があります。</p>
      <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
      <h2>公開前に確認すべき編集判断</h2>
      <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
    `);

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "numeric-claim-support", passed: true }),
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("flags article bodies that ignore the generated target reader", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、参照情報をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元と自社経験を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用、参照元、未確認情報の扱いを比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、数字の近くに条件を添えることです。</li></ul>
        <h2>公開前に確認すべき編集判断</h2>
        <p>FAQとして、どこまでを自社経験として書けるかを確認します。出典: https://example.com/reference</p>
      `,
      {
        targetReaderText:
          "BtoBマーケティング担当者とコンテンツ運用チーム、WordPress公開を担当する編集者",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "target-reader-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("想定読者");
    expect(result.improvements.join(" ")).toContain("BtoBマーケティング");
  });

  test("passes when target reader and search intent are reflected in editorial examples", () => {
    const result = evaluateArticleQuality(
      `
        <h2>AIO記事とは、BtoBマーケティング担当者がAI検索で引用されやすい根拠を整理する記事を指します</h2>
        <p>結論として、コンテンツ運用チームはWordPress公開前に、参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認、AI検索で引用される定義文を比較します。</td></tr></table>
        <ul><li>失敗例として、編集者が出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、AI検索に強い記事テーマを決める前に検索意図と比較軸を確認することです。</li></ul>
        <h2>WordPress公開担当者が確認すべき検索意図と比較軸</h2>
        <p>FAQとして、どの根拠を本文に残し、どの情報を未確認として扱うかを確認します。出典: https://example.com/reference</p>
      `,
      {
        targetReaderText:
          "BtoBマーケティング担当者とコンテンツ運用チーム、WordPress公開を担当する編集者",
        searchIntentText: "AI検索に強い記事テーマを決め、比較軸と次の公開作業を知りたい",
      },
    );

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "target-reader-reflection", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "search-intent-reflection", passed: true }),
    );
  });
});
