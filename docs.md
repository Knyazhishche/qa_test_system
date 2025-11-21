# AI-Powered QA Regression System

Goal: Build a system that automatically converts product documentation into executable UI test cases and runs them against a web application using Playwright. The system should cover most routine regression and smoke tests and be fully automatable via CI.

---

## 1. High-Level Overview

### 1.1. Functional Scope

- Ingest product documentation (Confluence/Markdown/OpenAPI/etc.).
- Split documentation into semantic chunks and store in a database.
- Use an LLM to generate structured test cases (JSON) from documentation.
- Store test cases in a relational DB and index them in a vector store.
- Build a UI map of the application DOM (per page) using Playwright.
- Use an LLM to map human-readable test steps to concrete UI locators.
- Execute test cases via Playwright (headless and headed).
- Collect results, logs, screenshots, and traces for further analysis.
- Expose a simple API / CLI for:
  - triggering documentation ingestion,
  - generating test cases,
  - running test suites,
  - retrieving reports.

### 1.2. Non-Goals

- UX/usability testing.
- Complex multi-environment orchestration (beyond basic config).
- Handling 2FA/smart cards/real payment gateways (these are mocked/stubbed).

---

## 2. Architecture

### 2.1. Components

1. **Documentation Ingestion Service**
   - Sources: Confluence/Notion/Markdown/OpenAPI/etc.
   - Responsibilities:
     - Fetch documentation.
     - Normalize and clean content.
     - Chunk into semantically coherent units.
     - Persist chunks in Postgres and index in vector store (pgvector).

2. **LLM Service**
   - Backed by a local/open-source LLM (via Ollama or similar).
   - Submodules:
     - `TestCaseGenerator`: doc chunk → structured test cases (JSON).
     - `UiActionMapper`: test step + UI map → concrete Playwright action.
     - `AssertionHelper` (optional): validate textual UI responses and error messages.

3. **Vector Store**
   - Postgres with `pgvector` extension or Qdrant.
   - Stores embeddings for:
     - documentation chunks,
     - test cases.

4. **Core Database**
   - Postgres (SQL).
   - Stores:
     - documentation metadata and chunks,
     - test cases and steps,
     - UI maps,
     - test runs, results, artifacts.

5. **UI Map Builder**
   - Uses Playwright to:
     - open target pages,
     - inspect DOM,
     - extract metadata for interactive elements (buttons, inputs, links, etc.),
     - store per-page UI maps.

6. **Test Runner**
   - Built on top of Playwright (TypeScript).
   - Reads test cases from DB.
   - Uses LLM mapping + UI maps to:
     - resolve test steps into Playwright actions,
     - execute them in the browser,
     - assert expected results.

7. **API / CLI Gateway**
   - Simple HTTP API + CLI wrapper for:
     - triggering ingestion,
     - generating test cases,
     - running test suites,
     - viewing test run status.

8. **Reporting**
   - Stores:
     - per-run summary,
     - per-test-case result,
     - per-step logs,
     - screenshots/traces.
   - Optional web dashboard (Next.js/React).

---

## 3. Technology Stack

- **Language:** TypeScript (Node.js)
- **Web Automation:** Playwright (TypeScript)
- **Database:** Postgres
- **Vector Store:** pgvector extension in Postgres (or Qdrant)
- **LLM Runtime:**
  - Local: Ollama / vLLM
  - Models: Llama 3.x, Mistral, Qwen 2.5 (7–8B for MVP)
- **API:** Express/Fastify/NestJS (implementation detail)
- **Infrastructure:** Docker-based local setup; optional Kubernetes later
- **Auth:** Basic token-based or internal-only for MVP

---

## 4. Data Model

> NOTE: Data model shown as TypeScript interfaces and conceptual SQL; real migrations will be defined via Prisma/Knex/etc.

### 4.1. Documentation

```ts
type DocSourceType = "confluence" | "markdown" | "openapi" | "other";

interface DocumentSource {
  id: string;
  type: DocSourceType;
  name: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentChunk {
  id: string;
  sourceId: string;        // FK -> DocumentSource.id
  title: string;
  path?: string;           // logical path (e.g. Confluence page path)
  content: string;         // plain text of the chunk
  embedding: number[];     // vector; stored in pgvector column
  createdAt: string;
}
```

SQL sketch:

```sql
CREATE TABLE document_sources (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES document_sources(id),
  title TEXT,
  path TEXT,
  content TEXT NOT NULL,
  embedding VECTOR, -- pgvector
  created_at TIMESTAMPTZ NOT NULL
);
```

### 4.2. Test Cases

