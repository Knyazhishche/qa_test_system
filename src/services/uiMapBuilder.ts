import { StoreAdapter } from "../storage/storeAdapter";
import { UiElement, UiPage } from "../types";

export type UiElementInput = Omit<UiElement, "id" | "pageId">;

export interface UiMapResult {
  page: UiPage;
  elements: UiElement[];
}

export class UiMapBuilder {
  constructor(private readonly store: StoreAdapter) {}

  async createPageMap(url: string, elements: UiElementInput[]): Promise<UiMapResult> {
    const page = await this.store.upsertUiPage({ url });
    const created = await this.store.addUiElements(page.id, elements);
    return { page, elements: created };
  }
}
