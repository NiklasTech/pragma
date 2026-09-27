import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { CliSessionOptionsMenu } from "./CliSessionOptionsMenu";

describe("CliSessionOptionsMenu", () => {
  it("shows the model the CLI reports as current", () => {
    const html = renderToStaticMarkup(
      <CliSessionOptionsMenu
        session={{
          providerId: "xai-grok",
          providerName: "Grok Build",
          loading: false,
          error: null,
          setOption: () => {},
          options: [
            {
              id: "model",
              name: "Model",
              description: null,
              category: "model",
              currentValue: "grok-4.7",
              options: [{ value: "grok-4.7", name: "Grok 4.7", description: null }],
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Grok 4.7");
  });
});
