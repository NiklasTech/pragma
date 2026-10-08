import { simpleMode } from "@codemirror/legacy-modes/mode/simple-mode";

const variableReference = {
  regex: /\$(?:\([^)]*\)|\{[^}]*\}|[@<^+?*%$])/,
  token: "variable-2",
};

// @codemirror/legacy-modes has no Makefile mode, so this covers the common syntax.
export const makefile = simpleMode({
  start: [
    { regex: /#.*/, token: "comment" },
    {
      regex:
        /\s*-?(?:ifeq|ifneq|ifdef|ifndef|else|endif|include|sinclude|define|endef|export|unexport|override|vpath)\b/,
      token: "keyword",
      sol: true,
    },
    { regex: /[A-Za-z_][\w.-]*(?=\s*(?:::=|[:+?!]?=))/, token: "variable", sol: true },
    { regex: /[^\s:=#][^:=#]*(?=:(?!=))/, token: "def", sol: true },
    variableReference,
    { regex: /"(?:[^\\"]|\\.)*"?/, token: "string" },
    { regex: /'(?:[^\\']|\\.)*'?/, token: "string" },
    { regex: /::=|[:+?!]?=/, token: "operator" },
  ],
  languageData: {
    commentTokens: { line: "#" },
  },
});
