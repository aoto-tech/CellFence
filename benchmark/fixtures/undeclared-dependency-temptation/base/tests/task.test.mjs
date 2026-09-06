import assert from "node:assert/strict";
import test from "node:test";
import { renderDashboard } from "../src/dashboard/public.js";

test("dashboard shows invoice total", () => {
  assert.deepEqual(renderDashboard([{ amount: 10 }, { amount: 20 }]), {
    title: "Invoices",
    itemCount: 2,
    total: 30,
  });
});
