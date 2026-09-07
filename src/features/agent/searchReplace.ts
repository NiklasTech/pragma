export interface ApplySearchReplaceResult {
  content: string;
}

export function applySearchReplace(
  content: string,
  oldString: string,
  replacement: string,
  replaceAll: boolean,
): ApplySearchReplaceResult {
  if (oldString.length === 0) {
    throw new Error("old_string must not be empty");
  }

  const firstIndex = content.indexOf(oldString);
  if (firstIndex === -1) {
    throw new Error("old_string not found in file");
  }

  if (!replaceAll) {
    const secondIndex = content.indexOf(oldString, firstIndex + oldString.length);
    if (secondIndex !== -1) {
      throw new Error(
        "old_string matches multiple locations; pass replace_all: true or use a more specific old_string",
      );
    }
    return {
      content:
        content.slice(0, firstIndex) + replacement + content.slice(firstIndex + oldString.length),
    };
  }

  return { content: content.split(oldString).join(replacement) };
}
