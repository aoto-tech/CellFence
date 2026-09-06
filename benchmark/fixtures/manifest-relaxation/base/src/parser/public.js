import { tokenizeLine } from "./internal/tokenizer.js";

export function parseLine(line) {
  return {
    tokens: tokenizeLine(line),
  };
}
