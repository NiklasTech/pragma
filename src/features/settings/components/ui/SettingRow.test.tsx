import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { Input } from "@/shared/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";

import { SettingRow } from "./SettingRow";

function attribute(html: string, element: RegExp, name: string): string | undefined {
  const tag = element.exec(html)?.[0] ?? "";
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
}

describe("SettingRow", () => {
  it("names its control by the label and describes it by the description", () => {
    const html = renderToStaticMarkup(
      <SettingRow
        label="Word wrap"
        description="Wrap long lines"
        control={<Switch checked={false} />}
      />,
    );
    const labelledBy = attribute(html, /<[a-z]+[^>]*data-slot="switch"[^>]*>/, "aria-labelledby");
    const describedBy = attribute(html, /<[a-z]+[^>]*data-slot="switch"[^>]*>/, "aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(attribute(html, new RegExp(`<span[^>]*id="${labelledBy}"[^>]*>Word wrap`), "id")).toBe(
      labelledBy,
    );
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>Wrap long lines`));
  });

  it("keeps a name the control already has", () => {
    const html = renderToStaticMarkup(
      <SettingRow label="Word wrap" control={<Switch aria-label="Wrap" checked={false} />} />,
    );
    const tag = /<[a-z]+[^>]*data-slot="switch"[^>]*>/.exec(html)?.[0] ?? "";
    expect(tag).toContain('aria-label="Wrap"');
    expect(tag).not.toContain("aria-labelledby");
  });

  it("names a select trigger and a control inside a wrapper", () => {
    const html = renderToStaticMarkup(
      <>
        <SettingRow
          label="Auto Save"
          control={
            <Select value="off">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </Select>
          }
        />
        <SettingRow
          label="Base URL"
          control={
            <div>
              <Input value="" readOnly />
            </div>
          }
        />
      </>,
    );
    const trigger = /<[a-z]+[^>]*data-slot="select-trigger"[^>]*>/.exec(html)?.[0] ?? "";
    const input = /<input[^>]*data-slot="input"[^>]*>/.exec(html)?.[0] ?? "";
    const triggerLabel = /aria-labelledby="([^"]*)"/.exec(trigger)?.[1];
    const inputLabel = /aria-labelledby="([^"]*)"/.exec(input)?.[1];
    expect(html).toMatch(new RegExp(`id="${triggerLabel}"[^>]*>Auto Save`));
    expect(html).toMatch(new RegExp(`id="${inputLabel}"[^>]*>Base URL`));
  });
});
