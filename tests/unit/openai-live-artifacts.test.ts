import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";
import {
  buildOpenAILiveArtifact,
  sanitizeLiveArtifactName,
  shouldWriteOpenAILiveArtifacts,
  writeOpenAILiveArtifact,
} from "../live/openai-live-artifacts";

describe("OpenAI live artifact helpers", () => {
  test("writes artifacts only when explicitly enabled", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-openai-artifact-"));

    try {
      const disabled = await writeOpenAILiveArtifact(sampleArtifactInput, {
        AIO_LIVE_OPENAI_ARTIFACT_DIR: tempDir,
      });
      expect(disabled).toBeNull();

      const enabled = await writeOpenAILiveArtifact(sampleArtifactInput, {
        AIO_LIVE_OPENAI_WRITE_ARTIFACTS: "1",
        AIO_LIVE_OPENAI_ARTIFACT_DIR: tempDir,
      });

      expect(enabled).not.toBeNull();
      const [json, html] = await Promise.all([
        readFile(enabled!.jsonPath, "utf8"),
        readFile(enabled!.htmlPath, "utf8"),
      ]);
      expect(json).toContain('"sampleName": "AIO / live review sample"');
      expect(json).toContain('"selectedTitle": "AIO Content Operations Guide"');
      expect(html).toContain("AIO Content Operations Guide");
      expect(html).toContain("OpenAI live artifact");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps artifact payload reviewable without exposing environment values", () => {
    expect(shouldWriteOpenAILiveArtifacts({ AIO_LIVE_OPENAI_WRITE_ARTIFACTS: "1" })).toBe(true);
    expect(shouldWriteOpenAILiveArtifacts({ AIO_LIVE_OPENAI_WRITE_ARTIFACTS: "0" })).toBe(false);
    expect(sanitizeLiveArtifactName("AIO / live review sample")).toBe("aio-live-review-sample");

    const artifact = buildOpenAILiveArtifact(sampleArtifactInput);

    expect(artifact.input.theme).toBe(sampleFormPayload.theme);
    expect(artifact.input.referenceUrls).toEqual(["https://example.com/reference"]);
    expect(artifact.output.bodyHtml).toContain("<h2>What AIO means</h2>");
    expect(JSON.stringify(artifact)).not.toContain("OPENAI_API_KEY");
  });
});

const sampleArtifactInput = {
  sampleName: "AIO / live review sample",
  textModel: "gpt-test",
  minScore: 75,
  generatedAt: "2026-07-08T00:00:00.000Z",
  form: sampleFormPayload,
  fetchedReferences: [
    {
      url: "https://example.com/reference",
      title: "Reference page",
      text: "AIO reference text",
      ok: true,
      sourceType: "url" as const,
    },
  ],
  fetchedCompetitors: [],
  competitorResearch: null,
  result: sampleArticleResult,
};
