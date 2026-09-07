import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  declarationTextForRoot,
  extractImports,
} from "../packages/engine/dist/module-resolution.js";

function context(rootDir) {
  return {
    rootDir,
    manifest: { schemaVersion: "cellfence.manifest.v1", cells: [] },
    sourceFilesForCellCache: new Map(),
    sourceTextCache: new Map(),
    sourceFileCache: new Map(),
  };
}

function scan(rootDir, source, fileName = "src/app.mts") {
  const filePath = path.join(rootDir, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${source}\n`);
  const warnings = [];
  const references = extractImports(context(rootDir), filePath, warnings);
  return { filePath, references, warnings };
}

test("createRequire origin recognition distinguishes globals, shadows, literals, and URL bases", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-create-require-origin-mutants-"));
  try {
    const same = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire(__filename);",
      "loader('./dep.cjs');",
    ].join("\n"));
    assert.deepEqual(same.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["node:module", undefined],
      ["./dep.cjs", undefined],
    ]);
    assert.deepEqual(same.warnings, []);

    const alias = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire(__filename);",
      "const second = loader;",
      "second('./dep.cjs');",
    ].join("\n"), "src/alias.mts");
    assert.deepEqual(alias.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["node:module", undefined],
      ["./dep.cjs", undefined],
    ]);
    assert.deepEqual(alias.warnings, []);

    const shadowedFilename = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "function load(__filename: string) {",
      "  const loader = createRequire(__filename);",
      "  return loader('./dep.cjs');",
      "}",
    ].join("\n"), "src/shadowed-filename.mts");
    assert.deepEqual(shadowedFilename.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(shadowedFilename.warnings.length, 1);
    assert.equal(shadowedFilename.warnings[0].severity, "warning");
    assert.match(shadowedFilename.warnings[0].message, /computed loader\(\) cannot be resolved statically/);

    const relativeLiteral = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire('./relative.cjs');",
      "loader('./dep.cjs');",
    ].join("\n"), "src/relative.mts");
    assert.deepEqual(relativeLiteral.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(relativeLiteral.warnings.length, 1);
    assert.equal(relativeLiteral.warnings[0].severity, "warning");

    const urlBase = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire(new URL('./base.cjs', import.meta.url));",
      "loader('./dep.cjs');",
    ].join("\n"), "src/url-base.mts");
    assert.deepEqual(urlBase.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["node:module", undefined],
      ["./dep.cjs", "src/base.cjs"],
    ]);
    assert.equal(urlBase.references[1].kind, "require");
    assert.equal(urlBase.references[1].typeOnly, false);
    assert.deepEqual(urlBase.warnings, []);

    const urlSingleBasePath = path.join(rootDir, "src/url-single-base.cjs");
    const urlSingleArgument = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      `const loader = createRequire(new URL(${JSON.stringify(pathToFileURL(urlSingleBasePath).href)}));`,
      "loader('./dep.cjs');",
    ].join("\n"), "src/url-single.mts");
    assert.equal(urlSingleArgument.references.length, 2);
    assert.equal(urlSingleArgument.references[1].specifier, "./dep.cjs");
    assert.equal(urlSingleArgument.references[1].resolutionBasePath, "src/url-single-base.cjs");
    assert.deepEqual(urlSingleArgument.warnings, []);

    const shadowedUrl = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "function load(URL: new (...args: unknown[]) => unknown) {",
      "  const loader = createRequire(new URL('./base.cjs', import.meta.url) as never);",
      "  return loader('./dep.cjs');",
      "}",
    ].join("\n"), "src/shadowed-url.mts");
    assert.deepEqual(shadowedUrl.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(shadowedUrl.warnings.length, 1);
    assert.equal(shadowedUrl.warnings[0].severity, "warning");

    const wrongNew = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "declare const NotURL: new (...args: unknown[]) => unknown;",
      "const loader = createRequire(new NotURL('./base.cjs', import.meta.url) as never);",
      "loader('./dep.cjs');",
    ].join("\n"), "src/not-url.mts");
    assert.deepEqual(wrongNew.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(wrongNew.warnings.length, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("createRequire forwarding preserves resolution bases across direct, call, apply, and guarded uses", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-create-require-forward-mutants-"));
  try {
    const direct = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "createRequire(new URL('./base.cjs', import.meta.url))('./direct.cjs');",
    ].join("\n"), "src/direct.mts");
    assert.deepEqual(direct.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["node:module", undefined],
      ["./direct.cjs", "src/base.cjs"],
    ]);

    const forwarded = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire(new URL('./base.cjs', import.meta.url));",
      "loader.call(null, './call.cjs');",
      "loader.apply(null, ['./apply.cjs']);",
      "Reflect.apply(loader, null, ['./reflect.cjs']);",
    ].join("\n"), "src/forwarded.mts");
    assert.deepEqual(forwarded.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["node:module", undefined],
      ["./call.cjs", "src/base.cjs"],
      ["./apply.cjs", "src/base.cjs"],
      ["./reflect.cjs", "src/base.cjs"],
    ]);
    assert.deepEqual(forwarded.warnings, []);

    const guarded = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "declare const origin: string;",
      "const loader = createRequire(origin);",
      "const allowed = new Set(['./guarded.cjs']);",
      "export function load(candidate: string) {",
      "  if (allowed.has(candidate)) return loader(candidate);",
      "}",
    ].join("\n"), "src/guarded.mts");
    assert.deepEqual(guarded.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(guarded.warnings.length, 1);
    assert.equal(guarded.warnings[0].severity, "warning");
    assert.match(guarded.warnings[0].message, /computed guarded require\(\) cannot be resolved statically/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("multiple internal declaration ranges are stripped from the end without corrupting public declarations", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-declaration-range-mutant-"));
  try {
    const filePath = path.join(rootDir, "api.d.ts");
    fs.writeFileSync(filePath, [
      "/** @internal */ export interface HiddenA { a: string }",
      "export interface PublicA { a: string }",
      "/** @internal */ export type HiddenB = number;",
      "export type PublicB = boolean;",
      "/** @internal */ export declare const hiddenC: unique symbol;",
      "export declare const publicC: string;",
      "",
    ].join("\n"));

    assert.equal(
      declarationTextForRoot(filePath, {}),
      [
        "export interface PublicA {",
        "    a: string;",
        "}",
        "export type PublicB = boolean;",
        "export declare const publicC: string;",
        "",
      ].join("\n"),
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});


test("source declarations remove multiple internal spans before declaration emit", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-source-internal-spans-"));
  try {
    for (const extension of ["ts", "mts", "cts"]) {
      const filePath = path.join(rootDir, `api.${extension}`);
      fs.writeFileSync(filePath, [
        "/** @internal */ export interface HiddenA { a: string }",
        "export interface PublicA { a: string }",
        "/** @internal */ export type HiddenB = number;",
        "export type PublicB = boolean;",
        "/** @internal */ export declare const hiddenC: unique symbol;",
        "export declare const publicC: string;",
        "",
      ].join("\n"));
      assert.equal(declarationTextForRoot(filePath, {}), [
        "export interface PublicA {",
        "    a: string;",
        "}",
        "export type PublicB = boolean;",
        "export declare const publicC: string;",
        "",
      ].join("\n"), extension);
    }
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("assigned require aliases retain complete unresolved diagnostics", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-assigned-loader-diagnostic-"));
  try {
    for (const initializer of ["require", "createRequire(import.meta.url)"]) {
      const result = scan(rootDir, [
        "import { createRequire } from 'node:module';",
        "let assigned;",
        `assigned = ${initializer};`,
        "assigned('./hidden.cjs');",
      ].join("\n"), "src/assigned.mts");
      assert.deepEqual(result.references.map((reference) => reference.specifier), ["node:module"]);
      assert.deepEqual(result.warnings, [{
        ruleId: "CELLFENCE_UNSUPPORTED_DYNAMIC_REQUIRE",
        severity: "warning",
        filePath: "src/assigned.mts",
        message: "assigned require alias cannot be resolved statically at line 3",
        details: { line: 3 },
      }]);
    }
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("recognized loader bindings do not turn ordinary calls or properties into imports", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cellfence-loader-recognition-"));
  try {
    const ordinary = scan(rootDir, [
      "const createRequire = (origin: string) => (name: string) => name;",
      "const loader = createRequire('/tmp/ordinary.cjs');",
      "loader('./ordinary.cjs');",
      "const other = { require: (name: string) => name };",
      "other.require('./property.cjs');",
    ].join("\n"));
    assert.deepEqual(ordinary.references, []);
    assert.deepEqual(ordinary.warnings, []);

    const builtin = scan(rootDir, [
      "module.require('./module.cjs');",
      "globalThis.require('./global.cjs');",
      "Reflect.apply(require, null, ['./reflected.cjs']);",
    ].join("\n"), "src/builtins.cjs");
    assert.deepEqual(builtin.references.map(({ specifier, resolutionBasePath }) => [specifier, resolutionBasePath]), [
      ["./module.cjs", undefined],
      ["./global.cjs", undefined],
      ["./reflected.cjs", undefined],
    ]);
    assert.deepEqual(builtin.warnings, []);

    const escaped = scan(rootDir, "consume(require);", "src/escaped.cjs");
    assert.deepEqual(escaped.references, []);
    assert.deepEqual(escaped.warnings, [{
      ruleId: "CELLFENCE_UNSUPPORTED_DYNAMIC_REQUIRE",
      severity: "warning",
      filePath: "src/escaped.cjs",
      message: "computed escaped require() cannot be resolved statically at line 1",
      details: { line: 1 },
    }]);

    const invalidUrl = scan(rootDir, [
      "import { createRequire } from 'node:module';",
      "const loader = createRequire('file://[invalid');",
      "loader('./invalid.cjs');",
    ].join("\n"), "src/invalid-url.mts");
    assert.deepEqual(invalidUrl.references.map((reference) => reference.specifier), ["node:module"]);
    assert.equal(invalidUrl.warnings.length, 1);
    assert.equal(invalidUrl.warnings[0].severity, "warning");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
