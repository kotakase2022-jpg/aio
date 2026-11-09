import { describe, expect, test } from "vitest";
import { evaluatePublicationReadiness } from "@/lib/publication-quality";

describe("evaluatePublicationReadiness", () => {
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
});
