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
  insertFoodSchema,
  updateFoodSchema,
  insertMealSchema,
  updateMealSchema,
  insertNutritionPlanSchema,
  updateNutritionPlanSchema,
  insertSupplementSchema,
  updateSupplementSchema,
  insertSupplementStackSchema,
  updateSupplementStackSchema,
  insertClientSupplementSchema,
  updateClientSupplementSchema,
  applyStackToClientSchema,
  insertBodyMetricSchema,
  updateBodyMetricSchema,
  insertWeeklyCheckinSchema,
  updateWeeklyCheckinSchema,
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

  foods: {
    // ?search=&category=&supplement=true|false&activeOnly=true&limit=50&offset=0
    // Returns { items: Food[], total: number }
    list: { method: "GET" as const, path: "/api/foods" },
    get: { method: "GET" as const, path: "/api/foods/:id" },
    create: {
      method: "POST" as const,
      path: "/api/foods",
      input: insertFoodSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/foods/:id",
      input: updateFoodSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/foods/:id" },
    duplicate: { method: "POST" as const, path: "/api/foods/:id/duplicate" },
  },

  meals: {
    // ?search=&category=&templateOnly=true&activeOnly=true&limit=50&offset=0
    // Returns { items: Meal[], total: number } (cached totals included).
    list: { method: "GET" as const, path: "/api/meals" },
    // Returns MealWithItems (items sorted by sort_order asc).
    get: { method: "GET" as const, path: "/api/meals/:id" },
    create: {
      method: "POST" as const,
      path: "/api/meals",
      input: insertMealSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/meals/:id",
      input: updateMealSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/meals/:id" },
    duplicate: { method: "POST" as const, path: "/api/meals/:id/duplicate" },
  },

  nutritionPlans: {
    // Admin: ?userId=&status=&limit=&offset=
    list: { method: "GET" as const, path: "/api/nutrition-plans" },
    // Admin: full plan (including private notes).
    get: { method: "GET" as const, path: "/api/nutrition-plans/:id" },
    create: {
      method: "POST" as const,
      path: "/api/nutrition-plans",
      input: insertNutritionPlanSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/nutrition-plans/:id",
      input: updateNutritionPlanSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/nutrition-plans/:id" },
    duplicate: { method: "POST" as const, path: "/api/nutrition-plans/:id/duplicate" },
    // Client-facing: returns the requesting user's active plan with
    // private notes stripped. 404 if no active plan exists.
    mine: { method: "GET" as const, path: "/api/nutrition-plans/me/active" },
  },

  supplements: {
    // Library (admin)
    list: { method: "GET" as const, path: "/api/supplements" },
    get: { method: "GET" as const, path: "/api/supplements/:id" },
    create: {
      method: "POST" as const,
      path: "/api/supplements",
      input: insertSupplementSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/supplements/:id",
      input: updateSupplementSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/supplements/:id" },
  },

  supplementStacks: {
    list: { method: "GET" as const, path: "/api/supplement-stacks" },
    get: { method: "GET" as const, path: "/api/supplement-stacks/:id" },
    create: {
      method: "POST" as const,
      path: "/api/supplement-stacks",
      input: insertSupplementStackSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/supplement-stacks/:id",
      input: updateSupplementStackSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/supplement-stacks/:id" },
  },

  clientSupplements: {
    // Admin: ?userId=
    list: { method: "GET" as const, path: "/api/client-supplements" },
    create: {
      method: "POST" as const,
      path: "/api/client-supplements",
      input: insertClientSupplementSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/client-supplements/:id",
      input: updateClientSupplementSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/client-supplements/:id" },
    applyStack: {
      method: "POST" as const,
      path: "/api/client-supplements/apply-stack",
      input: applyStackToClientSchema,
    },
    // Client-facing: signed-in user's own active supplements.
    mine: { method: "GET" as const, path: "/api/client-supplements/me" },
  },

  bodyMetrics: {
    // Admin: ?userId=. Client (non-admin): list returns own; /me also OK.
    list: { method: "GET" as const, path: "/api/body-metrics" },
    mine: { method: "GET" as const, path: "/api/body-metrics/me" },
    create: {
      method: "POST" as const,
      path: "/api/body-metrics",
      input: insertBodyMetricSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/body-metrics/:id",
      input: updateBodyMetricSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/body-metrics/:id" },
  },

  weeklyCheckins: {
    // Admin: ?userId=. Client (non-admin) always reads own.
    list: { method: "GET" as const, path: "/api/weekly-checkins" },
    mine: { method: "GET" as const, path: "/api/weekly-checkins/me" },
    pending: { method: "GET" as const, path: "/api/weekly-checkins/pending" }, // admin queue
    create: {
      method: "POST" as const,
      path: "/api/weekly-checkins",
      input: insertWeeklyCheckinSchema,
    },
    update: {
      method: "PATCH" as const,
      path: "/api/weekly-checkins/:id",
      input: updateWeeklyCheckinSchema,
    },
    delete: { method: "DELETE" as const, path: "/api/weekly-checkins/:id" },
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
export type CreateFoodInput = z.infer<typeof api.foods.create.input>;
export type UpdateFoodInput = z.infer<typeof api.foods.update.input>;
export type CreateMealInput = z.infer<typeof api.meals.create.input>;
export type UpdateMealInput = z.infer<typeof api.meals.update.input>;
export type CreateNutritionPlanInput = z.infer<typeof api.nutritionPlans.create.input>;
export type UpdateNutritionPlanInput = z.infer<typeof api.nutritionPlans.update.input>;
export type UpdatePackageInput = z.infer<typeof api.packages.update.input>;
export type CreatePackageTemplateInput = z.infer<typeof api.packageTemplates.create.input>;
export type UpdatePackageTemplateInput = z.infer<typeof api.packageTemplates.update.input>;
export type CreateInbodyInput = z.infer<typeof api.inbody.create.input>;
export type UpdateInbodyInput = z.infer<typeof api.inbody.update.input>;
export type CreateProgressInput = z.infer<typeof api.progress.create.input>;
