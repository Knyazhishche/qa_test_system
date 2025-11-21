import { InMemoryStore } from "./inMemoryStore";
import { StoreAdapter } from "./storeAdapter";
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

export class InMemoryAdapter implements StoreAdapter {
  constructor(private readonly store = new InMemoryStore()) {}

  async createDocumentSource(input: Omit<DocumentSource, "id" | "createdAt" | "updatedAt">): Promise<DocumentSource> {
    return this.store.createDocumentSource(input);
  }

  async addDocumentChunks(
    sourceId: string,
    chunks: Omit<DocumentChunk, "id" | "sourceId" | "createdAt">[]
  ): Promise<DocumentChunk[]> {
    return this.store.addDocumentChunks(sourceId, chunks);
  }

  async listChunksBySource(sourceId: string): Promise<DocumentChunk[]> {
    return this.store.listChunksBySource(sourceId);
  }

  async findSimilarChunks(queryEmbedding: number[], limit = 5): Promise<DocumentChunk[]> {
    return this.store.findSimilarChunks(queryEmbedding, limit);
  }

  async upsertTestCase(testCase: Omit<TestCase, "id" | "createdAt" | "updatedAt">): Promise<TestCase> {
    return this.store.upsertTestCase(testCase);
  }

  async replaceTestSteps(
    testCaseId: string,
    steps: Array<Omit<TestStep, "id" | "testCaseId" | "index">>
  ): Promise<TestStep[]> {
    return this.store.replaceTestSteps(testCaseId, steps);
  }

  async updateTestStep(testCaseId: string, stepId: string, updates: Partial<TestStep>): Promise<TestStep> {
    return this.store.updateTestStep(testCaseId, stepId, updates);
  }

  async listTestCases(): Promise<TestCase[]> {
    return this.store.listTestCases();
  }

  async getTestSteps(testCaseId: string): Promise<TestStep[]> {
    return this.store.getTestSteps(testCaseId);
  }

  async upsertUiPage(page: Omit<UiPage, "id" | "createdAt" | "updatedAt">): Promise<UiPage> {
    return this.store.upsertUiPage(page);
  }

  async addUiElements(pageId: string, elements: Omit<UiElement, "id" | "pageId">[]): Promise<UiElement[]> {
    return this.store.addUiElements(pageId, elements);
  }

  async listUiElementsByPage(pageId: string): Promise<UiElement[]> {
    return this.store.listUiElementsByPage(pageId);
  }

  async createTestRun(input: Omit<TestRun, "id" | "createdAt" | "status">): Promise<TestRun> {
    return this.store.createTestRun(input);
  }

  async updateTestRun(runId: string, updates: Partial<TestRun>): Promise<TestRun> {
    return this.store.updateTestRun(runId, updates);
  }

  async setTestCaseRuns(runId: string, entries: Omit<TestCaseRun, "id" | "testRunId">[]): Promise<TestCaseRun[]> {
    return this.store.setTestCaseRuns(runId, entries);
  }

  async listTestCaseRuns(runId: string): Promise<TestCaseRun[]> {
    return this.store.listTestCaseRuns(runId);
  }
}
