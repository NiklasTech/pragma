import { Compartment, StateEffect } from "@codemirror/state";

const languageCompartment = new Compartment();
const ghostTextCompartment = new Compartment();
const fontStyleCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const indentUnitCompartment = new Compartment();
const blameCompartment = new Compartment();
const gitChangeCompartment = new Compartment();
const whitespaceCompartment = new Compartment();
const rulersCompartment = new Compartment();
const indentGuidesCompartment = new Compartment();
const bracketColorsCompartment = new Compartment();
const cursorCompartment = new Compartment();
const lineHeightCompartment = new Compartment();
const ligaturesCompartment = new Compartment();
const overviewCompartment = new Compartment();
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
  gitChangeCompartment,
  whitespaceCompartment,
  rulersCompartment,
  indentGuidesCompartment,
  bracketColorsCompartment,
  cursorCompartment,
  lineHeightCompartment,
  ligaturesCompartment,
  overviewCompartment,
  externalUpdate,
};
