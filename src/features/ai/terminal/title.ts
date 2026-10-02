export function terminalSessionTitle(name: string, date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${name} ${hours}:${minutes}`;
}

/// True for the default title `terminalSessionTitle` gives, with the `#n` suffix of a batch launch.
export function isGeneratedTerminalTitle(title: string, name: string): boolean {
  if (!title.startsWith(`${name} `)) return false;
  return /^\d{2}:\d{2}( #\d+)?$/.test(title.slice(name.length + 1));
}
