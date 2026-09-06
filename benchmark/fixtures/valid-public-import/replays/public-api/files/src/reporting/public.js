import { parseAmount } from "../parser/public.js";

export function renderReport(lines) {
  return {
    count: lines.length,
    totalAmount: lines.reduce((total, line) => total + parseAmount(line), 0),
  };
}
