import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { InheritSelect } from "./fields";

function render(value: boolean | undefined, personal: boolean): string {
  return renderToStaticMarkup(
    <InheritSelect label="Format on save" value={value} personal={personal} onChange={() => {}} />,
  );
}

describe("InheritSelect", () => {
  it("names the personal value when the project leaves it open", () => {
    expect(render(undefined, true)).toContain("Use my setting (On)");
    expect(render(undefined, false)).toContain("Use my setting (Off)");
  });

  it("shows the project value when the project sets one", () => {
    const html = render(false, true);
    expect(html).toContain("Off");
    expect(html).not.toContain("Use my setting");
  });
});
