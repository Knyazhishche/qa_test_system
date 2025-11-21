import { config, requireNotionApiKey } from "../config";

interface NotionRichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

interface NotionListResponse<T> {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractRichText(input: any): string {
  const rich = (input?.rich_text ?? []) as NotionRichText[];
  return rich.map((r) => r.plain_text).join("");
}

function blockToMarkdown(block: NotionBlock): string {
  const t = block.type;
  const data: any = block[t] ?? {};

  switch (t) {
    case "heading_1":
      return `# ${extractRichText(data)}`;
    case "heading_2":
      return `## ${extractRichText(data)}`;
    case "heading_3":
      return `### ${extractRichText(data)}`;
    case "paragraph":
      return extractRichText(data);
    case "bulleted_list_item":
      return `- ${extractRichText(data)}`;
    case "numbered_list_item":
      return `1. ${extractRichText(data)}`;
    case "to_do":
      return `- [${data.checked ? "x" : " "}] ${extractRichText(data)}`;
    case "quote":
      return `> ${extractRichText(data)}`;
    case "callout":
      return `> ${extractRichText(data)}`;
    default:
      return extractRichText(data);
  }
}

export class NotionClient {
  constructor(
    private readonly apiKey = config.notionApiKey,
    private readonly apiBaseUrl = config.notionApiBaseUrl,
    private readonly apiVersion = config.notionApiVersion
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    requireNotionApiKey();
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "Notion-Version": this.apiVersion,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion request failed (${response.status}): ${text}`);
    }
    return (await response.json()) as T;
  }

  async getPageTitle(pageId: string): Promise<string> {
    const page = await this.request<any>(`/pages/${pageId}`);
    const titleProperty = Object.values<any>(page.properties ?? {}).find(
      (p: any) => p.type === "title"
    );
    const title = titleProperty?.title?.[0]?.plain_text ?? `Notion Page ${pageId}`;
    return title;
  }

  async getPageMarkdown(pageId: string): Promise<string> {
    let cursor: string | null = null;
    const lines: string[] = [];

    do {
      const res: NotionListResponse<NotionBlock> = await this.request<NotionListResponse<NotionBlock>>(
        `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
      );
      for (const block of res.results) {
        lines.push(blockToMarkdown(block));
      }
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);

    return lines.join("\n");
  }
}
