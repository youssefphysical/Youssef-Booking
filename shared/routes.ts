import { z } from 'zod';
import { 
  insertUserSchema, 
  insertPackageSchema, 
  insertBookingSchema, 
  insertPaymentSchema,
  insertNutritionPlanSchema,
  insertIntakeLogSchema,
  users,
  packages,
  bookings,
  payments,
  nutritionPlans,
  intakeLogs
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // Auth
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(), // Returns User (minus password handled in route)
        401: errorSchemas.unauthorized,
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    }
  },

  // Users
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/users/:id',
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Packages
  packages: {
    list: {
      method: 'GET' as const,
      path: '/api/packages',
      responses: {
        200: z.array(z.custom<typeof packages.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/packages',
      input: insertPackageSchema,
      responses: {
        201: z.custom<typeof packages.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: { // Admin only
      method: 'PATCH' as const,
      path: '/api/packages/:id',
      input: insertPackageSchema.partial(),
      responses: {
        200: z.custom<typeof packages.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Bookings
  bookings: {
    list: {
      method: 'GET' as const,
      path: '/api/bookings', // Can filter by userId query param
      input: z.object({
        userId: z.string().optional(),
        date: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/bookings',
      input: insertBookingSchema,
      responses: {
        201: z.custom<typeof bookings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: { // Cancel/Complete/No-show
      method: 'PATCH' as const,
      path: '/api/bookings/:id',
      input: insertBookingSchema.partial().extend({ status: z.string().optional() }),
      responses: {
        200: z.custom<typeof bookings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Payments
  payments: {
    list: {
      method: 'GET' as const,
      path: '/api/payments',
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/payments',
      input: insertPaymentSchema,
      responses: {
        201: z.custom<typeof payments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: { // Approve/Reject
      method: 'PATCH' as const,
      path: '/api/payments/:id',
      input: z.object({ status: z.enum(['approved', 'rejected']), reviewedBy: z.number() }),
      responses: {
        200: z.custom<typeof payments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Nutrition
  nutrition: {
    plans: {
      list: {
        method: 'GET' as const,
        path: '/api/nutrition/plans',
        input: z.object({ userId: z.string().optional() }).optional(),
        responses: {
          200: z.array(z.custom<typeof nutritionPlans.$inferSelect>()),
        },
      },
      create: { // Manual or AI generated
        method: 'POST' as const,
        path: '/api/nutrition/plans',
        input: insertNutritionPlanSchema,
        responses: {
          201: z.custom<typeof nutritionPlans.$inferSelect>(),
        },
      },
    },
    logs: {
      list: {
        method: 'GET' as const,
        path: '/api/nutrition/logs',
        input: z.object({ userId: z.string().optional(), date: z.string().optional() }).optional(),
        responses: {
          200: z.array(z.custom<typeof intakeLogs.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/nutrition/logs',
        input: insertIntakeLogSchema,
        responses: {
          201: z.custom<typeof intakeLogs.$inferSelect>(),
        },
      },
    }
  },

  // Admin Dashboard
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats',
      responses: {
        200: z.object({
          activeClients: z.number(),
          totalRevenue: z.number(),
          pendingPayments: z.number(),
          upcomingSessions: z.number(),
        }),
      },
    },
  },
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPES
// ============================================
export type LoginInput = z.infer<typeof api.auth.login.input>;
export type RegisterInput = z.infer<typeof api.auth.register.input>;
export type BookingInput = z.infer<typeof api.bookings.create.input>;
export type PaymentInput = z.infer<typeof api.payments.create.input>;
