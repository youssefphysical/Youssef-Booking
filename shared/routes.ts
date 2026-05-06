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
  insertPackageTemplateSchema,
  updatePackageTemplateSchema,
  insertInbodySchema,
  updateInbodySchema,
  insertProgressPhotoSchema,
  REGISTRATION_CONSENT_ITEMS,
} from "./schema";

export const registrationConsentSchema = z.object({
  info_accurate: z.literal(true, {
    errorMap: () => ({ message: "Please confirm your information is accurate" }),
  }),
  cancellation_policy: z.literal(true, {
    errorMap: () => ({ message: "Please accept the cancellation policy" }),
  }),
  terms_conditions: z.literal(true, {
    errorMap: () => ({ message: "Please accept the terms & conditions" }),
  }),
  medical_fitness: z.literal(true, {
    errorMap: () => ({ message: "Please confirm your medical/fitness statement" }),
  }),
  data_storage: z.literal(true, {
    errorMap: () => ({ message: "Please accept the data storage consent" }),
  }),
});

export type RegistrationConsents = z.infer<typeof registrationConsentSchema>;
export { REGISTRATION_CONSENT_ITEMS };

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
      input: insertClientSchema.extend({
        consents: registrationConsentSchema,
      }),
    },
    logout: { method: "POST" as const, path: "/api/auth/logout" },
    me: { method: "GET" as const, path: "/api/auth/me" },
    forgotPassword: {
      method: "POST" as const,
      path: "/api/auth/forgot-password",
      input: z.object({ email: z.string().email("Enter a valid email") }),
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
      input: z
        .object({
          useProtectedCancel: z.boolean().optional(),
          useEmergencyCancel: z.boolean().optional(),
        })
        .optional(),
    },
    sameDayAdjust: {
      method: "POST" as const,
      path: "/api/bookings/:id/same-day-adjust",
      input: z.object({ newTimeSlot: z.string().regex(/^\d{2}:\d{2}$/) }),
    },
    delete: { method: "DELETE" as const, path: "/api/bookings/:id" },
    resetEmergencyCancel: {
      method: "POST" as const,
      path: "/api/users/:id/reset-emergency-cancel",
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

  packageTemplates: {
    list: { method: "GET" as const, path: "/api/package-templates" }, // ?activeOnly=true
    create: {
      method: "POST" as const,
      path: "/api/package-templates",
      input: insertPackageTemplateSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/package-templates/:id",
      input: updatePackageTemplateSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/package-templates/:id" },
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

  consent: {
    list: { method: "GET" as const, path: "/api/consent" }, // ?userId=
    create: {
      method: "POST" as const,
      path: "/api/consent",
      input: z.object({
        consentType: z.enum(["registration", "booking", "inbody", "progress"]),
        acceptedItems: z.array(z.string()).min(1),
        policyVersion: z.string().optional(),
      }),
    },
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
export type CreatePackageTemplateInput = z.infer<typeof api.packageTemplates.create.input>;
export type UpdatePackageTemplateInput = z.infer<typeof api.packageTemplates.update.input>;
export type CreateInbodyInput = z.infer<typeof api.inbody.create.input>;
export type UpdateInbodyInput = z.infer<typeof api.inbody.update.input>;
export type CreateProgressInput = z.infer<typeof api.progress.create.input>;
