import { randomUUID } from "crypto";
import {
  DocumentChunk,
  DocumentSource,
  TestCase,
  TestCaseRun,
  TestRun,
  TestStep,
  UiElement,
  UiPage,
} from "../types";

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class InMemoryStore {
  private documentSources = new Map<string, DocumentSource>();
  private documentChunks = new Map<string, DocumentChunk>();
  private testCases = new Map<string, TestCase>();
  private testSteps = new Map<string, TestStep[]>();
  private uiPages = new Map<string, UiPage>();
  private uiElements = new Map<string, UiElement>();
  private testRuns = new Map<string, TestRun>();
  private testCaseRuns = new Map<string, TestCaseRun[]>();

  createDocumentSource(input: Omit<DocumentSource, "id" | "createdAt" | "updatedAt">): DocumentSource {
    const now = new Date().toISOString();
    const source: DocumentSource = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.documentSources.set(source.id, source);
    return source;
  }

  addDocumentChunks(sourceId: string, chunks: Omit<DocumentChunk, "id" | "sourceId" | "createdAt">[]): DocumentChunk[] {
    const now = new Date().toISOString();
    const created: DocumentChunk[] = chunks.map((chunk) => {
      const record: DocumentChunk = {
        id: randomUUID(),
        sourceId,
        createdAt: now,
        ...chunk,
      };
      this.documentChunks.set(record.id, record);
      return record;
    });
    return created;
  }

  listChunksBySource(sourceId: string): DocumentChunk[] {
    return Array.from(this.documentChunks.values()).filter((chunk) => chunk.sourceId === sourceId);
  }

  findSimilarChunks(queryEmbedding: number[], limit = 5): DocumentChunk[] {
    const scored = Array.from(this.documentChunks.values()).map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.chunk);
  }

  upsertTestCase(testCase: Omit<TestCase, "id" | "createdAt" | "updatedAt">): TestCase {
    const existing = Array.from(this.testCases.values()).find(
      (tc) => tc.featureKey === testCase.featureKey && tc.title === testCase.title
    );
    const now = new Date().toISOString();

    if (existing) {
      const updated: TestCase = { ...existing, ...testCase, updatedAt: now };
      this.testCases.set(existing.id, updated);
      return updated;
    }

    const created: TestCase = { id: randomUUID(), createdAt: now, updatedAt: now, ...testCase };
    this.testCases.set(created.id, created);
    return created;
  }

  replaceTestSteps(
    testCaseId: string,
    steps: Array<Omit<TestStep, "id" | "testCaseId" | "index">>
  ): TestStep[] {
    const created = steps.map((step, index) => ({
      id: randomUUID(),
      testCaseId,
      index,
      ...step,
    }));
    this.testSteps.set(testCaseId, created);
    return created;
  }

  updateTestStep(testCaseId: string, stepId: string, updates: Partial<TestStep>): TestStep {
    const steps = this.testSteps.get(testCaseId) ?? [];
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx === -1) {
      throw new Error(`Cannot update step; not found: ${stepId}`);
    }
    const updated = { ...steps[idx], ...updates };
    steps[idx] = updated;
    this.testSteps.set(testCaseId, steps);
    return updated;
  }

  listTestCases(): TestCase[] {
    return Array.from(this.testCases.values());
  }

  getTestSteps(testCaseId: string): TestStep[] {
    return this.testSteps.get(testCaseId) ?? [];
  }

  upsertUiPage(page: Omit<UiPage, "id" | "createdAt" | "updatedAt">): UiPage {
    const existing = Array.from(this.uiPages.values()).find((p) => p.url === page.url);
    const now = new Date().toISOString();
    if (existing) {
      const updated: UiPage = { ...existing, ...page, updatedAt: now };
      this.uiPages.set(existing.id, updated);
      return updated;
    }
    const created: UiPage = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...page,
    };
    this.uiPages.set(created.id, created);
    return created;
  }

  addUiElements(pageId: string, elements: Omit<UiElement, "id" | "pageId">[]): UiElement[] {
    const created = elements.map((element) => {
      const record: UiElement = {
        id: randomUUID(),
        pageId,
        ...element,
      };
      this.uiElements.set(record.id, record);
      return record;
    });
    return created;
  }

  listUiElementsByPage(pageId: string): UiElement[] {
    return Array.from(this.uiElements.values()).filter((el) => el.pageId === pageId);
  }

  createTestRun(input: Omit<TestRun, "id" | "createdAt" | "status">): TestRun {
    const now = new Date().toISOString();
    const run: TestRun = {
      id: randomUUID(),
      createdAt: now,
      status: "queued",
      ...input,
    };
    this.testRuns.set(run.id, run);
    return run;
  }

  updateTestRun(runId: string, updates: Partial<TestRun>): TestRun {
    const existing = this.testRuns.get(runId);
    if (!existing) {
      throw new Error(`TestRun not found: ${runId}`);
    }
    const updated: TestRun = { ...existing, ...updates };
    this.testRuns.set(runId, updated);
    return updated;
  }

  setTestCaseRuns(runId: string, entries: Omit<TestCaseRun, "id" | "testRunId">[]): TestCaseRun[] {
    const created = entries.map((entry) => ({
      id: randomUUID(),
      testRunId: runId,
      ...entry,
    }));
    this.testCaseRuns.set(runId, created);
    return created;
  }

  listTestCaseRuns(runId: string): TestCaseRun[] {
    return this.testCaseRuns.get(runId) ?? [];
  }
}
