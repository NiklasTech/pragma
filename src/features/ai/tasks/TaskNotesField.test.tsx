import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { TaskNotesField } from "./TaskNotesField";

const noop = () => {};

describe("TaskNotesField", () => {
  it("renders existing notes as Markdown in a height-capped preview", () => {
    const notes = "## What happened?\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";
    const html = renderToStaticMarkup(
      <TaskNotesField open initialNotes={notes} notes={notes} onChange={noop} />,
    );
    expect(html).toContain("<h2");
    expect(html).toContain("<table");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("max-h-64");
  });

  it("starts in edit mode with a height-capped textarea when there are no notes", () => {
    const html = renderToStaticMarkup(
      <TaskNotesField open initialNotes="" notes="" onChange={noop} />,
    );
    expect(html).toContain("<textarea");
    expect(html).toContain("max-h-64");
  });
});
