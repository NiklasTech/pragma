export interface BreakpointSettings {
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export type BreakpointKind = "breakpoint" | "conditional" | "logpoint";

export interface BreakpointMarkerSpec {
  line: number;
  kind: BreakpointKind;
}

export interface SourceBreakpoint extends BreakpointSettings {
  line: number;
}

export type FileBreakpointSettings = Record<number, BreakpointSettings>;
export type BreakpointSettingsMap = Record<string, FileBreakpointSettings>;

export function normalizeBreakpointSettings(
  settings: BreakpointSettings,
): BreakpointSettings | null {
  const result: BreakpointSettings = {};
  const condition = settings.condition?.trim();
  const hitCondition = settings.hitCondition?.trim();
  const logMessage = settings.logMessage?.trim();
  if (condition) result.condition = condition;
  if (hitCondition) result.hitCondition = hitCondition;
  if (logMessage) result.logMessage = logMessage;
  return Object.keys(result).length > 0 ? result : null;
}

export function breakpointKind(settings: BreakpointSettings | undefined): BreakpointKind {
  if (settings?.logMessage) return "logpoint";
  if (settings?.condition || settings?.hitCondition) return "conditional";
  return "breakpoint";
}

export function toMarkerSpecs(
  lines: number[],
  settings: FileBreakpointSettings | undefined,
): BreakpointMarkerSpec[] {
  return lines.map((line) => ({ line, kind: breakpointKind(settings?.[line]) }));
}

export function sameMarkerSpecs(a: BreakpointMarkerSpec[], b: BreakpointMarkerSpec[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((spec, index) => spec.line === b[index].line && spec.kind === b[index].kind);
}

export function toSourceBreakpoints(
  lines: number[],
  settings: FileBreakpointSettings | undefined,
): SourceBreakpoint[] {
  return lines.map((line) => ({ line, ...settings?.[line] }));
}

export function setLineSettings(
  map: BreakpointSettingsMap,
  file: string,
  line: number,
  settings: BreakpointSettings | null,
): BreakpointSettingsMap {
  const fileSettings = { ...map[file] };
  if (settings) {
    fileSettings[line] = settings;
  } else {
    delete fileSettings[line];
  }

  const next = { ...map };
  if (Object.keys(fileSettings).length === 0) {
    delete next[file];
  } else {
    next[file] = fileSettings;
  }
  return next;
}

/** Moves settings along with their breakpoints after an edit shifted the lines. */
export function remapFileSettings(
  settings: FileBreakpointSettings | undefined,
  previousLines: number[],
  nextLines: number[],
): FileBreakpointSettings {
  if (!settings) return {};
  const result: FileBreakpointSettings = {};
  if (previousLines.length === nextLines.length) {
    previousLines.forEach((line, index) => {
      const entry = settings[line];
      if (entry) result[nextLines[index]] = entry;
    });
    return result;
  }
  for (const line of nextLines) {
    const entry = settings[line];
    if (entry) result[line] = entry;
  }
  return result;
}

const SETTINGS_STORAGE_KEY = "pragma.debug.breakpointSettings";

function parseSettings(value: unknown): BreakpointSettings | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return normalizeBreakpointSettings({
    condition: typeof record.condition === "string" ? record.condition : undefined,
    hitCondition: typeof record.hitCondition === "string" ? record.hitCondition : undefined,
    logMessage: typeof record.logMessage === "string" ? record.logMessage : undefined,
  });
}

export function loadPersistedBreakpointSettings(): BreakpointSettingsMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const result: BreakpointSettingsMap = {};
    for (const [file, lines] of Object.entries(parsed)) {
      if (typeof lines !== "object" || lines === null || Array.isArray(lines)) continue;
      const fileSettings: FileBreakpointSettings = {};
      for (const [line, value] of Object.entries(lines)) {
        const lineNumber = Number(line);
        const settings = parseSettings(value);
        if (Number.isInteger(lineNumber) && lineNumber > 0 && settings) {
          fileSettings[lineNumber] = settings;
        }
      }
      if (Object.keys(fileSettings).length > 0) result[file] = fileSettings;
    }
    return result;
  } catch {
    return {};
  }
}

export function persistBreakpointSettings(settings: BreakpointSettingsMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
