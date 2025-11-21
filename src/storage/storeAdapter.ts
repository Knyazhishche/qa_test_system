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

export interface StoreAdapter {
  createDocumentSource(input: Omit<DocumentSource, "id" | "createdAt" | "updatedAt">): Promise<DocumentSource>;
  addDocumentChunks(sourceId: string, chunks: Omit<DocumentChunk, "id" | "sourceId" | "createdAt">[]): Promise<DocumentChunk[]>;
  listChunksBySource(sourceId: string): Promise<DocumentChunk[]>;
  findSimilarChunks(queryEmbedding: number[], limit?: number): Promise<DocumentChunk[]>;

  upsertTestCase(testCase: Omit<TestCase, "id" | "createdAt" | "updatedAt">): Promise<TestCase>;
  replaceTestSteps(testCaseId: string, steps: Array<Omit<TestStep, "id" | "testCaseId" | "index">>): Promise<TestStep[]>;
  updateTestStep(testCaseId: string, stepId: string, updates: Partial<TestStep>): Promise<TestStep>;
  listTestCases(): Promise<TestCase[]>;
  getTestSteps(testCaseId: string): Promise<TestStep[]>;

  upsertUiPage(page: Omit<UiPage, "id" | "createdAt" | "updatedAt">): Promise<UiPage>;
  addUiElements(pageId: string, elements: Omit<UiElement, "id" | "pageId">[]): Promise<UiElement[]>;
  listUiElementsByPage(pageId: string): Promise<UiElement[]>;

  createTestRun(input: Omit<TestRun, "id" | "createdAt" | "status">): Promise<TestRun>;
  updateTestRun(runId: string, updates: Partial<TestRun>): Promise<TestRun>;
  setTestCaseRuns(runId: string, entries: Omit<TestCaseRun, "id" | "testRunId">[]): Promise<TestCaseRun[]>;
  listTestCaseRuns(runId: string): Promise<TestCaseRun[]>;
}
