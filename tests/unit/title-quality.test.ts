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
});
