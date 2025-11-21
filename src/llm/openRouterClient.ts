import { config, requireApiKey } from "../config";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  reasoning?: boolean;
}

export interface ChatResponseChoice {
  message: ChatMessage;
}

export interface ChatResponse {
  choices: ChatResponseChoice[];
}

export class OpenRouterClient {
  constructor(private readonly apiKey = config.openRouterApiKey) {}

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    requireApiKey("OpenRouter (Grok)");

    const body = {
      model: config.grokModel,
      messages,
      temperature: options.temperature ?? 0,
      extra_body: {
        reasoning: {
          enabled: options.reasoning ?? config.reasoning,
        },
      },
    };

    const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as ChatResponse;
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenRouter response did not include a message content.");
    }

    return content;
  }
}
