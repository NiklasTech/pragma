export function terminalSessionTitle(name: string, date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${name} ${hours}:${minutes}`;
}
