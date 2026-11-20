/*
 * Author: Jamius Siam
 * Since: 20/11/2026
 */
import fs from "fs";
import os from "os";
import path from "path";

type LoggedCommand = "search" | "fetch" | "ask";

interface CommandResult {
  command: LoggedCommand;
  // What the command ran on, e.g. `"react vite"` or a URL.
  target: string;
  pluginName: string;
  // `performance.now()` value taken just before the plugin call.
  startedAt: number;
  success: boolean;
}

// Whether command results are logged. Defaults to true when `SIBYL_LOGGING`
// is absent; otherwise it must equal "true".
export function isLoggingEnabled(): boolean {
  const raw = process.env.SIBYL_LOGGING;
  return raw === undefined ? true : raw === "true";
}

// Appends one line to `~/.config/sibyl/sibyl.log`, e.g.
// `2026-11-20T21:11:09.000+06:00 Completed search for "react" using builtin-exa-search in 1.42 seconds.`
export function logCommandResult(result: CommandResult): void {
  if (!isLoggingEnabled()) {
    return;
  }

  const { command, target, pluginName, startedAt, success } = result;
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(2);
  const message = success
    ? `Completed ${command} for ${target} using ${pluginName} in ${seconds} seconds.`
    : `Failed ${command} for ${target} using ${pluginName} after ${seconds} seconds.`;

  const logFile = path.join(os.homedir(), ".config", "sibyl", "sibyl.log");

  try {
    fs.appendFileSync(logFile, `${formatLocalTimestamp(new Date())} ${message}\n`);
  } catch {
    // Logging must never break a command, so write errors are ignored.
  }
}

// ISO 8601 in the PC's local time zone with its UTC offset, e.g. `2026-11-20T21:11:09.000+06:00`.
// `toISOString()` is not used because it always gives UTC.
function formatLocalTimestamp(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
  );
}
