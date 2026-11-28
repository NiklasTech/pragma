import { describe, expect, it } from "vite-plus/test";

import {
  createAttentionParser,
  oscAttention,
  oscPragmaReport,
  type PragmaReport,
} from "./attentionSignals";

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

  it("hands reports of Pragma's hooks to their own listener, not as attention", () => {
    const reports: PragmaReport[] = [];
    const read = createAttentionParser((report) => reports.push(report));
    const id = "1ec907fa-5571-4205-a484-3dd5c94e9e2f";
    expect(read(`\x1b]777;notify;Pragma;session:${id}\x07`)).toEqual([]);
    expect(read("\x1b]777;notify;Pragma;limit\x07")).toEqual([]);
    expect(reports).toEqual([{ kind: "session", id }, { kind: "limit" }]);
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

  it("reads Gemini CLI's own notifications", () => {
    const attention = "Gemini CLI needs your attention;Answer requested by agent | Which file?";
    expect(oscAttention(`777;notify;${attention}`)).toBe("input");
    expect(oscAttention("9;Gemini CLI needs your attention | Action required")).toBe("input");
    expect(oscAttention("777;notify;Gemini CLI session complete;Run finished")).toBe("finished");
  });

  it("ignores other OSC sequences", () => {
    expect(oscAttention("7;file:///tmp")).toBeNull();
    expect(oscAttention("777;preexec")).toBeNull();
  });
});

describe("oscPragmaReport", () => {
  it("reads a session id and the usage limit", () => {
    expect(oscPragmaReport("777;notify;Pragma;session:abc12345-def")).toEqual({
      kind: "session",
      id: "abc12345-def",
    });
    expect(oscPragmaReport("777;notify;Pragma;limit")).toEqual({ kind: "limit" });
  });

  it("ignores other titles, odd ids and plain attention", () => {
    expect(oscPragmaReport("777;notify;Other;limit")).toBeNull();
    expect(oscPragmaReport("777;notify;Pragma;session:../../etc")).toBeNull();
    expect(oscPragmaReport("777;notify;Pragma;session:")).toBeNull();
    expect(oscPragmaReport("777;notify;Pragma;finished")).toBeNull();
    expect(oscPragmaReport("9;limit")).toBeNull();
  });

  it("does not read an unknown Pragma body as attention", () => {
    expect(oscAttention("777;notify;Pragma;session:abc12345")).toBeNull();
  });
});
