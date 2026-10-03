/// Host-to-extension calls: the host posts `{ kind: "call", id, method, params }`
/// and the extension answers with `{ kind: "result", id, ok, result | error }`.

interface PendingCall {
  extensionId: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type CallPoster = (extensionId: string, message: unknown) => boolean;

const pending = new Map<number, PendingCall>();
let nextId = 1;
let poster: CallPoster = () => false;

export function setCallPoster(post: CallPoster): void {
  poster = post;
}

export function callExtension(
  extensionId: string,
  method: string,
  params: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) {
        reject(new Error(`Extension ${extensionId} did not answer ${method} in time`));
      }
    }, timeoutMs);
    pending.set(id, { extensionId, resolve, reject, timer });
    if (!poster(extensionId, { kind: "call", id, method, params })) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error(`Extension ${extensionId} is not running`));
    }
  });
}

/// Settles a pending call from an extension's `result` message; other messages are ignored.
export function handleCallResult(extensionId: string, data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  const message = data as Record<string, unknown>;
  if (message.kind !== "result" || typeof message.id !== "number") return false;
  const call = pending.get(message.id);
  // An extension can only settle the calls that were sent to it.
  if (!call || call.extensionId !== extensionId) return true;
  pending.delete(message.id);
  clearTimeout(call.timer);
  if (message.ok === true) {
    call.resolve(message.result);
  } else {
    call.reject(new Error(typeof message.error === "string" ? message.error : "Call failed"));
  }
  return true;
}

export function rejectCallsFor(extensionId: string): void {
  for (const [id, call] of pending) {
    if (call.extensionId !== extensionId) continue;
    pending.delete(id);
    clearTimeout(call.timer);
    call.reject(new Error(`Extension ${extensionId} stopped`));
  }
}
