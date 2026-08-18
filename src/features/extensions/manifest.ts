import {
  EXTENSION_FORMAT,
  type ExtensionCommandContribution,
  type ExtensionManifest,
  type ExtensionPanelContribution,
} from "./types";

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: ExtensionManifest;
}

const ID_REGEX = /^[a-z0-9-]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCommands(
  value: unknown,
  errors: string[],
): ExtensionCommandContribution[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push("contributes.commands: must be an array");
    return undefined;
  }
  const commands: ExtensionCommandContribution[] = [];
  value.forEach((entry, index) => {
    const path = `contributes.commands[${index}]`;
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") {
      errors.push(`${path}: requires string "id" and "title"`);
      return;
    }
    const command: ExtensionCommandContribution = { id: entry.id, title: entry.title };
    if (entry.category !== undefined) {
      if (typeof entry.category !== "string") {
        errors.push(`${path}.category: must be a string`);
        return;
      }
      command.category = entry.category;
    }
    commands.push(command);
  });
  return commands;
}

function parsePanels(value: unknown, errors: string[]): ExtensionPanelContribution[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push("contributes.panels: must be an array");
    return undefined;
  }
  const panels: ExtensionPanelContribution[] = [];
  value.forEach((entry, index) => {
    const path = `contributes.panels[${index}]`;
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") {
      errors.push(`${path}: requires string "id" and "title"`);
      return;
    }
    const panel: ExtensionPanelContribution = { id: entry.id, title: entry.title };
    if (entry.icon !== undefined) {
      if (typeof entry.icon !== "string") {
        errors.push(`${path}.icon: must be a string`);
        return;
      }
      panel.icon = entry.icon;
    }
    if (entry.html !== undefined) {
      if (typeof entry.html !== "string") {
        errors.push(`${path}.html: must be a string`);
        return;
      }
      panel.html = entry.html;
    }
    panels.push(panel);
  });
  return panels;
}

function parseThemes(value: unknown, errors: string[]): unknown[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push("contributes.themes: must be an array");
    return undefined;
  }
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`contributes.themes[${index}]: must be an object`);
      return;
    }
    if ("path" in entry && typeof entry.path !== "string") {
      errors.push(`contributes.themes[${index}].path: must be a string`);
    }
  });
  return value;
}

export function validateExtensionManifest(input: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["manifest: must be an object"] };
  }

  if (input.format !== EXTENSION_FORMAT) {
    errors.push(`format: must be "${EXTENSION_FORMAT}"`);
  }

  if (typeof input.id !== "string" || !ID_REGEX.test(input.id)) {
    errors.push("id: must be 1-64 lowercase letters, numbers or hyphens");
  }

  if (typeof input.name !== "string" || input.name.length === 0) {
    errors.push("name: must be a non-empty string");
  }

  if (typeof input.version !== "string" || input.version.length === 0) {
    errors.push("version: must be a non-empty string");
  }

  if (input.description !== undefined && typeof input.description !== "string") {
    errors.push("description: must be a string");
  }

  let main = "main.js";
  if (input.main !== undefined) {
    if (typeof input.main !== "string" || input.main.length === 0) {
      errors.push("main: must be a non-empty string");
    } else if (input.main.startsWith("/") || input.main.includes("..")) {
      errors.push('main: must be a relative path without ".."');
    } else {
      main = input.main;
    }
  }

  const manifest: ExtensionManifest = {
    format: EXTENSION_FORMAT,
    id: typeof input.id === "string" ? input.id : "",
    name: typeof input.name === "string" ? input.name : "",
    version: typeof input.version === "string" ? input.version : "",
    main,
  };
  if (typeof input.description === "string") {
    manifest.description = input.description;
  }

  if (input.contributes !== undefined) {
    if (!isRecord(input.contributes)) {
      errors.push("contributes: must be an object");
    } else {
      const commands = parseCommands(input.contributes.commands, errors);
      const themes = parseThemes(input.contributes.themes, errors);
      const panels = parsePanels(input.contributes.panels, errors);
      manifest.contributes = {};
      if (commands && commands.length > 0) manifest.contributes.commands = commands;
      if (themes && themes.length > 0) manifest.contributes.themes = themes;
      if (panels && panels.length > 0) manifest.contributes.panels = panels;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, errors, manifest };
}
