/*
 * Author: Jamius Siam
 * Since: 20/11/2026
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { isLoggingEnabled, logCommandResult } from "./logger.ts";

// Local time with a UTC offset, e.g. `2026-11-20T21:11:09.000+06:00 `.
const LINE_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2} /;

let home: string;
let sibylDir: string;
let logFile: string;
let envSnapshot: string | undefined;

beforeEach(() => {
  // Fresh fake home per test; only homedir() is mocked, real fs is used.
  home = fs.mkdtempSync(path.join(os.tmpdir(), "sibyl-logger-test-"));
  sibylDir = path.join(home, ".config", "sibyl");
  logFile = path.join(sibylDir, "sibyl.log");
  fs.mkdirSync(sibylDir, { recursive: true });

  vi.spyOn(os, "homedir").mockReturnValue(home);
  envSnapshot = process.env.SIBYL_LOGGING;
  delete process.env.SIBYL_LOGGING;
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(home, { recursive: true, force: true });

  if (envSnapshot === undefined) {
    delete process.env.SIBYL_LOGGING;
  } else {
    process.env.SIBYL_LOGGING = envSnapshot;
  }
});

function readLines(): string[] {
  return fs.readFileSync(logFile, "utf8").trimEnd().split("\n");
}

describe("isLoggingEnabled", () => {
  it("defaults to true when SIBYL_LOGGING is absent", () => {
    expect(isLoggingEnabled()).toBe(true);
  });

  it.each([
    ["true", true],
    ["false", false],
    ["TRUE", false],
    ["", false],
  ])("returns %s -> %s", (value, expected) => {
    process.env.SIBYL_LOGGING = value;

    expect(isLoggingEnabled()).toBe(expected);
  });
});

describe("logCommandResult", () => {
  it("appends a timestamped success line", () => {
    vi.spyOn(performance, "now").mockReturnValue(2420);

    logCommandResult({
      command: "search",
      target: '"react vite"',
      pluginName: "builtin-exa-search",
      startedAt: 1000,
      success: true,
    });

    const [line] = readLines();
    expect(line).toMatch(LINE_PREFIX);
    expect(line?.replace(LINE_PREFIX, "")).toBe(
      'Completed search for "react vite" using builtin-exa-search in 1.42 seconds.',
    );
  });

  it("timestamps the line with the current local time and UTC offset", () => {
    const before = Date.now();

    logCommandResult({
      command: "search",
      target: '"react"',
      pluginName: "builtin-exa-search",
      startedAt: performance.now(),
      success: true,
    });

    const after = Date.now();
    const timestamp = readLines()[0]?.split(" ")[0] ?? "";
    const parsed = new Date(timestamp).getTime();

    // Parsing the local time with its offset must give back the same instant.
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("appends a failure line", () => {
    vi.spyOn(performance, "now").mockReturnValue(1310);

    logCommandResult({
      command: "fetch",
      target: "https://vite.dev",
      pluginName: "builtin-crawl4ai-fetch",
      startedAt: 1000,
      success: false,
    });

    expect(readLines()[0]?.replace(LINE_PREFIX, "")).toBe(
      "Failed fetch for https://vite.dev using builtin-crawl4ai-fetch after 0.31 seconds.",
    );
  });

  it("appends to existing lines", () => {
    fs.writeFileSync(logFile, "earlier line\n");

    logCommandResult({
      command: "ask",
      target: '"q" on https://vite.dev',
      pluginName: "builtin-ai-ask",
      startedAt: performance.now(),
      success: true,
    });

    const lines = readLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("earlier line");
    expect(lines[1]).toContain('Completed ask for "q" on https://vite.dev using builtin-ai-ask in');
  });

  it("writes nothing when SIBYL_LOGGING is not true", () => {
    process.env.SIBYL_LOGGING = "false";

    logCommandResult({
      command: "search",
      target: '"react"',
      pluginName: "builtin-exa-search",
      startedAt: performance.now(),
      success: true,
    });

    expect(fs.existsSync(logFile)).toBe(false);
  });

  it("does not throw when the log file cannot be written", () => {
    fs.rmSync(sibylDir, { recursive: true, force: true });

    expect(() =>
      logCommandResult({
        command: "search",
        target: '"react"',
        pluginName: "builtin-exa-search",
        startedAt: performance.now(),
        success: true,
      }),
    ).not.toThrow();
    expect(fs.existsSync(logFile)).toBe(false);
  });
});
