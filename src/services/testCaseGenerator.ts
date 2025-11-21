import { z } from "zod";
import { buildTestCasePrompt } from "../prompts/testCasePrompt";
import { OpenRouterClient } from "../llm/openRouterClient";
import { DocumentChunk, GeneratedTestCasePayload, TestCase, TestStep } from "../types";
import { InMemoryStore } from "../storage/inMemoryStore";

const TestCaseArraySchema = z
  .array(
    z.object({
      title: z.string().min(1),
      preconditions: z.array(z.string()).default([]),
      steps: z.array(z.string()).min(1),
      expected_result: z.string().min(1),
      priority: z.enum(["low", "medium", "high"]),
      tags: z.array(z.string()).default([]),
      featureKey: z.string().min(1),
    })
  )
  .min(1);

function cleanJson(content: string): string {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return content.trim();
}

export class TestCaseGenerator {
  constructor(private readonly llm: OpenRouterClient, private readonly store: InMemoryStore) {}

  async generateFromChunk(chunk: DocumentChunk, featureKey: string): Promise<TestCase[]> {
    const prompt = buildTestCasePrompt(chunk, featureKey);
    const raw = await this.llm.chat(prompt, { reasoning: false });
    const parsed = this.parse(raw);
    return parsed.map((payload) => this.persist(payload, chunk));
  }

  private parse(raw: string): GeneratedTestCasePayload[] {
    const cleaned = cleanJson(raw);
    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Failed to parse LLM JSON: ${(err as Error).message}\nRaw:\n${cleaned}`);
    }
    return TestCaseArraySchema.parse(json);
  }

  private persist(payload: GeneratedTestCasePayload, chunk: DocumentChunk): TestCase {
    const tagsWithPreconditions =
      payload.preconditions.length > 0
        ? Array.from(new Set([...payload.tags, ...payload.preconditions.map((p) => `pre:${p}`)]))
        : payload.tags;
    const base: Omit<TestCase, "id" | "createdAt" | "updatedAt"> = {
      featureKey: payload.featureKey,
      title: payload.title,
      description: payload.expected_result,
      sourceChunkId: chunk.id,
      priority: payload.priority,
      status: "active",
      tags: tagsWithPreconditions,
    };
    const testCase = this.store.upsertTestCase(base);
    const steps: Array<Omit<TestStep, "id" | "testCaseId" | "index">> = payload.steps.map((stepText) => ({
      rawText: stepText,
      pagePath: undefined,
      action: undefined,
      value: undefined,
      uiElementId: undefined,
    }));
    this.store.replaceTestSteps(testCase.id, steps);
    return testCase;
  }
}
