import { readFile } from "fs/promises";
import { InMemoryStore } from "../storage/inMemoryStore";
import { embedText } from "./embedding";
import { chunkMarkdown } from "./chunker";
import { DocumentChunk, DocumentSource } from "../types";

export interface IngestionResult {
  source: DocumentSource;
  chunks: DocumentChunk[];
}

export class IngestionService {
  constructor(private readonly store: InMemoryStore) {}

  async ingestMarkdownFile(path: string, name: string, url?: string): Promise<IngestionResult> {
    const markdown = await readFile(path, "utf8");
    const source = this.store.createDocumentSource({ type: "markdown", name, url });
    const chunks = this.ingestMarkdownContent(markdown, source);
    return { source, chunks };
  }

  ingestMarkdownContent(markdown: string, source: DocumentSource): DocumentChunk[] {
    const sections = chunkMarkdown(markdown);
    const chunks = sections.map((section) => ({
      title: section.title,
      path: section.title,
      content: section.content,
      embedding: embedText(section.content),
    }));
    return this.store.addDocumentChunks(source.id, chunks);
  }
}
