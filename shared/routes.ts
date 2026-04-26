import { z } from "zod";
import {
  insertClientSchema,
  insertBookingSchema,
  updateBookingSchema,
  updateProfileSchema,
  updateSettingsSchema,
  insertBlockedSlotSchema,
} from "./schema";

// =============================
// SHARED ERROR SCHEMAS
// =============================
export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

// =============================
// API CONTRACT
// =============================
export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/auth/login",
      input: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    },
    register: {
      method: "POST" as const,
      path: "/api/auth/register",
      input: insertClientSchema,
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout",
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me",
    },
  },

  users: {
    list: { method: "GET" as const, path: "/api/users" },
    get: { method: "GET" as const, path: "/api/users/:id" },
    update: {
      method: "PATCH" as const,
      path: "/api/users/:id",
      input: updateProfileSchema,
    },
  },

  bookings: {
    list: {
      method: "GET" as const,
      path: "/api/bookings",
      // optional query: ?userId=&from=&includeUser=true
    },
    create: {
      method: "POST" as const,
      path: "/api/bookings",
      input: insertBookingSchema.extend({
        acceptedPolicy: z.literal(true, {
          errorMap: () => ({ message: "You must accept the cancellation policy" }),
        }),
      }),
    },
    update: {
      method: "PATCH" as const,
      path: "/api/bookings/:id",
      input: updateBookingSchema.extend({ override: z.boolean().optional() }),
    },
    cancel: {
      method: "POST" as const,
      path: "/api/bookings/:id/cancel",
      input: z.object({}).optional(),
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/bookings/:id",
    },
  },

  settings: {
    get: { method: "GET" as const, path: "/api/settings" },
    update: {
      method: "PATCH" as const,
      path: "/api/settings",
      input: updateSettingsSchema,
    },
  },

  blockedSlots: {
    list: { method: "GET" as const, path: "/api/blocked-slots" },
    create: {
      method: "POST" as const,
      path: "/api/blocked-slots",
      input: insertBlockedSlotSchema,
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/blocked-slots/:id",
    },
  },

  dashboard: {
    stats: { method: "GET" as const, path: "/api/dashboard/stats" },
  },
};

// =============================
// HELPER
// =============================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}

// =============================
// DERIVED TYPES
// =============================
export type LoginInput = z.infer<typeof api.auth.login.input>;
export type RegisterInput = z.infer<typeof api.auth.register.input>;
export type CreateBookingInput = z.infer<typeof api.bookings.create.input>;
export type UpdateBookingInput = z.infer<typeof api.bookings.update.input>;
export type UpdateSettingsInput = z.infer<typeof api.settings.update.input>;
export type CreateBlockedSlotInput = z.infer<typeof api.blockedSlots.create.input>;
export type UpdateProfileInput = z.infer<typeof api.users.update.input>;
