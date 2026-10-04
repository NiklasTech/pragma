export function safePtyInvoke<T>(promise: Promise<T>) {
  void promise.catch((err) => {
    // Ignore races where the PTY was destroyed between scheduling and sending.
    if (String(err).includes("PTY not found")) return;
  });
}
