/**
 * In-memory SSE connection registry.
 * Maps userId → Set of ReadableStream controllers.
 * Multiple tabs = multiple controllers per userId.
 *
 * NOTE: Works for single-server deployments (local dev, single Vercel region).
 * For multi-instance production, replace with Redis Pub/Sub:
 *   publisher.publish(`notifications:${userId}`, JSON.stringify(payload))
 *   subscriber.subscribe(`notifications:${userId}`, handler)
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

const connections = new Map<string, Set<SSEController>>();

export function registerConnection(userId: string, controller: SSEController): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

export function unregisterConnection(userId: string, controller: SSEController): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) connections.delete(userId);
}

/**
 * Push a notification payload to all active SSE connections for a userId.
 * Safe to call when user is offline — no connections = no-op.
 * The notification is already persisted in DB before this is called.
 */
export function pushToUser(userId: string, payload: Record<string, unknown>): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;

  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = new TextEncoder().encode(data);

  for (const controller of set) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Connection already closed — clean up
      set.delete(controller);
    }
  }
}

/** Total active SSE connections across all users (for health monitoring) */
export function getActiveConnectionCount(): number {
  let count = 0;
  for (const set of connections.values()) count += set.size;
  return count;
}
