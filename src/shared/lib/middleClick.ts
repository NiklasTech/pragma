import type { MouseEvent } from "react";

type ButtonEvent = Pick<MouseEvent, "button" | "preventDefault" | "stopPropagation">;

const MIDDLE_BUTTON = 1;

/// Closes on a middle click. WebKit does not send auxclick for it, so this listens to the
/// button itself; pressing it also keeps Linux from pasting or Windows from autoscrolling.
export function middleClickToClose(onClose: () => void) {
  return {
    onMouseDown: (event: ButtonEvent) => {
      if (event.button === MIDDLE_BUTTON) event.preventDefault();
    },
    onMouseUp: (event: ButtonEvent) => {
      if (event.button !== MIDDLE_BUTTON) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    },
  };
}
