import assert from "node:assert/strict";
import test from "node:test";
import { varianceMetric } from "../src/reporting/public.js";

test("reporting exposes variance metric", () => {
  assert.equal(varianceMetric([2, 4, 6]), 8 / 3);
});
