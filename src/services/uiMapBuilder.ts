import { InMemoryStore } from "../storage/inMemoryStore";
import { UiElement, UiPage } from "../types";

export type UiElementInput = Omit<UiElement, "id" | "pageId">;

export interface UiMapResult {
  page: UiPage;
  elements: UiElement[];
}

export class UiMapBuilder {
  constructor(private readonly store: InMemoryStore) {}

  createPageMap(url: string, elements: UiElementInput[]): UiMapResult {
    const page = this.store.upsertUiPage({ url });
    const created = this.store.addUiElements(page.id, elements);
    return { page, elements: created };
  }
}
