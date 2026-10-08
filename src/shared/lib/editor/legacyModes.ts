import type { StreamParser } from "@codemirror/language";

export type StreamParserLoader = () => Promise<StreamParser<unknown>>;

// Shared by the editor and the chat code highlighter.
export const legacyModeLoaders: Record<string, StreamParserLoader> = {
  c: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.c as unknown as StreamParser<unknown>,
    ),
  cpp: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.cpp as unknown as StreamParser<unknown>,
    ),
  java: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.java as unknown as StreamParser<unknown>,
    ),
  csharp: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.csharp as unknown as StreamParser<unknown>,
    ),
  kotlin: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.kotlin as unknown as StreamParser<unknown>,
    ),
  scala: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.scala as unknown as StreamParser<unknown>,
    ),
  objectivec: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.objectiveC as unknown as StreamParser<unknown>,
    ),
  dart: () =>
    import("@codemirror/legacy-modes/mode/clike").then(
      (m) => m.dart as unknown as StreamParser<unknown>,
    ),
  yaml: () =>
    import("@codemirror/legacy-modes/mode/yaml").then(
      (m) => m.yaml as unknown as StreamParser<unknown>,
    ),
  toml: () =>
    import("@codemirror/legacy-modes/mode/toml").then(
      (m) => m.toml as unknown as StreamParser<unknown>,
    ),
  ruby: () =>
    import("@codemirror/legacy-modes/mode/ruby").then(
      (m) => m.ruby as unknown as StreamParser<unknown>,
    ),
  swift: () =>
    import("@codemirror/legacy-modes/mode/swift").then(
      (m) => m.swift as unknown as StreamParser<unknown>,
    ),
  lua: () =>
    import("@codemirror/legacy-modes/mode/lua").then(
      (m) => m.lua as unknown as StreamParser<unknown>,
    ),
  haskell: () =>
    import("@codemirror/legacy-modes/mode/haskell").then(
      (m) => m.haskell as unknown as StreamParser<unknown>,
    ),
  perl: () =>
    import("@codemirror/legacy-modes/mode/perl").then(
      (m) => m.perl as unknown as StreamParser<unknown>,
    ),
  r: () =>
    import("@codemirror/legacy-modes/mode/r").then((m) => m.r as unknown as StreamParser<unknown>),
  dockerfile: () =>
    import("@codemirror/legacy-modes/mode/dockerfile").then(
      (m) => m.dockerFile as unknown as StreamParser<unknown>,
    ),
  nginx: () =>
    import("@codemirror/legacy-modes/mode/nginx").then(
      (m) => m.nginx as unknown as StreamParser<unknown>,
    ),
  diff: () =>
    import("@codemirror/legacy-modes/mode/diff").then(
      (m) => m.diff as unknown as StreamParser<unknown>,
    ),
  shell: () =>
    import("@codemirror/legacy-modes/mode/shell").then(
      (m) => m.shell as unknown as StreamParser<unknown>,
    ),
  powershell: () =>
    import("@codemirror/legacy-modes/mode/powershell").then(
      (m) => m.powerShell as unknown as StreamParser<unknown>,
    ),
  makefile: () => import("./makefileMode").then((m) => m.makefile),
};
