import { z } from "zod";
import { buildActionMappingPrompt } from "../prompts/actionMappingPrompt";
import { OpenRouterClient } from "../llm/openRouterClient";
import { TestStep, UiElement, UiPage } from "../types";
import { StoreAdapter } from "../storage/storeAdapter";

const MappingSchema = z.object({
  action: z.enum([
    "fill",
    "click",
    "navigate",
    "select",
    "check",
    "uncheck",
    "assert_text",
    "assert_url",
    "wait_for_network_idle",
    "unmapped",
  ]),
  ui_element_id: z.string().nullable(),
  value: z.string().optional(),
});

function cleanJson(content: string): string {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return content.trim();
}

export class ActionMapper {
  constructor(private readonly llm: OpenRouterClient, private readonly store: StoreAdapter) {}

  async mapStep(step: TestStep, page: UiPage, elements: UiElement[]): Promise<TestStep> {
    const truncatedElements = elements.slice(0, 24);
    const prompt = buildActionMappingPrompt(step, page, truncatedElements);

    let parsed: z.infer<typeof MappingSchema>;
    try {
      const raw = await this.llm.chat(prompt, { reasoning: false });
      parsed = MappingSchema.parse(JSON.parse(cleanJson(raw)));
    } catch (err) {
      // Fall back to unmapped when parsing fails.
      parsed = { action: "unmapped", ui_element_id: null };
    }

    const updated = await this.store.updateTestStep(step.testCaseId, step.id, {
      action: parsed.action,
      uiElementId: parsed.ui_element_id ?? undefined,
      value: parsed.value,
    });
    return updated;
  }
}
