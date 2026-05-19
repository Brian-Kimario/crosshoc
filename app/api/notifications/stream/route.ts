import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { registerConnection, unregisterConnection } from "@/lib/notification-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // SSE requires Node.js runtime (not Edge)

/**
 * GET /api/notifications/stream
 * Long-lived SSE connection. Sends:
 *   - Immediate "init" event with current unread count
 *   - "notification" events pushed by lib/notify.ts in real time
 *   - ": heartbeat" comment every 25s to keep the connection alive
 */
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  await dbConnect();

  const unreadCount = await Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    read: false,
  });

  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      registerConnection(userId, controller);

      // Send initial state immediately
      const init = `data: ${JSON.stringify({ type: "init", unreadCount })}\n\n`;
      controller.enqueue(new TextEncoder().encode(init));

      // Heartbeat every 25s — browsers/proxies close idle SSE after ~30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unregisterConnection(userId, controller);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
