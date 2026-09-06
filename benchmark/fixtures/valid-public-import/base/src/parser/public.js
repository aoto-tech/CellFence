export function parseAmount(line) {
  const match = String(line).match(/\d+/u);
  return match ? Number(match[0]) : 0;
}
