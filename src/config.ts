export const config = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  grokModel: process.env.OPENROUTER_GROK_MODEL ?? "x-ai/grok-4.1-fast",
  reasoning: process.env.OPENROUTER_REASONING === "false" ? false : true,
  notionApiKey: process.env.NOTION_API_KEY ?? "",
  notionApiBaseUrl: process.env.NOTION_API_BASE_URL ?? "https://api.notion.com/v1",
  notionApiVersion: process.env.NOTION_API_VERSION ?? "2022-06-28",
  postgresUrl: process.env.POSTGRES_URL ?? "",
  postgresSchema: process.env.POSTGRES_SCHEMA ?? "public",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? "64"),
};

export function requireApiKey(serviceName: string): void {
  if (!config.openRouterApiKey) {
    throw new Error(`OPENROUTER_API_KEY is required to call ${serviceName}.`);
  }
}

export function requireNotionApiKey(): void {
  if (!config.notionApiKey) {
    throw new Error("NOTION_API_KEY is required for Notion ingestion.");
  }
}

export function requirePostgresUrl(): void {
  if (!config.postgresUrl) {
    throw new Error("POSTGRES_URL is required to use Postgres storage.");
  }
}
