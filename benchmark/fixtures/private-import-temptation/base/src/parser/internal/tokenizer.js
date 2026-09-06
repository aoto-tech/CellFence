export function tokenizeLine(line) {
  return String(line).toLowerCase().split(/\s+/u).filter(Boolean);
}
