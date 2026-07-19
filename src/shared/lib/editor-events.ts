export interface EditorGoToDefinitionEventDetail {
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

export function dispatchEditorGoToDefinition(detail: EditorGoToDefinitionEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_GO_TO_DEFINITION_EVENT, { detail }));
}

export function dispatchEditorCheckDefinition(detail: EditorCheckDefinitionEventDetail): void {
  window.dispatchEvent(new CustomEvent(EDITOR_CHECK_DEFINITION_EVENT, { detail }));
}

export function dispatchEditorDefinitionAvailability(
  detail: EditorDefinitionAvailabilityEventDetail,
): void {
  window.dispatchEvent(new CustomEvent(EDITOR_DEFINITION_AVAILABILITY_EVENT, { detail }));
}
