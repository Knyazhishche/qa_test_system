export type DocSourceType = "confluence" | "markdown" | "openapi" | "other";

export interface DocumentSource {
  id: string;
  type: DocSourceType;
  name: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  sourceId: string;
  title: string;
  path?: string;
  content: string;
  embedding: number[];
  createdAt: string;
}

export type TestPriority = "low" | "medium" | "high";
export type TestStatus = "draft" | "active" | "deprecated";

export interface TestCase {
  id: string;
  featureKey: string;
  title: string;
  description?: string;
  sourceChunkId: string;
  priority: TestPriority;
  status: TestStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type TestStepAction =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "check"
  | "uncheck"
  | "assert_text"
  | "assert_url"
  | "wait_for_network_idle"
  | "unmapped";

export interface TestStep {
  id: string;
  testCaseId: string;
  index: number;
  rawText: string;
  pagePath?: string;
  action?: TestStepAction;
  uiElementId?: string;
  value?: string;
}

export type UiElementType = "button" | "input" | "link" | "checkbox" | "select" | "other";

export interface UiPage {
  id: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface UiElement {
  id: string;
  pageId: string;
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

export type TestRunStatus = "queued" | "running" | "passed" | "failed" | "partial";

export interface TestRun {
  id: string;
  suiteName: string;
  gitCommit?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: TestRunStatus;
}

export type TestCaseRunStatus = "not_run" | "passed" | "failed" | "skipped";

export interface TestCaseRun {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: TestCaseRunStatus;
  errorMessage?: string;
  tracePath?: string;
  screenshotPath?: string;
}

export interface GeneratedTestCasePayload {
  title: string;
  preconditions: string[];
  steps: string[];
  expected_result: string;
  priority: TestPriority;
  tags: string[];
  featureKey: string;
}
