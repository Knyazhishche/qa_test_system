import { StoreAdapter } from "../storage/storeAdapter";
import { ActionMapper } from "./actionMapper";
import { TestCaseRunStatus, TestRun, TestStep, UiElement } from "../types";

export interface PageDriver {
  goto(url: string): Promise<void>;
  click(element: UiElement): Promise<void>;
  fill(element: UiElement, value: string): Promise<void>;
  select(element: UiElement, value: string): Promise<void>;
  check(element: UiElement): Promise<void>;
  uncheck(element: UiElement): Promise<void>;
  assertText(element: UiElement, expected: string): Promise<void>;
  assertUrl(expected: string): Promise<void>;
  waitForNetworkIdle(): Promise<void>;
}

export class ConsolePageDriver implements PageDriver {
  async goto(url: string): Promise<void> {
    console.log(`[navigate] ${url}`);
  }
  async click(element: UiElement): Promise<void> {
    console.log(`[click] ${describeElement(element)}`);
  }
  async fill(element: UiElement, value: string): Promise<void> {
    console.log(`[fill] ${describeElement(element)} = "${value}"`);
  }
  async select(element: UiElement, value: string): Promise<void> {
    console.log(`[select] ${describeElement(element)} -> "${value}"`);
  }
  async check(element: UiElement): Promise<void> {
    console.log(`[check] ${describeElement(element)}`);
  }
  async uncheck(element: UiElement): Promise<void> {
    console.log(`[uncheck] ${describeElement(element)}`);
  }
  async assertText(element: UiElement, expected: string): Promise<void> {
    console.log(`[assert_text] ${describeElement(element)} contains "${expected}"`);
  }
  async assertUrl(expected: string): Promise<void> {
    console.log(`[assert_url] url should contain "${expected}"`);
  }
  async waitForNetworkIdle(): Promise<void> {
    console.log("[wait_for_network_idle]");
  }
}

function describeElement(element: UiElement): string {
  return `${element.type}:${element.id}${element.text ? ` "${element.text}"` : ""}`;
}

interface UiPageContext {
  pageId: string;
  elements: UiElement[];
}

export interface RunOptions {
  suiteName: string;
  baseUrl: string;
  testCaseIds: string[];
  driver: PageDriver;
  uiPagesByPath?: Record<string, UiPageContext>;
}

export class RunnerService {
  constructor(private readonly store: StoreAdapter, private readonly mapper?: ActionMapper) {}

  async runSuite(options: RunOptions): Promise<TestRun> {
    const run = await this.store.createTestRun({
      suiteName: options.suiteName,
      gitCommit: undefined,
      startedAt: new Date().toISOString(),
      finishedAt: undefined,
    });
    await this.store.updateTestRun(run.id, { status: "running", startedAt: new Date().toISOString() });

    const results = [];
    for (const testCaseId of options.testCaseIds) {
      const result = await this.runTestCase(testCaseId, options);
      results.push(result);
    }
    await this.store.setTestCaseRuns(
      run.id,
      results.map((r) => ({
        testCaseId: r.testCaseId,
        status: r.status,
        errorMessage: r.errorMessage,
        screenshotPath: undefined,
        tracePath: undefined,
      }))
    );

    const overallStatus = results.every((r) => r.status === "passed")
      ? "passed"
      : results.some((r) => r.status === "failed")
      ? "failed"
      : "partial";

    return this.store.updateTestRun(run.id, {
      status: overallStatus,
      finishedAt: new Date().toISOString(),
    });
  }

  private async runTestCase(testCaseId: string, options: RunOptions): Promise<{ testCaseId: string; status: TestCaseRunStatus; errorMessage?: string }> {
    const steps = await this.store.getTestSteps(testCaseId);
    const testCaseList = await this.store.listTestCases();
    const testCase = testCaseList.find((tc) => tc.id === testCaseId);
    if (!testCase) {
      return { testCaseId, status: "failed", errorMessage: "Test case not found." };
    }

    for (const step of steps) {
      try {
        await this.executeStep(step, options);
      } catch (err) {
        return { testCaseId, status: "failed", errorMessage: (err as Error).message };
      }
    }

    return { testCaseId, status: "passed" };
  }

  private async executeStep(step: TestStep, options: RunOptions): Promise<void> {
    let action = step.action;
    let uiElement: UiElement | undefined;

    if (!action && this.mapper && options.uiPagesByPath && step.pagePath) {
      const context = options.uiPagesByPath[step.pagePath];
      if (context) {
        const mapped = await this.mapper.mapStep(
          step,
          { id: context.pageId, url: step.pagePath, createdAt: "", updatedAt: "" },
          context.elements
        );
        action = mapped.action;
      }
    }

    if (!action) {
      throw new Error(`Step is not mapped: "${step.rawText}"`);
    }

    if (step.uiElementId) {
      const lookup = options.uiPagesByPath ?? {};
      const candidates = Object.values(lookup).flatMap((ctx) => ctx.elements);
      uiElement = candidates.find((el) => el.id === step.uiElementId);
    }

    switch (action) {
      case "navigate":
        await options.driver.goto(`${options.baseUrl}${step.pagePath ?? ""}`);
        break;
      case "click":
        this.assertElement(step, uiElement);
        await options.driver.click(uiElement);
        break;
      case "fill":
        this.assertElement(step, uiElement);
        await options.driver.fill(uiElement, step.value ?? "");
        break;
      case "select":
        this.assertElement(step, uiElement);
        await options.driver.select(uiElement, step.value ?? "");
        break;
      case "check":
        this.assertElement(step, uiElement);
        await options.driver.check(uiElement);
        break;
      case "uncheck":
        this.assertElement(step, uiElement);
        await options.driver.uncheck(uiElement);
        break;
      case "assert_text":
        this.assertElement(step, uiElement);
        await options.driver.assertText(uiElement, step.value ?? "");
        break;
      case "assert_url":
        await options.driver.assertUrl(step.value ?? "");
        break;
      case "wait_for_network_idle":
        await options.driver.waitForNetworkIdle();
        break;
      case "unmapped":
      default:
        throw new Error(`Step could not be mapped: "${step.rawText}"`);
    }
  }

  private assertElement(step: TestStep, element: UiElement | undefined): asserts element is UiElement {
    if (!element) {
      throw new Error(`Missing UI element for step "${step.rawText}"`);
    }
  }
}
