/** What `endlessBody` hands over at a time. */
export const ENDLESS_CHUNK = 1024;

/**
 * A request body that never ends, a kilobyte at a time, counting what was taken from it (P10-04).
 * Code that reads it to the end would never finish, so that such a regression fails its test
 * rather than hanging it, the body errors once `failAfter` bytes have been taken. It also records
 * whether the reader cancelled it.
 */
export function endlessBody(failAfter: number) {
  let taken = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (taken >= failAfter) {
        controller.error(new Error(`read ${taken} bytes of a body that never ends`));
        return;
      }
      taken += ENDLESS_CHUNK;
      controller.enqueue(new Uint8Array(ENDLESS_CHUNK).fill(0x20));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, taken: () => taken, cancelled: () => cancelled };
}
