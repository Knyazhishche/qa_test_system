import { Pool, PoolClient } from "pg";
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
import { config, requirePostgresUrl } from "../config";
import { StoreAdapter } from "./storeAdapter";

const DEFAULT_DIMENSIONS = config.embeddingDimensions || 64;

export class PgStore implements StoreAdapter {
  private pool: Pool;

  constructor(connectionString = config.postgresUrl) {
    requirePostgresUrl();
    this.pool = new Pool({ connectionString });
  }

  async ensureSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_sources (
          id UUID PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          url TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY,
          source_id UUID REFERENCES document_sources(id),
          title TEXT,
          path TEXT,
          content TEXT NOT NULL,
          embedding vector(${DEFAULT_DIMENSIONS}),
          created_at TIMESTAMPTZ NOT NULL
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_source_path_title
          ON document_chunks(source_id, path, title)
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_cases (
          id UUID PRIMARY KEY,
          feature_key TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          source_chunk_id UUID REFERENCES document_chunks(id),
          priority TEXT,
          status TEXT,
          tags TEXT[],
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          UNIQUE(feature_key, title)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_steps (
          id UUID PRIMARY KEY,
          test_case_id UUID REFERENCES test_cases(id),
          step_index INT NOT NULL,
          raw_text TEXT NOT NULL,
          page_path TEXT,
          action TEXT,
          ui_element_id TEXT,
          value TEXT
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ui_pages (
          id UUID PRIMARY KEY,
          url TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ui_elements (
          id UUID PRIMARY KEY,
          page_id UUID REFERENCES ui_pages(id),
          type TEXT NOT NULL,
          role TEXT,
          text TEXT,
          placeholder TEXT,
          label TEXT,
          name_attr TEXT,
          id_attr TEXT,
          data_test_id TEXT,
          locators JSONB
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_runs (
          id UUID PRIMARY KEY,
          suite_name TEXT NOT NULL,
          git_commit TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ,
          status TEXT NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_case_runs (
          id UUID PRIMARY KEY,
          test_run_id UUID REFERENCES test_runs(id),
          test_case_id UUID REFERENCES test_cases(id),
          status TEXT NOT NULL,
          error_message TEXT,
          trace_path TEXT,
          screenshot_path TEXT
        )
      `);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private vectorParam(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }

  async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async createDocumentSource(input: Omit<DocumentSource, "id" | "createdAt" | "updatedAt">): Promise<DocumentSource> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const res = await this.pool.query<DocumentSource>(
      `INSERT INTO document_sources (id, type, name, url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, name, url, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, input.type, input.name, input.url ?? null, now, now]
    );
    return res.rows[0];
  }

  async addDocumentChunks(sourceId: string, chunks: Omit<DocumentChunk, "id" | "sourceId" | "createdAt">[]): Promise<DocumentChunk[]> {
    const now = new Date().toISOString();
    const inserted: DocumentChunk[] = [];
    await this.withTx(async (client) => {
      for (const chunk of chunks) {
        const id = randomUUID();
        const res = await client.query<DocumentChunk>(
          `INSERT INTO document_chunks (id, source_id, title, path, content, embedding, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
           RETURNING id, source_id as "sourceId", title, path, content, embedding, created_at as "createdAt"`,
          [id, sourceId, chunk.title, chunk.path ?? null, chunk.content, this.vectorParam(chunk.embedding), now]
        );
        inserted.push(res.rows[0]);
      }
    });
    return inserted;
  }

  async listChunksBySource(sourceId: string): Promise<DocumentChunk[]> {
    const res = await this.pool.query<DocumentChunk>(
      `SELECT id, source_id as "sourceId", title, path, content, embedding, created_at as "createdAt"
       FROM document_chunks
       WHERE source_id = $1`,
      [sourceId]
    );
    return res.rows;
  }

  async findSimilarChunks(queryEmbedding: number[], limit = 5): Promise<DocumentChunk[]> {
    const res = await this.pool.query<DocumentChunk>(
      `SELECT id, source_id as "sourceId", title, path, content, embedding, created_at as "createdAt"
       FROM document_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [this.vectorParam(queryEmbedding), limit]
    );
    return res.rows;
  }

  async upsertTestCase(testCase: Omit<TestCase, "id" | "createdAt" | "updatedAt">): Promise<TestCase> {
    const now = new Date().toISOString();
    const res = await this.pool.query<TestCase>(
      `INSERT INTO test_cases
         (id, feature_key, title, description, source_chunk_id, priority, status, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (feature_key, title) DO UPDATE SET
         description = EXCLUDED.description,
         source_chunk_id = EXCLUDED.source_chunk_id,
         priority = EXCLUDED.priority,
         status = EXCLUDED.status,
         tags = EXCLUDED.tags,
         updated_at = EXCLUDED.updated_at
       RETURNING id, feature_key as "featureKey", title, description, source_chunk_id as "sourceChunkId",
                 priority, status, tags, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        randomUUID(),
        testCase.featureKey,
        testCase.title,
        testCase.description ?? null,
        testCase.sourceChunkId,
        testCase.priority,
        testCase.status,
        testCase.tags,
        now,
        now,
      ]
    );
    return res.rows[0];
  }

  async replaceTestSteps(
    testCaseId: string,
    steps: Array<Omit<TestStep, "id" | "testCaseId" | "index">>
  ): Promise<TestStep[]> {
    const created: TestStep[] = [];
    await this.withTx(async (client) => {
      await client.query(`DELETE FROM test_steps WHERE test_case_id = $1`, [testCaseId]);
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const id = randomUUID();
        const res = await client.query<TestStep>(
          `INSERT INTO test_steps (id, test_case_id, step_index, raw_text, page_path, action, ui_element_id, value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, test_case_id as "testCaseId", step_index as "index", raw_text as "rawText",
                     page_path as "pagePath", action, ui_element_id as "uiElementId", value`,
          [id, testCaseId, i, step.rawText, step.pagePath ?? null, step.action ?? null, step.uiElementId ?? null, step.value ?? null]
        );
        created.push(res.rows[0]);
      }
    });
    return created;
  }

  async updateTestStep(testCaseId: string, stepId: string, updates: Partial<TestStep>): Promise<TestStep> {
    const res = await this.pool.query<TestStep>(
      `UPDATE test_steps
       SET action = COALESCE($3, action),
           ui_element_id = COALESCE($4, ui_element_id),
           value = COALESCE($5, value),
           page_path = COALESCE($6, page_path)
       WHERE id = $1 AND test_case_id = $2
       RETURNING id, test_case_id as "testCaseId", step_index as "index", raw_text as "rawText",
                 page_path as "pagePath", action, ui_element_id as "uiElementId", value`,
      [stepId, testCaseId, updates.action ?? null, updates.uiElementId ?? null, updates.value ?? null, updates.pagePath ?? null]
    );
    if (res.rows.length === 0) {
      throw new Error(`Cannot update step; not found: ${stepId}`);
    }
    return res.rows[0];
  }

  async listTestCases(): Promise<TestCase[]> {
    const res = await this.pool.query<TestCase>(
      `SELECT id, feature_key as "featureKey", title, description, source_chunk_id as "sourceChunkId",
              priority, status, tags, created_at as "createdAt", updated_at as "updatedAt"
       FROM test_cases`
    );
    return res.rows;
  }

  async getTestSteps(testCaseId: string): Promise<TestStep[]> {
    const res = await this.pool.query<TestStep>(
      `SELECT id, test_case_id as "testCaseId", step_index as "index", raw_text as "rawText",
              page_path as "pagePath", action, ui_element_id as "uiElementId", value
       FROM test_steps
       WHERE test_case_id = $1
       ORDER BY step_index ASC`,
      [testCaseId]
    );
    return res.rows;
  }

  async upsertUiPage(page: Omit<UiPage, "id" | "createdAt" | "updatedAt">): Promise<UiPage> {
    const now = new Date().toISOString();
    const res = await this.pool.query<UiPage>(
      `INSERT INTO ui_pages (id, url, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (url) DO UPDATE SET updated_at = EXCLUDED.updated_at
       RETURNING id, url, created_at as "createdAt", updated_at as "updatedAt"`,
      [randomUUID(), page.url, now, now]
    );
    return res.rows[0];
  }

  async addUiElements(pageId: string, elements: Omit<UiElement, "id" | "pageId">[]): Promise<UiElement[]> {
    const created: UiElement[] = [];
    await this.withTx(async (client) => {
      for (const element of elements) {
        const id = randomUUID();
        const res = await client.query<UiElement>(
          `INSERT INTO ui_elements (id, page_id, type, role, text, placeholder, label, name_attr, id_attr, data_test_id, locators)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, page_id as "pageId", type, role, text, placeholder, label, name_attr as "nameAttr",
                     id_attr as "idAttr", data_test_id as "dataTestId", locators`,
          [
            id,
            pageId,
            element.type,
            element.role ?? null,
            element.text ?? null,
            element.placeholder ?? null,
            element.label ?? null,
            element.nameAttr ?? null,
            element.idAttr ?? null,
            element.dataTestId ?? null,
            element.locators ?? {},
          ]
        );
        created.push(res.rows[0]);
      }
    });
    return created;
  }

  async listUiElementsByPage(pageId: string): Promise<UiElement[]> {
    const res = await this.pool.query<UiElement>(
      `SELECT id, page_id as "pageId", type, role, text, placeholder, label, name_attr as "nameAttr",
              id_attr as "idAttr", data_test_id as "dataTestId", locators
       FROM ui_elements
       WHERE page_id = $1`,
      [pageId]
    );
    return res.rows;
  }

  async createTestRun(input: Omit<TestRun, "id" | "createdAt"> & Partial<Pick<TestRun, "status">>): Promise<TestRun> {
    const now = new Date().toISOString();
    const status = input.status ?? "queued";
    const res = await this.pool.query<TestRun>(
      `INSERT INTO test_runs (id, suite_name, git_commit, created_at, started_at, finished_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, suite_name as "suiteName", git_commit as "gitCommit", created_at as "createdAt",
                 started_at as "startedAt", finished_at as "finishedAt", status`,
      [randomUUID(), input.suiteName, input.gitCommit ?? null, now, input.startedAt ?? null, input.finishedAt ?? null, status]
    );
    return res.rows[0];
  }

  async updateTestRun(runId: string, updates: Partial<TestRun>): Promise<TestRun> {
    const res = await this.pool.query<TestRun>(
      `UPDATE test_runs SET
         suite_name = COALESCE($2, suite_name),
         git_commit = COALESCE($3, git_commit),
         started_at = COALESCE($4, started_at),
         finished_at = COALESCE($5, finished_at),
         status = COALESCE($6, status)
       WHERE id = $1
       RETURNING id, suite_name as "suiteName", git_commit as "gitCommit", created_at as "createdAt",
                 started_at as "startedAt", finished_at as "finishedAt", status`,
      [runId, updates.suiteName ?? null, updates.gitCommit ?? null, updates.startedAt ?? null, updates.finishedAt ?? null, updates.status ?? null]
    );
    if (res.rows.length === 0) {
      throw new Error(`TestRun not found: ${runId}`);
    }
    return res.rows[0];
  }

  async setTestCaseRuns(runId: string, entries: Omit<TestCaseRun, "id" | "testRunId">[]): Promise<TestCaseRun[]> {
    const created: TestCaseRun[] = [];
    await this.withTx(async (client) => {
      await client.query(`DELETE FROM test_case_runs WHERE test_run_id = $1`, [runId]);
      for (const entry of entries) {
        const res = await client.query<TestCaseRun>(
          `INSERT INTO test_case_runs (id, test_run_id, test_case_id, status, error_message, trace_path, screenshot_path)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, test_run_id as "testRunId", test_case_id as "testCaseId", status,
                     error_message as "errorMessage", trace_path as "tracePath", screenshot_path as "screenshotPath"`,
          [
            randomUUID(),
            runId,
            entry.testCaseId,
            entry.status,
            entry.errorMessage ?? null,
            entry.tracePath ?? null,
            entry.screenshotPath ?? null,
          ]
        );
        created.push(res.rows[0]);
      }
    });
    return created;
  }

  async listTestCaseRuns(runId: string): Promise<TestCaseRun[]> {
    const res = await this.pool.query<TestCaseRun>(
      `SELECT id, test_run_id as "testRunId", test_case_id as "testCaseId", status,
              error_message as "errorMessage", trace_path as "tracePath", screenshot_path as "screenshotPath"
       FROM test_case_runs
       WHERE test_run_id = $1`,
      [runId]
    );
    return res.rows;
  }
}
