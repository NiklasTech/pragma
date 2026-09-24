import { Compartment, StateEffect } from "@codemirror/state";

const languageCompartment = new Compartment();
const ghostTextCompartment = new Compartment();
const fontStyleCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const indentUnitCompartment = new Compartment();
const blameCompartment = new Compartment();
const externalUpdate = StateEffect.define<void>();

export {
  languageCompartment,
  ghostTextCompartment,
  fontStyleCompartment,
  lineNumbersCompartment,
  wordWrapCompartment,
  tabSizeCompartment,
  indentUnitCompartment,
  blameCompartment,
  externalUpdate,
};
