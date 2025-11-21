import { DocumentChunk } from "../types";

export function buildTestCasePrompt(chunk: DocumentChunk, featureKey: string): { role: "system" | "user"; content: string }[] {
  const system = {
    role: "system" as const,
    content: [
      "You are an expert QA automation generator.",
      "Given product documentation, output concise UI regression test cases as strict JSON.",
      "Do not include markdown, comments, or explanations.",
      "Limit to the 3-5 strongest cases per chunk.",
      "Use only the schema: [ { title, preconditions, steps, expected_result, priority, tags, featureKey } ].",
      "priority must be one of: low | medium | high.",
      "preconditions and steps must be arrays of short strings.",
      "expected_result must be a single string.",
      "tags should be short keywords like ['happy_path','negative','edge']."
    ].join("\n"),
  };

  const user = {
    role: "user" as const,
    content: [
      `Feature: ${featureKey}`,
      "Documentation chunk:",
      chunk.content,
      "",
      "Respond with JSON only."
    ].join("\n"),
  };

  return [system, user];
}
