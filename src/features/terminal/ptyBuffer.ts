import { TERMINAL_BUFFER_LIMIT } from "@/features/ai/terminal/buffer";

/** Keeps the tail of a text stream; appends are amortized O(chunk) instead of copying the whole tail. */
export class TailBuffer {
  private chunks: string[] = [];
  private length = 0;

  constructor(
    initial = "",
    private readonly limit = TERMINAL_BUFFER_LIMIT,
  ) {
    if (initial) this.append(initial);
  }

  append(chunk: string): void {
    if (!chunk) return;
    this.chunks.push(chunk);
    this.length += chunk.length;
    if (this.length > this.limit * 2) this.compact();
  }

  toString(): string {
    return this.compact();
  }

  private compact(): string {
    const joined = this.chunks.length === 1 ? this.chunks[0] : this.chunks.join("");
    const tail = joined.length > this.limit ? joined.slice(joined.length - this.limit) : joined;
    this.chunks = tail ? [tail] : [];
    this.length = tail.length;
    return tail;
  }
}
