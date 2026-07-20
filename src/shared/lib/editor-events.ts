export interface EditorGoToDefinitionEventDetail {
  clientX: number;
  clientY: number;
}

export interface EditorFindReferencesEventDetail {
  clientX: number;
  clientY: number;
}

export interface EditorCheckDefinitionEventDetail {
  clientX: number;
  clientY: number;
  requestId: number;
}

export interface EditorDefinitionAvailabilityEventDetail {
  requestId: number;
  available: boolean;
}

export const EDITOR_GO_TO_DEFINITION_EVENT = "pragma:editor:go-to-definition";
export const EDITOR_CHECK_DEFINITION_EVENT = "pragma:editor:check-definition";
export const EDITOR_DEFINITION_AVAILABILITY_EVENT = "pragma:editor:definition-availability";
export const EDITOR_FORMAT_DOCUMENT_EVENT = "pragma:editor:format-document";
export const EDITOR_FIND_REFERENCES_EVENT = "pragma:editor:find-references";
export const EDITOR_RENAME_EVENT = "pragma:editor:rename";
export const EDITOR_CODE_ACTION_EVENT = "pragma:editor:code-action";
export const EDITOR_DOCUMENT_SYMBOLS_EVENT = "pragma:editor:document-symbols";

export function dispatchEditorGoToDefinition(detail: EditorGoToDefinitionEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_GO_TO_DEFINITION_EVENT, { detail }));
}

export function dispatchEditorFindReferences(detail: EditorFindReferencesEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_FIND_REFERENCES_EVENT, { detail }));
}

export function dispatchEditorRename(detail: EditorFindReferencesEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_RENAME_EVENT, { detail }));
}

export function dispatchEditorCodeAction(detail: EditorFindReferencesEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_CODE_ACTION_EVENT, { detail }));
}

export function dispatchEditorDocumentSymbols(): void {
  window.dispatchEvent(new CustomEvent(EDITOR_DOCUMENT_SYMBOLS_EVENT));
}

export function dispatchEditorFormatDocument(): void {
  window.dispatchEvent(new CustomEvent(EDITOR_FORMAT_DOCUMENT_EVENT));
}

export function dispatchEditorCheckDefinition(detail: EditorCheckDefinitionEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_CHECK_DEFINITION_EVENT, { detail }));
}

export function dispatchEditorDefinitionAvailability(
  detail: EditorDefinitionAvailabilityEventDetail,
): void {
  window.dispatchEvent(new CustomEvent(EDITOR_DEFINITION_AVAILABILITY_EVENT, { detail }));
}
