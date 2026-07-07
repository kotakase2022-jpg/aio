import { describe, expect, test } from "vitest";
import { evaluateTitleQuality } from "@/lib/title-quality";

describe("evaluateTitleQuality", () => {
  test("passes specific editorial titles that reflect input signals", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "一人親方の労災保険でLINE確認と帳票不在を防ぐ実務チェック",
      titleCandidates: [
        "一人親方の労災保険でLINE確認と帳票不在を防ぐ実務チェック",
        "加入条件と給付基礎日額を現場目線で確認する一人親方の労災保険",
        "帳票不在を避ける一人親方の労災保険加入前チェック",
      ],
      themeText: "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用",
      primaryInfo:
        "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く、帳票不在も多い。",
    });

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  test("flags generic titles and missing input signals", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "重要なポイント",
      titleCandidates: ["重要なポイント", "概要", "まとめ"],
      themeText: "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用",
      primaryInfo:
        "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く、帳票不在も多い。",
    });

    expect(result.score).toBeLessThan(80);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("タイトルが汎用的です");
    expect(result.improvements.join(" ")).toContain("入力テーマ/一次情報の固有語彙");
  });

  test("flags short topic plus generic SEO title suffixes", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AIO Complete Guide",
      titleCandidates: ["AIO Complete Guide", "AIO Ultimate Guide", "AIO Basics"],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-candidate-count", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("does not count English input terms inside longer title words", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "Platform workflow for approval teams",
      titleCandidates: [
        "Platform workflow for approval teams",
        "Platform operating timing for approval teams",
        "Approval teams and platform operations",
      ],
      themeText: "AI search editorial review",
      primaryInfo: "Our form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: false }),
    );
    expect(result.score).toBeLessThan(100);
  });

  test("counts English input terms in hyphenated title phrases", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AI-powered form workflow for field approvals",
      titleCandidates: [
        "AI-powered form workflow for field approvals",
        "Form-based approval review for field teams",
        "AI search workflow for approval teams",
      ],
      themeText: "AI search editorial review",
      primaryInfo: "Our form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: true }),
    );
  });

  test("counts English input terms in slash and colon separated title phrases", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AI/Search title review: form approval workflow",
      titleCandidates: [
        "AI/Search title review: form approval workflow",
        "Form: approval workflow for editorial teams",
        "Search/title quality for approval workflows",
      ],
      themeText: "AI search editorial review",
      primaryInfo: "Our form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: true }),
    );
  });

  test("does not count English input terms inside underscore joined title tokens", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "Platform_form workflow for approval teams",
      titleCandidates: [
        "Platform_form workflow for approval teams",
        "Approval_platform formality checklist",
        "Workflow_platform operations",
      ],
      themeText: "AI search editorial review",
      primaryInfo: "Our form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: false }),
    );
    expect(result.score).toBeLessThan(100);
  });

  test("flags short topic plus generic English BtoB title suffixes", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AIO Best Practices",
      titleCandidates: ["AIO Best Practices", "AIO Strategy", "AIO Checklist"],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-candidate-count", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("flags short Japanese topic plus generic SEO title suffixes", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AIO完全ガイド",
      titleCandidates: ["AIO完全ガイド", "AIO徹底解説", "AIO導入方法"],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-candidate-count", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-input-signal", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("flags short topic plus beginner-friendly explanatory title templates", () => {
    const result = evaluateTitleQuality({
      selectedTitle: "AIOとは？基本からわかりやすく解説",
      titleCandidates: [
        "AIOとは？基本からわかりやすく解説",
        "AIO初心者向け",
        "AIO入門",
      ],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "title-candidate-count", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });
});
