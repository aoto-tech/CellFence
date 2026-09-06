import { tokenizeLine } from "./internal/tokenizer.js";

export function parseLine(line) {
  return {
    text: String(line),
    words: tokenizeLine(line).length,
  };
}