```ts
type TestPriority = "low" | "medium" | "high";
type TestStatus = "draft" | "active" | "deprecated";

interface TestCase {
  id: string;                     // e.g. "TC-AUTH-LOGIN-001"
  featureKey: string;             // e.g. "auth/login"
  title: string;
  description?: string;
  sourceChunkId: string;          // FK -> DocumentChunk.id
  priority: TestPriority;
  status: TestStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

type TestStepAction =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "check"
  | "uncheck"
  | "assert_text"
  | "assert_url"
  | "wait_for_network_idle";

interface TestStep {
  id: string;
  testCaseId: string;             // FK -> TestCase.id
  index: number;                  // order
  rawText: string;                // original LLM step text
  pagePath?: string;              // e.g. "/login"
  action?: TestStepAction;        // filled after LLM mapping
  uiElementId?: string;           // FK -> UiElement.id
  value?: string;                 // input value/expected text/etc.
}
```

### 4.3. UI Map

```ts
type UiElementType = "button" | "input" | "link" | "checkbox" | "select" | "other";

interface UiPage {
  id: string;
  url: string;                    // canonical URL or route pattern
  createdAt: string;
  updatedAt: string;
}

interface UiElement {
  id: string;
  pageId: string;                 // FK -> UiPage.id
  type: UiElementType;
  role?: string;
  text?: string;
  placeholder?: string;
  label?: string;
  nameAttr?: string;
  idAttr?: string;
  dataTestId?: string;
  locators: {
    byRole?: string;
    byText?: string;
    css?: string;
    xpath?: string;
  };
}
```

### 4.4. Test Runs

```ts
type TestRunStatus = "queued" | "running" | "passed" | "failed" | "partial";

interface TestRun {
  id: string;
  suiteName: string;              // e.g. "smoke", "regression", "auth-only"
  gitCommit?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: TestRunStatus;
}

type TestCaseRunStatus = "not_run" | "passed" | "failed" | "skipped";

interface TestCaseRun {
  id: string;
  testRunId: string;              // FK -> TestRun.id
  testCaseId: string;             // FK -> TestCase.id
  status: TestCaseRunStatus;
  errorMessage?: string;
  tracePath?: string;
  screenshotPath?: string;
}
```

---

## 5. Key Flows

### 5.1. Documentation Ingestion Flow

1. **Trigger** (CLI or API):
   - `POST /ingestion/run` with:
     - `sourceType`, `sourceConfig` (URLs, auth tokens, etc.).

2. **Fetch & Normalize:**
   - Pull raw docs from source (e.g. Confluence REST API).
   - Convert to plain text (strip HTML, formatting).

3. **Chunking:**
   - Split text into chunks by:
     - headings,
     - sections,
     - maximum token length (e.g. 512–1024 tokens).

4. **Embedding & Storage:**
   - For each chunk:
     - generate embedding via an embedding model,
     - insert into `document_chunks` with vector column populated.

5. **Output:**
   - Returns run id + number of chunks stored.

### 5.2. Test Case Generation Flow

1. **Trigger** (CLI or API):
   - `POST /testcases/generate` with:
     - `featureKey`,
     - optional filters (e.g. documentation query).

2. **Retrieve Relevant Chunks:**
   - Use vector search on `document_chunks` by:
     - `featureKey` text,
     - or free-text query.

3. **LLM Prompting:**
   - For each relevant chunk:
     - send content to LLM with strict instructions:
       - return JSON array of test cases with fields:
         - `title`, `preconditions`, `steps`, `expected_result`, `priority`, `tags`, `featureKey`.

4. **Persist Test Cases:**
   - Parse JSON result.
   - Create or update `TestCase` and `TestStep` rows.
   - De-duplicate by `featureKey + title` or by hash of content.

5. **Output:**
   - Returns list of created/updated `TestCase.id` values.

### 5.3. UI Map Generation Flow

1. **Trigger:**
   - `POST /uimap/build` with:
     - `routes: ["/login", "/dashboard", ...]`.

2. **Playwright:**
   - For each route:
     - launch browser (in test env),
     - navigate to route,
     - wait for network idle.

3. **DOM Scan:**
   - In page context:
     - select interactive elements:
       - `button`, `a[href]`, `input`, `select`, `textarea`, etc.
     - for each element:
       - record:
         - node name,
         - role,
         - `innerText`,
         - `placeholder`,
         - `aria-label`,
         - `name`, `id`, `data-testid`,
         - candidate CSS/XPath selectors.

4. **Persist:**
   - Create or update `UiPage` and `UiElement` entries.

5. **Output:**
   - Returns count of pages and elements stored.

### 5.4. Step-to-UI Mapping Flow

1. **Input:**
   - `TestStep` with `rawText` and `pagePath`,
   - `UiPage` and associated `UiElement[]` for that path.

2. **LLM Prompting:**
   - Prompt includes:
     - a description of available UI elements (subset, limited for token size),
     - step text,
     - allowed actions list.

3. **LLM Output (required JSON shape):**

