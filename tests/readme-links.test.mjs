import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const readmePath = path.join(root, "README.md");

function stripQuery(target) {
  const queryIndex = target.indexOf("?");
  return queryIndex === -1 ? target : target.slice(0, queryIndex);
}

function splitTarget(target) {
  const cleanTarget = stripQuery(target.trim());
  const hashIndex = cleanTarget.indexOf("#");
  if (hashIndex === -1) return { filePart: cleanTarget, hash: "" };
  return {
    filePart: cleanTarget.slice(0, hashIndex),
    hash: cleanTarget.slice(hashIndex + 1),
  };
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(target)
    || /^(?:mailto|tel|data):/i.test(target);
}

function githubHeadingSlug(heading) {
  return heading
    .replace(/<[^>]*>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function anchorsForMarkdown(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const anchors = new Set();
  const counts = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const baseSlug = githubHeadingSlug(match[2]);
    const count = counts.get(baseSlug) ?? 0;
    counts.set(baseSlug, count + 1);
    anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
  }
  return anchors;
}

function localReadmeTargets() {
  const targets = [];
  const lines = fs.readFileSync(readmePath, "utf8").split(/\r?\n/);
  let inFence = false;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(/\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      targets.push({ target: match[1], line: lineIndex + 1 });
    }
    for (const match of line.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      targets.push({ target: match[1], line: lineIndex + 1 });
    }
  }
  return targets.filter(({ target }) => !isExternalTarget(target));
}

test("README local links resolve to files and markdown anchors", () => {
  const markdownAnchorCache = new Map();
  const failures = [];

  for (const { target, line } of localReadmeTargets()) {
    const { filePart, hash } = splitTarget(target);
    const resolvedPath = path.resolve(root, decodeURIComponent(filePart || "README.md"));
    const relativePath = path.relative(root, resolvedPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      failures.push(`README.md:${line} escapes repository root: ${target}`);
      continue;
    }
    if (!fs.existsSync(resolvedPath)) {
      failures.push(`README.md:${line} points to a missing path: ${target}`);
      continue;
    }
    if (!hash) continue;

    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) continue;
    if (!resolvedPath.endsWith(".md")) continue;

    if (!markdownAnchorCache.has(resolvedPath)) {
      markdownAnchorCache.set(resolvedPath, anchorsForMarkdown(resolvedPath));
    }
    const decodedHash = decodeURIComponent(hash).toLowerCase();
    assert.notEqual(decodedHash, "", `README.md:${line} has an empty anchor in ${target}`);
    if (!markdownAnchorCache.get(resolvedPath).has(decodedHash)) {
      failures.push(`README.md:${line} points to a missing markdown anchor: ${target}`);
    }
  }

  assert.deepEqual(failures, []);
});
