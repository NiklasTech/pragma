import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentSignInCard } from "./AgentSignIn";

const grok = [{ id: "grok.com", name: "Grok", description: "Sign in with Grok" }];

describe("AgentSignInCard", () => {
  it("offers the CLI's sign-in methods", () => {
    const html = renderToStaticMarkup(
      <AgentSignInCard
        providerName="Grok Build"
        methods={grok}
        pending={false}
        error={null}
        onSignIn={() => {}}
      />,
    );
    expect(html).toContain("Grok Build needs a sign-in.");
    expect(html).toContain("Sign in with Grok");
  });

  it("waits for the browser while the sign-in runs", () => {
    const html = renderToStaticMarkup(
      <AgentSignInCard
        providerName="Grok Build"
        methods={grok}
        pending
        error={null}
        onSignIn={() => {}}
      />,
    );
    expect(html).toContain("Finish the sign-in in your browser");
    expect(html).not.toContain("Sign in with Grok");
  });

  it("shows nothing when the CLI is signed in", () => {
    expect(
      renderToStaticMarkup(
        <AgentSignInCard
          providerName="Grok Build"
          methods={[]}
          pending={false}
          error={null}
          onSignIn={() => {}}
        />,
      ),
    ).toBe("");
  });
});
