import { createHash } from "crypto";
import { config } from "../config";

export function embedText(text: string, dimensions = config.embeddingDimensions || 64): number[] {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const vector = new Array(dimensions).fill(0);

  tokens.forEach((token) => {
    const hash = createHash("md5").update(token).digest();
    const index = hash[0] % dimensions;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + (hash[2] % 3));
  });

  return vector;
}
