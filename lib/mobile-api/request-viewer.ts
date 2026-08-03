import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { Viewer } from "@/lib/auth";

/**
 * When Mobile API authenticates via Bearer JWT, we run the handler inside
 * this store so existing server actions that call getViewer() still work.
 */
const storage = new AsyncLocalStorage<Viewer>();

export function runWithViewer<T>(viewer: Viewer, fn: () => Promise<T>): Promise<T> {
  return storage.run(viewer, fn);
}

export function getRequestViewer(): Viewer | undefined {
  return storage.getStore();
}
