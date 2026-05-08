// =============================
// P5a — Centralized Notification Dispatcher
// =============================
// Single entry point used by every server-side trigger to deliver a
// notification to a client. Today only the in-app channel is active;
// `push` and `email` are scaffolded so future dispatchers can plug in
// without touching trigger sites.
//
// Triggers should never write to `client_notifications` directly —
// always go through `notifyUser()` so dedupe + channel routing remain
// centralised.

import { storage } from "../storage";
import type { ClientNotification, NotificationKind } from "@shared/schema";

export type NotifyChannels = {
  inApp?: boolean;
  push?: boolean;
  email?: boolean;
};

export type NotifyOptions = {
  link?: string;
  meta?: Record<string, unknown>;
  channels?: NotifyChannels;
};

/**
 * Deliver a notification to a single user. Always persists an in-app
 * row by default; push + email are persisted as flags on the same row
 * so a future dispatcher can drain them without schema churn.
 *
 * Errors never throw — notification delivery is best-effort and must
 * never block the originating action (booking, payment, etc.).
 */
export async function notifyUser(
  userId: number,
  kind: NotificationKind,
  title: string,
  body: string,
  opts: NotifyOptions = {},
): Promise<ClientNotification | null> {
  try {
    const channels: NotifyChannels = { inApp: true, push: false, email: false, ...opts.channels };
    const notif = await storage.createClientNotification({
      userId,
      kind,
      title,
      body,
      link: opts.link ?? null,
      meta: (opts.meta as any) ?? null,
      channelInApp: channels.inApp ?? true,
      channelPush: channels.push ?? false,
      channelEmail: channels.email ?? false,
    });
    // Future channels — wire dispatchers here when available.
    // if (channels.push) await pushDispatcher.send(notif);
    // if (channels.email) await emailDispatcher.send(notif);
    return notif;
  } catch (err) {
    console.error("[notifyUser] failed:", err);
    return null;
  }
}

/**
 * Convenience helper: deliver the same notification to many users.
 * Useful for system-wide announcements.
 */
export async function notifyUsers(
  userIds: number[],
  kind: NotificationKind,
  title: string,
  body: string,
  opts: NotifyOptions = {},
): Promise<void> {
  await Promise.all(userIds.map((uid) => notifyUser(uid, kind, title, body, opts)));
}
