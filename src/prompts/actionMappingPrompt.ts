import { TestStep, UiElement, UiPage } from "../types";

function formatUiElements(elements: UiElement[]): string {
  return elements
    .map((el) => {
      const labels = [
        el.role && `role=${el.role}`,
        el.text && `text="${el.text}"`,
        el.placeholder && `placeholder="${el.placeholder}"`,
        el.label && `label="${el.label}"`,
        el.dataTestId && `data-testid="${el.dataTestId}"`,
        el.locators.byRole && `byRole=${el.locators.byRole}`,
        el.locators.byText && `byText=${el.locators.byText}`,
        el.locators.css && `css=${el.locators.css}`,
      ]
        .filter(Boolean)
        .join(" | ");
      return `${el.id}: type=${el.type}${labels ? " | " + labels : ""}`;
    })
    .join("\n");
}

export function buildActionMappingPrompt(step: TestStep, page: UiPage, elements: UiElement[]): { role: "system" | "user"; content: string }[] {
  const system = {
    role: "system" as const,
    content: [
      "You are assisting a Playwright test runner.",
      "Given a human-readable test step and a list of available UI elements for a page, pick the most likely action and target element.",
      "Return strict JSON only with shape: { \"action\": \"fill|click|navigate|select|check|uncheck|assert_text|assert_url|wait_for_network_idle|unmapped\", \"ui_element_id\": \"...\", \"value\": \"optional\" }",
      "Use action \"navigate\" only when the step is about loading a page/route.",
      "If no element matches, set action to \"unmapped\" and ui_element_id to null.",
      "Do not include explanations."
    ].join("\n"),
  };

  const user = {
    role: "user" as const,
    content: [
      `Page: ${page.url}`,
      `Step: ${step.rawText}`,
      "",
      "Available UI elements:",
      formatUiElements(elements),
      "",
      "Respond with JSON only."
    ].join("\n"),
  };

  return [system, user];
}
