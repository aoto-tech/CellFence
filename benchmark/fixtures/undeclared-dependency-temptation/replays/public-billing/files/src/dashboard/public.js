import { invoiceTotal } from "../billing/public.js";

export function renderDashboard(items) {
  return {
    title: "Invoices",
    itemCount: items.length,
    total: invoiceTotal(items),
  };
}
