export function invoiceTotal(items) {
  return items.reduce((total, item) => total + item.amount, 0);
}
