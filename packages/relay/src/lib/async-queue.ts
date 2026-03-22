/**
 * Push-pull async iterable queue.
 *
 * Producers push values; consumers await them via `for await...of`.
 * Completes when `complete()` is called; throws when `fail()` is called.
 * Zero dependencies, ~45 lines.
 *
 * @module relay/lib/async-queue
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolve: ((value: IteratorResult<T>) => void) | null = null;
  private done = false;
  private error: Error | null = null;

  /** Push a value to the queue. Ignored if already completed or failed. */
  push(value: T): void {
    if (this.done) return;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  /** Signal that no more values will be pushed. */
  complete(): void {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as unknown as T, done: true });
    }
  }

  /** Signal an error — the consumer's `for await` will throw. */
  fail(err: Error): void {
    this.done = true;
    this.error = err;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as unknown as T, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
        continue;
      }
      if (this.error) throw this.error;
      if (this.done) return;
      const result = await new Promise<IteratorResult<T>>((resolve) => {
        this.resolve = resolve;
      });
      if (result.done) {
        if (this.error) throw this.error;
        return;
      }
      yield result.value;
    }
  }
}
