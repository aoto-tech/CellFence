import assert from "node:assert/strict";
import test from "node:test";

import { isPythonStdlibSpecifier } from "../packages/engine/dist/external-dependencies.js";

test("Python stdlib detection recognizes common Python 3.12 modules", () => {
  assert.equal(isPythonStdlibSpecifier("hashlib"), true);
  assert.equal(isPythonStdlibSpecifier("types"), true);
  assert.equal(isPythonStdlibSpecifier("tomllib"), true);
  assert.equal(isPythonStdlibSpecifier("types.SimpleNamespace"), true);
  assert.equal(isPythonStdlibSpecifier("tomllib.loads"), true);
});

test("Python stdlib detection does not classify third-party imports as stdlib", () => {
  assert.equal(isPythonStdlibSpecifier("requests"), false);
  assert.equal(isPythonStdlibSpecifier("pydantic"), false);
  assert.equal(isPythonStdlibSpecifier("toml"), false);
  assert.equal(isPythonStdlibSpecifier(".") , false);
  assert.equal(isPythonStdlibSpecifier("..local_module"), false);
});
