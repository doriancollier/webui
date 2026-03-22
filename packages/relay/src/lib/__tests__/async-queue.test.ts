import { describe, it, expect } from 'vitest';
import { AsyncQueue } from '../async-queue.js';

/** Collect all values yielded by an AsyncIterable into an array. */
async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const value of iterable) {
    results.push(value);
  }
  return results;
}

describe('AsyncQueue', () => {
  it('yields pushed values in FIFO order', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.push(3);
    queue.complete();

    expect(await collect(queue)).toEqual([1, 2, 3]);
  });

  it('yields values pushed after iteration starts', async () => {
    const queue = new AsyncQueue<string>();

    const collectPromise = collect(queue);

    // Push values asynchronously after iteration has already begun awaiting
    await Promise.resolve();
    queue.push('a');
    await Promise.resolve();
    queue.push('b');
    await Promise.resolve();
    queue.complete();

    expect(await collectPromise).toEqual(['a', 'b']);
  });

  it('completes immediately when complete() called before iteration', async () => {
    const queue = new AsyncQueue<number>();
    queue.complete();

    expect(await collect(queue)).toEqual([]);
  });

  it('ignores pushes after complete()', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.complete();
    // These should be silently dropped
    queue.push(2);
    queue.push(3);

    expect(await collect(queue)).toEqual([1]);
  });

  it('throws the error from fail() during iteration', async () => {
    const queue = new AsyncQueue<string>();
    const boom = new Error('stream failed');

    const collectPromise = collect(queue);

    await Promise.resolve();
    queue.push('before');
    await Promise.resolve();
    queue.fail(boom);

    await expect(collectPromise).rejects.toThrow('stream failed');
  });

  it('throws immediately when fail() called before iteration starts', async () => {
    const queue = new AsyncQueue<string>();
    queue.fail(new Error('early failure'));

    await expect(collect(queue)).rejects.toThrow('early failure');
  });

  it('ignores pushes after fail()', async () => {
    const queue = new AsyncQueue<number>();
    queue.fail(new Error('oops'));
    // These should be silently dropped without throwing synchronously
    queue.push(1);
    queue.push(2);

    await expect(collect(queue)).rejects.toThrow('oops');
  });

  it('handles interleaved push and consume', async () => {
    const queue = new AsyncQueue<number>();
    const results: number[] = [];

    const consumer = (async () => {
      for await (const value of queue) {
        results.push(value);
      }
    })();

    // Interleave pushes with microtask yields so consumer is awaiting
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      queue.push(i);
    }
    await Promise.resolve();
    queue.complete();

    await consumer;
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('preserves the exact error instance thrown by fail()', async () => {
    const queue = new AsyncQueue<never>();
    const err = new TypeError('type mismatch');
    queue.fail(err);

    let caught: unknown;
    try {
      await collect(queue);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(err);
  });
});
