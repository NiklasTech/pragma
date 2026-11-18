import { createContext, useContext } from "react";

export interface FieldLabel {
  labelId: string;
  descriptionId?: string;
}

/** The visible label of the row a control sits in, for controls that have no name of their own. */
export const FieldLabelContext = createContext<FieldLabel | null>(null);

interface NamingProps {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/** `aria-labelledby` and `aria-describedby` from the surrounding row, unless the control is named. */
export function useFieldLabel(props: NamingProps): NamingProps {
  const field = useContext(FieldLabelContext);
  if (!field || props["aria-label"] || props["aria-labelledby"]) return {};
  return {
    "aria-labelledby": field.labelId,
    "aria-describedby": props["aria-describedby"] ?? field.descriptionId,
  };
}
