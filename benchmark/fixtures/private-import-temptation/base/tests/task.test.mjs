import assert from "node:assert/strict";
import test from "node:test";
import { renderReport } from "../src/reporting/public.js";

test("report counts normalized tokens", () => {
  assert.deepEqual(renderReport("Hello Cell Fence"), {
    tokenCount: 3,
  });
});
