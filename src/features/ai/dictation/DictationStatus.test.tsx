import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { DictationStatus, isMicrophoneDenied } from "./DictationStatus";
import { VOICE_INPUT_DENIED, VOICE_INPUT_NO_SPEECH } from "./webSpeech";

describe("DictationStatus", () => {
  it("links a blocked microphone to its system setting", () => {
    const html = renderToStaticMarkup(<DictationStatus status={VOICE_INPUT_DENIED} />);
    expect(html).toContain(VOICE_INPUT_DENIED);
    expect(html).toContain("Open System Settings");
    expect(isMicrophoneDenied(VOICE_INPUT_DENIED)).toBe(true);
  });

  it("shows other messages alone and nothing without one", () => {
    expect(renderToStaticMarkup(<DictationStatus status={VOICE_INPUT_NO_SPEECH} />)).not.toContain(
      "Open System Settings",
    );
    expect(renderToStaticMarkup(<DictationStatus status={null} />)).toBe("");
  });
});
