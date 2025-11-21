export interface Chunk {
  title: string;
  content: string;
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function chunkMarkdown(markdown: string, maxChars = 1200): Chunk[] {
  const normalized = normalizeWhitespace(markdown);
  const sections: Chunk[] = [];
  const lines = normalized.split("\n");

  let currentTitle = "Introduction";
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const chunkContent = buffer.join("\n").trim();
    if (!chunkContent) return;

    if (chunkContent.length <= maxChars) {
      sections.push({ title: currentTitle, content: chunkContent });
      buffer = [];
      return;
    }

    // Split long sections into smaller parts by paragraphs.
    const paragraphs = chunkContent.split(/\n\s*\n/);
    let temp: string[] = [];
    paragraphs.forEach((p) => {
      const next = temp.concat(p);
      const candidate = next.join("\n\n");
      if (candidate.length > maxChars) {
        if (temp.length > 0) {
          sections.push({ title: currentTitle, content: temp.join("\n\n") });
          temp = [p];
        } else {
          sections.push({ title: currentTitle, content: p.slice(0, maxChars) });
          temp = [p.slice(maxChars)];
        }
      } else {
        temp = next;
      }
    });
    if (temp.length > 0) {
      sections.push({ title: currentTitle, content: temp.join("\n\n") });
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^#{1,6}\s+(.*)/.exec(line);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections;
}
