import { tokenizeLine } from "../parser/internal/tokenizer.js";

export function renderReport(line) {
  return {
    tokens: tokenizeLine(line),
  };
}
