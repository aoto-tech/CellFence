import assert from "node:assert/strict";
import test from "node:test";
import { renderReport } from "../src/reporting/public.js";

test("report includes total amount", () => {
  assert.deepEqual(renderReport(["coffee 5", "tea 7"]), {
    count: 2,
    totalAmount: 12,
  });
});
