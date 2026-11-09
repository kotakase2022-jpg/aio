import { describe, expect, test } from "vitest";
import { evaluatePublicationReadiness } from "@/lib/publication-quality";

describe("evaluatePublicationReadiness", () => {
  test.each([
    ["9.5%", "1.5%"],
    ["９．５％", "１．５％"],
    ["12.5%", "12.6%"],
  ])("does not accept %s as supported by %s", (claim, evidence) => {
    const result = evaluatePublicationReadiness(`<p>Rate: ${claim}.</p>`, {
      evidenceTexts: [`Rate: ${evidence}.`],
    });

    expect(result.publishReady).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      id: "unsupported-numeric-claim",
      detail: expect.stringContaining(claim),
    }));
  });

  test.each(["1.5%", "１．５％"])("accepts a supported complete decimal: %s", (claim) => {
    const result = evaluatePublicationReadiness(`<p>Rate: ${claim}. Review annually.</p>`, {
      evidenceTexts: ["Rate: 1.5%. Review annually."],
    });

    expect(result.publishReady).toBe(true);
  });

  test("retains source attribution and conditions around decimal claims", () => {
    const result = evaluatePublicationReadiness("<p>手数料は1.5%です。</p>", {
      evidenceTexts: ["当社の支援事例では、必要書類が揃った場合に手数料は1.5%でした。"],
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ id: "condition-generalization" }));
  });

  test.each([
    "全員に10万円が支給されます。",
    "会員も含め全員に10万円が支給されます。",
    "非会員のみ10万円が支給されます。",
  ])("requires the exclusive source audience despite a shared predicate: %s", (claim) => {
    const result = evaluatePublicationReadiness(`<p>${claim}</p>`, {
      evidenceTexts: ["会員のみ10万円が支給されます。"],
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ id: "condition-generalization" }));
  });

  test.each([
    "会員のみ10万円が支給されます。",
    "会員に限り10万円が支給されます。",
  ])("accepts the same explicit exclusive audience: %s", (claim) => {
    const result = evaluatePublicationReadiness(`<p>${claim}</p>`, {
      evidenceTexts: ["会員のみ10万円が支給されます。"],
    });

    expect(result.publishReady).toBe(true);
  });

  test.each([
    ["Can I use C++?", "Can I use C#?"],
    ["Is 1.5% supported?", "Is 15% supported?"],
  ])("does not label distinct questions %s and %s as duplicates", (first, second) => {
    const result = evaluatePublicationReadiness(`<h3>${first}</h3><p>First.</p><h3>${second}</h3><p>Second.</p>`);

    expect(result.issues).not.toContainEqual(expect.objectContaining({ id: "duplicate-faq" }));
  });

  test("blocks an unsupported number even when the draft adds 約 or 目安", () => {
    const result = evaluatePublicationReadiness(
      "<h2>審査期間</h2><p>審査は約30日が目安です。</p>",
      { evidenceTexts: ["審査期間は案件ごとに異なり、事前確認が必要です。"] },
    );

    expect(result.publishReady).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "unsupported-numeric-claim", severity: "blocker" }),
      ]),
    );
  });

  test("accepts a number that is present in the supplied evidence with its unit", () => {
    const result = evaluatePublicationReadiness(
      "<h2>確認期間</h2><p>当社の支援記録では、確認に7日以内を要したケースがあります。</p>",
      { evidenceTexts: ["当社の支援記録では、確認に7日以内を要したケースがありました。"] },
    );

    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "unsupported-numeric-claim" })]),
    );
  });

  test("blocks a company-specific numeric observation generalized into a universal rule", () => {
    const result = evaluatePublicationReadiness(
      "<h2>必要期間</h2><p>資金調達には7日以内が必要です。</p>",
      {
        evidenceTexts: [
          "当社が支援した特定のケースでは、必要書類が揃った場合に7日以内で確認できました。",
        ],
      },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "condition-generalization", severity: "blocker" }),
      ]),
    );
  });

  test("does not treat a generic condition disclaimer as preservation of the source condition", () => {
    const result = evaluatePublicationReadiness(
      "<h2>確認期間</h2><p>当社のケースでは、条件により7日以内が目安です。</p>",
      {
        evidenceTexts: [
          "当社が支援した特定のケースでは、必要書類が揃った場合に7日以内で確認できました。",
        ],
      },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "condition-generalization" })]),
    );
  });

  test("accepts a scoped number when attribution and the actual condition remain", () => {
    const result = evaluatePublicationReadiness(
      "<h2>確認期間</h2><p>当社が支援したケースでは、必要書類が揃った場合に7日以内で確認できました。</p>",
      {
        evidenceTexts: [
          "当社が支援した特定のケースでは、必要書類が揃った場合に7日以内で確認できました。",
        ],
      },
    );

    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "condition-generalization" })]),
    );
  });

  test("detects mojibake, internal process notes, duplicate FAQ, and broken source links", () => {
    const result = evaluatePublicationReadiness(`
      <p>譁�蟄励�文章です。競合URLから本文を取得しました。</p>
      <h2>FAQ</h2>
      <h3>費用はかかりますか？</h3><p>回答A</p>
      <h3>費用は、かかりますか?</h3><p>回答B</p>
      <section class="aio-source-block"><h2>参照元</h2><ul><li><a href="javascript:alert(1)">壊れたリンク</a></li></ul></section>
    `);

    expect(result.publishReady).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "mojibake",
        "internal-process-note",
        "duplicate-faq",
        "broken-link",
      ]),
    );
  });

  test("does not accept a plain URL string as a publishable source link", () => {
    const result = evaluatePublicationReadiness(
      "<p>出典: https://example.com/evidence</p>",
      { requiredSourceUrls: ["https://example.com/evidence"] },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "missing-source-link" })]),
    );
  });

  test("does not treat figures in the source list as article claims", () => {
    const result = evaluatePublicationReadiness(`
      <p>条件と例外は本文で確認してください。</p>
      <section class="aio-source-block"><h2>参照元</h2><ul><li><a href="https://example.com/2026/report">2026年版・100社調査</a></li></ul></section>
    `);

    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "unsupported-numeric-claim" })]),
    );
  });

  test("accepts root-relative article links while rejecting protocol-relative links", () => {
    const relative = evaluatePublicationReadiness(
      '<p><a href="/contact">お問い合わせ</a></p>',
    );
    const protocolRelative = evaluatePublicationReadiness(
      '<p><a href="//untrusted.example.com/path">外部リンク</a></p>',
    );

    expect(relative.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "broken-link" })]),
    );
    expect(protocolRelative.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "broken-link" })]),
    );
  });

  test("does not evaluate author profile numbers as article claims", () => {
    const result = evaluatePublicationReadiness(`
      <p>本文には数値の主張がありません。</p>
      <section class="aio-author-block">
        <h2>この記事の執筆者</h2>
        <p>編集歴20年、100社以上を支援。</p>
      </section>
    `);

    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "unsupported-numeric-claim" })]),
    );
  });
});
