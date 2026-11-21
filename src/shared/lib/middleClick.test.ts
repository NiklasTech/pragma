import { describe, expect, it, vi } from "vite-plus/test";

import { middleClickToClose } from "./middleClick";

function mouse(button: number) {
  return { button, preventDefault: vi.fn(), stopPropagation: vi.fn() };
}

describe("middleClickToClose", () => {
  it("closes on a middle click and leaves other buttons alone", () => {
    const close = vi.fn();
    const handlers = middleClickToClose(close);

    handlers.onMouseUp(mouse(0));
    handlers.onMouseUp(mouse(2));
    expect(close).not.toHaveBeenCalled();

    const middle = mouse(1);
    handlers.onMouseDown(middle);
    handlers.onMouseUp(middle);
    expect(close).toHaveBeenCalledTimes(1);
    expect(middle.preventDefault).toHaveBeenCalled();
  });
});
