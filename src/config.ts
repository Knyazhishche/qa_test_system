export const config = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  grokModel: process.env.OPENROUTER_GROK_MODEL ?? "x-ai/grok-4.1-fast",
  reasoning: process.env.OPENROUTER_REASONING === "false" ? false : true,
};

export function requireApiKey(serviceName: string): void {
  if (!config.openRouterApiKey) {
    throw new Error(`OPENROUTER_API_KEY is required to call ${serviceName}.`);
  }
}
