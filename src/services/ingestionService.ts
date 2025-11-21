import { readFile } from "fs/promises";
import { StoreAdapter } from "../storage/storeAdapter";
import { embedText } from "./embedding";
import { chunkMarkdown } from "./chunker";
import { DocumentChunk, DocumentSource } from "../types";
import { NotionClient } from "./notionClient";

export interface IngestionResult {
  source: DocumentSource;
  chunks: DocumentChunk[];
}

export class IngestionService {
  constructor(private readonly store: StoreAdapter) {}

  async ingestMarkdownFile(path: string, name: string, url?: string): Promise<IngestionResult> {
    const markdown = await readFile(path, "utf8");
    const source = await this.store.createDocumentSource({ type: "markdown", name, url });
    const chunks = await this.ingestMarkdownContent(markdown, source);
    return { source, chunks };
  }

  async ingestMarkdownString(name: string, markdown: string, url?: string): Promise<IngestionResult> {
    const source = await this.store.createDocumentSource({ type: "markdown", name, url });
    const chunks = await this.ingestMarkdownContent(markdown, source);
    return { source, chunks };
  }

  async ingestMarkdownContent(markdown: string, source: DocumentSource): Promise<DocumentChunk[]> {
    const sections = chunkMarkdown(markdown);
    const chunks = sections.map((section) => ({
      title: section.title,
      path: section.title,
      content: section.content,
      embedding: embedText(section.content),
    }));
    return this.store.addDocumentChunks(source.id, chunks);
  }

  async ingestNotionPage(notion: NotionClient, pageId: string): Promise<IngestionResult> {
    const title = await notion.getPageTitle(pageId);
    const markdown = await notion.getPageMarkdown(pageId);
    const cleanTitle = title.trim() || "Notion Page";
    const url = `https://www.notion.so/${pageId.replace(/-/g, "")}`;
    const source = await this.store.createDocumentSource({ type: "notion", name: cleanTitle, url });
    const chunks = await this.ingestMarkdownContent(markdown, source);
    return { source, chunks };
  }
}