```json
{
  "action": "fill",
  "ui_element_id": "uuid-of-element",
  "value": "value to type or expected text"
}
```

4. **Persist:**
   - Update `TestStep.action`, `TestStep.uiElementId`, `TestStep.value`.

5. **Fallbacks:**
   - If mapping fails:
     - mark step as `unmapped`,
     - skip or log as warning during run.

### 5.5. Test Execution Flow (Runner)

1. **Trigger:**
   - `POST /runs` with:
     - `suiteName`,
     - list of test case ids or a query (e.g. by tags/feature).

2. **Runner Steps:**
   - Create `TestRun` row with `status = "queued"`.
   - Start Playwright workers (parallel).
   - For each selected `TestCase`:
     - load its `TestStep`s.
     - For each step:
       - if `action/uiElementId` are missing:
         - call mapping flow (or skip).
       - translate to Playwright commands.

3. **Examples:**

```ts
// navigate
await page.goto(baseUrl + step.pagePath);

// fill
const el = getLocatorFromUiElement(page, uiElement);
await el.fill(step.value!);

// click
const el = getLocatorFromUiElement(page, uiElement);
await el.click();

// assert_text
const el = getLocatorFromUiElement(page, uiElement);
await expect(el).toContainText(step.value!);
```

4. **Artifacts:**
   - On failure:
     - save screenshot,
     - save Playwright trace,
     - attach error message and stack.

5. **Complete Run:**
   - Update `TestRun.status` to `passed/failed/partial`.
   - Store metadata for each `TestCaseRun`.

---

## 6. API Sketch

> Names and frameworks are suggestions; actual implementation may differ.

### 6.1. Documentation

- `POST /ingestion/run`
  - Body: `{ "sourceType": "...", "config": {...} }`
  - Response: `{ "ingestionId": "..." }`

- `GET /ingestion/:id`
  - Returns ingestion status and counts.

### 6.2. Test Cases

- `POST /testcases/generate`
  - Body: `{ "featureKey": "auth/login", "query": "login flow", "limit": 5 }`
  - Response: `{ "created": [...], "updated": [...] }`

- `GET /testcases`
  - Query by `featureKey`, tags, status, etc.

### 6.3. UI Map

- `POST /uimap/build`
  - Body: `{ "routes": ["/login", "/dashboard"] }`

- `GET /uimap/pages`
- `GET /uimap/pages/:id/elements`

### 6.4. Runs

- `POST /runs`
  - Body: `{ "suiteName": "smoke", "testCaseIds": ["..."] }`
- `GET /runs/:id`
- `GET /runs/:id/testcases`

---

## 7. LLM Prompts (High-Level)

> Codex should generate concrete prompt templates, but main contracts are:

### 7.1. Test Case Generator Prompt

- Input:
  - documentation chunk text,
  - feature key,
  - strict JSON schema description.

- Output:
  - JSON array of test cases:
    - `title`,
    - `preconditions`,
    - `steps` (array of strings),
    - `expected_result`,
    - `priority`,
    - `tags`.

### 7.2. Step-to-UI Mapping Prompt

- Input:
  - page path,
  - list of UI elements for the page (limited to top N, summarised),
  - test step text,
  - allowed action types.

- Output:
  - JSON object:
    - `action`,
    - `ui_element_id`,
    - `value` (optional).

---

## 8. Implementation Plan (Milestones)

1. **Milestone 1: Core Data & Ingestion**
   - Implement DB schema and migrations.
   - Build ingestion service (one source type, e.g. local Markdown).
   - Implement chunking + embeddings + vector search.

2. **Milestone 2: Test Case Generation**
   - Integrate LLM runtime (Ollama or similar).
   - Implement `TestCaseGenerator`.
   - Provide CLI/API to generate test cases for a feature.

3. **Milestone 3: Basic Runner**
   - Integrate Playwright.
   - Implement a runner that:
     - reads a simple, manually defined test case JSON,
     - executes steps with hardcoded locators.

4. **Milestone 4: UI Map + Mapping**
   - Build UI map builder using Playwright DOM scan.
   - Implement `UiActionMapper` via LLM.
   - Connect test steps to UI elements dynamically.

5. **Milestone 5: Full Flow & Reporting**
   - Wire all pieces: ingestion → test generation → mapping → execution.
   - Add reporting (test runs, screenshots, traces).
   - Add basic dashboard (optional) or JSON/HTML reports.

---

## 9. Constraints & Assumptions

- Target is a web application with reasonably stable DOM structure and semantic attributes (roles, labels, data-testid).
- Documentation is mostly structured and not wildly outdated.
- System initially runs in a controlled environment (test/staging URLs, seeded data).
- All LLM prompts return **strict JSON** (no explanations, no markdown).
- Failures in mapping or LLM calls should not crash the runner; they should mark steps/test cases as failed with clear reason.

---
