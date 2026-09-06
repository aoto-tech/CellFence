import { tokenizeLine } from "../parser/internal/tokenizer.js";

export function renderReport(line) {
  return {
    tokenCount: tokenizeLine(line).length,
  };
}
