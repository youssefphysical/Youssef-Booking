import { z } from "zod";
import {
  insertClientSchema,
  insertBookingSchema,
  updateBookingSchema,
  updateProfileSchema,
  updateSettingsSchema,
  insertBlockedSlotSchema,
  insertPackageSchema,
  updatePackageSchema,
  insertInbodySchema,
  updateInbodySchema,
  insertProgressPhotoSchema,
} from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

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
    logout: { method: "POST" as const, path: "/api/auth/logout" },
    me: { method: "GET" as const, path: "/api/auth/me" },
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
    list: { method: "GET" as const, path: "/api/bookings" },
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
    delete: { method: "DELETE" as const, path: "/api/bookings/:id" },
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
    delete: { method: "DELETE" as const, path: "/api/blocked-slots/:id" },
  },

  packages: {
    list: { method: "GET" as const, path: "/api/packages" }, // ?userId=
    create: {
      method: "POST" as const,
      path: "/api/packages",
      input: insertPackageSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/packages/:id",
      input: updatePackageSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/packages/:id" },
  },

  inbody: {
    list: { method: "GET" as const, path: "/api/inbody" }, // ?userId=
    get: { method: "GET" as const, path: "/api/inbody/:id" },
    upload: { method: "POST" as const, path: "/api/inbody/upload" }, // multipart
    create: {
      method: "POST" as const,
      path: "/api/inbody",
      input: insertInbodySchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/inbody/:id",
      input: updateInbodySchema,
    },
    delete: { method: "DELETE" as const, path: "/api/inbody/:id" },
  },

  progress: {
    list: { method: "GET" as const, path: "/api/progress" }, // ?userId=
    upload: { method: "POST" as const, path: "/api/progress/upload" }, // multipart
    create: {
      method: "POST" as const,
      path: "/api/progress",
      input: insertProgressPhotoSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/progress/:id" },
  },

  uploads: {
    file: { method: "POST" as const, path: "/api/upload" }, // generic multipart - returns {url, fileName, mimeType}
  },

  dashboard: {
    stats: { method: "GET" as const, path: "/api/dashboard/stats" },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}

export type LoginInput = z.infer<typeof api.auth.login.input>;
export type RegisterInput = z.infer<typeof api.auth.register.input>;
export type CreateBookingInput = z.infer<typeof api.bookings.create.input>;
export type UpdateBookingInput = z.infer<typeof api.bookings.update.input>;
export type UpdateSettingsInput = z.infer<typeof api.settings.update.input>;
export type CreateBlockedSlotInput = z.infer<typeof api.blockedSlots.create.input>;
export type UpdateProfileInput = z.infer<typeof api.users.update.input>;
export type CreatePackageInput = z.infer<typeof api.packages.create.input>;
export type UpdatePackageInput = z.infer<typeof api.packages.update.input>;
export type CreateInbodyInput = z.infer<typeof api.inbody.create.input>;
export type UpdateInbodyInput = z.infer<typeof api.inbody.update.input>;
export type CreateProgressInput = z.infer<typeof api.progress.create.input>;
