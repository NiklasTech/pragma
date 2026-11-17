import { createContext } from "react";

import type { Category } from "./settings-categories";

/** The settings area a row is shown in, so it can find its setting by label. */
export const SettingsAreaContext = createContext<Category | null>(null);
