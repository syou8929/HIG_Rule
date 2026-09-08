import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(new URL("../scripts/inspect-source.ts", import.meta.url));
const tsxLoader = import.meta.resolve("tsx");

// Every case fails argument validation, before reading a source file or starting a browser.
// These tests deliberately do not use a valid inspection request or make network calls.
function rejects(args: string[], message: RegExp, cwd = repository): void {
  const result = spawnSync(process.execPath, ["--import", tsxLoader, script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, args.join(" "));
  assert.equal(result.signal, null, args.join(" "));
  assert.equal(result.status, 1, args.join(" "));
  assert.equal(result.stdout, "", "invalid requests must not emit inspection output");
  assert.match(result.stderr, message, args.join(" "));
}

test("source inspection CLI rejects missing and invalid page slugs before browser work", () => {
  rejects([], /Provide a single valid --slug/);
  rejects(["--output", "evidence.json"], /Provide a single valid --slug/);
  for (const slug of ["../playing-audio", "/playing-audio", "playing_audio", "Playing-audio", "playing--audio", "playing-audio-", "playing audio", " "]) {
    rejects(["--slug", slug], /Provide a single valid --slug/);
  }
});

test("source inspection CLI rejects evidence paths that could overwrite canonical or project files", () => {
  // This valid-looking slug has no source fixture, so a regression still cannot start a browser.
  const slug = `inspection-cli-no-source-${process.pid}`;
  for (const output of [
    "src/sources/apple-hig/pages/playing-audio.json",
    "src/rules/patterns/playing-audio.json",
    "src/config/source-review.json",
    "README.json",
    "docs/audits/../../src/config/source-review.json",
  ]) {
    rejects(["--slug", slug, "--output", output], /Evidence output/i);
  }
});

test("source inspection CLI refuses existing and symlink-redirected evidence paths", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hig-inspection-cli-test-"));
  const auditDirectory = join(fixture, "docs", "audits");
  const protectedDirectory = join(fixture, "src", "config");
  mkdirSync(auditDirectory, { recursive: true });
  mkdirSync(protectedDirectory, { recursive: true });
  const existing = join(auditDirectory, "existing.json");
  const sentinel = "{\"fixture\":\"must not be overwritten\"}\n";
  writeFileSync(existing, sentinel, { flag: "wx" });
  symlinkSync(protectedDirectory, join(auditDirectory, "redirect"), "dir");
  try {
    const slug = "inspection-cli-no-source-fixture";
    rejects(["--slug", slug, "--output", existing], /Evidence output/i, fixture);
    rejects(["--slug", slug, "--output", join(auditDirectory, "redirect", "review.json")], /Evidence output/i, fixture);
    assert.equal(readFileSync(existing, "utf8"), sentinel);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("source inspection CLI rejects missing values, unsupported options, and duplicate flags", () => {
  for (const args of [
    ["--slug"],
    ["--slug", ""],
    ["--slug", "--output"],
    ["--slug", "playing-audio", "--output"],
    ["--slug", "playing-audio", "--output", ""],
    ["--unknown", "playing-audio"],
    ["--help"],
    ["playing-audio"],
    ["--slug=playing-audio"],
    ["--slug", "playing-audio", "--slug", "buttons"],
    ["--slug", "playing-audio", "--output", "one.json", "--output", "two.json"],
  ]) {
    rejects(args, /Usage: tsx scripts\/inspect-source\.ts/);
  }
});

test("source inspection CLI rejects non-JSON evidence paths before reading the source", () => {
  for (const output of ["evidence.txt", "evidence", "evidence.JSON", "evidence.json/", " "]) {
    rejects(["--slug", "playing-audio", "--output", output], /Evidence output must use a \.json path/);
  }
});
