import { describe, expect, it } from "vite-plus/test";

import { createAttentionParser, oscAttention } from "./attentionSignals";

describe("createAttentionParser", () => {
  it("reports a bell as a request for input", () => {
    expect(createAttentionParser()("done\x07")).toEqual(["input"]);
  });

  it("reads OSC 9 notifications and classifies their text", () => {
    const read = createAttentionParser();
    expect(read("\x1b]9;Agent turn complete\x07")).toEqual(["finished"]);
    expect(read("\x1b]9;Approval requested: rm -rf build\x1b\\")).toEqual(["input"]);
  });

  it("reads the OSC 777 notifications of Pragma's hooks", () => {
    const read = createAttentionParser();
    expect(read("\x1b]777;notify;Pragma;finished\x07")).toEqual(["finished"]);
    expect(read("\x1b]777;notify;Pragma;input\x07")).toEqual(["input"]);
  });

  it("joins a sequence split across chunks", () => {
    const read = createAttentionParser();
    expect(read("text\x1b]9;Claude is wai")).toEqual([]);
    expect(read("ting for your input")).toEqual([]);
    expect(read("\x07more")).toEqual(["input"]);
  });

  it("does not read the terminator of an OSC sequence as a bell", () => {
    const read = createAttentionParser();
    expect(read("\x1b]0;window title\x07\x1b]133;A\x07")).toEqual([]);
  });

  it("ignores bells inside DCS strings and regular escape sequences", () => {
    const read = createAttentionParser();
    expect(read("\x1bPq#0\x07\x1b[31mred\x1b[0m")).toEqual([]);
  });
});

describe("oscAttention", () => {
  it("ignores ConEmu progress reports", () => {
    expect(oscAttention("9;4;1;50")).toBeNull();
  });

  it("classifies foreign OSC 777 notifications by title and body", () => {
    expect(oscAttention("777;notify;Claude Code;Claude needs your permission")).toBe("input");
    expect(oscAttention("777;notify;Gemini;Task complete")).toBe("finished");
  });

  it("ignores other OSC sequences", () => {
    expect(oscAttention("7;file:///tmp")).toBeNull();
    expect(oscAttention("777;preexec")).toBeNull();
  });
});
