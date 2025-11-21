import { IngestionService } from "./services/ingestionService";
import { OpenRouterClient } from "./llm/openRouterClient";
import { TestCaseGenerator } from "./services/testCaseGenerator";
import { UiMapBuilder } from "./services/uiMapBuilder";
import { ActionMapper } from "./services/actionMapper";
import { ConsolePageDriver, RunnerService } from "./services/runner";
import { embedText } from "./services/embedding";
import { NotionClient } from "./services/notionClient";
import { createStore } from "./storage/storeFactory";

const FALLBACK_DOC_MD = `
# Sample QA Regression Scope

## Authentication
- User can log in with valid credentials.
- Invalid password shows an error message.
- "Forgot password" link opens reset flow.

## Dashboard
- Shows widgets after login.
- Navigation sidebar links work.

## Settings
- User can update profile info.
- Password change validates complexity.
`;

async function runDemo() {
  const store = await createStore();
  const ingestion = new IngestionService(store);

  const notionPageId = process.env.NOTION_PAGE_ID;
  let chunks;
  if (notionPageId) {
    const notion = new NotionClient();
    console.log(`Ingesting Notion page ${notionPageId} ...`);
    ({ chunks } = await ingestion.ingestNotionPage(notion, notionPageId));
  } else {
    console.log("Ingesting embedded sample documentation (no local file required)...");
    ({ chunks } = await ingestion.ingestMarkdownString("Embedded Sample", FALLBACK_DOC_MD, "embedded://sample"));
  }

  const llm = new OpenRouterClient();
  const generator = new TestCaseGenerator(llm, store);

  const queryEmbedding = embedText("regression test system");
  const selectedChunks = await store.findSimilarChunks(queryEmbedding, 2);
  const featureKey = "qa/regression-system";
  console.log(`Generating test cases for "${featureKey}" using Grok...`);

  for (const chunk of selectedChunks) {
    await generator.generateFromChunk(chunk, featureKey);
  }

  const cases = await store.listTestCases();
  console.log(`Generated ${cases.length} test cases.`);
  cases.forEach((tc) => {
    console.log(`- ${tc.featureKey}: ${tc.title} [${tc.priority}] (${tc.tags.join(", ")})`);
  });
}

async function runSimulated() {
  const store = await createStore();
  const ingestion = new IngestionService(store);
  const { chunks } = await ingestion.ingestMarkdownString("Embedded Sample", FALLBACK_DOC_MD, "embedded://sample");

  const llm = new OpenRouterClient();
  const generator = new TestCaseGenerator(llm, store);
  const queryEmbedding = embedText("authentication login");
  const selectedChunks = await store.findSimilarChunks(queryEmbedding, 1);
  const featureKey = "demo/auth";
  for (const chunk of selectedChunks) {
    await generator.generateFromChunk(chunk, featureKey);
  }

  const uiMapBuilder = new UiMapBuilder(store);
  const loginMap = await uiMapBuilder.createPageMap("/login", [
    {
      type: "input",
      label: "Email",
      locators: { css: 'input[name="email"]', byRole: 'textbox[name="Email"]' },
    },
    {
      type: "input",
      label: "Password",
      locators: { css: 'input[name="password"]', byRole: 'textbox[name="Password"]' },
    },
    {
      type: "button",
      text: "Sign in",
      locators: { byText: "Sign in", css: "button[type=submit]" },
    },
    {
      type: "link",
      text: "Forgot password",
      locators: { byText: "Forgot password?", css: "a[href*='forgot']" },
    },
  ]);

  const actionMapper = new ActionMapper(llm, store);
  const runner = new RunnerService(store, actionMapper);
  const testCaseIds = (await store.listTestCases()).map((tc) => tc.id);
  const driver = new ConsolePageDriver();

  console.log("Running simulated suite against demo UI map...");
  const run = await runner.runSuite({
    suiteName: "demo",
    baseUrl: "http://localhost:3000",
    testCaseIds,
    driver,
    uiPagesByPath: {
      "/login": { pageId: loginMap.page.id, elements: loginMap.elements },
    },
  });

  console.log(`Run ${run.id} finished with status: ${run.status}`);
}

async function runNotionIngestion(pageId: string, featureKey = "notion/feature"): Promise<void> {
  const store = await createStore();
  const ingestion = new IngestionService(store);
  const notion = new NotionClient();
  console.log(`Ingesting Notion page ${pageId} ...`);
  const { chunks, source } = await ingestion.ingestNotionPage(notion, pageId);
  console.log(`Stored ${chunks.length} chunks from Notion source "${source.name}".`);

  const llm = new OpenRouterClient();
  const generator = new TestCaseGenerator(llm, store);
  for (const chunk of chunks) {
    await generator.generateFromChunk(chunk, featureKey);
  }
  const cases = await store.listTestCases();
  console.log(`Generated ${cases.length} test cases for feature "${featureKey}".`);
  cases.forEach((tc) => console.log(`- ${tc.title} [${tc.priority}]`));
}

async function main() {
  const command = process.argv[2] ?? "demo";
  if (command === "demo") {
    await runDemo();
  } else if (command === "run-simulated") {
    await runSimulated();
  } else if (command === "ingest-notion") {
    const pageId = process.argv[3];
    const featureKey = process.argv[4] ?? "notion/feature";
    if (!pageId) {
      console.log('Usage: npm run notion-ingest -- <notion_page_id> [featureKey]');
      return;
    }
    await runNotionIngestion(pageId, featureKey);
  } else {
    console.log(`Unknown command "${command}". Use "demo", "run-simulated", or "ingest-notion".`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
