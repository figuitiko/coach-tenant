import { z } from "zod";

const httpUrl = z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"));
const schema = z.object({
  DATABASE_URL: z.string().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://")),
  BETTER_AUTH_URL: httpUrl,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

const productionSchema = schema.extend({
  BETTER_AUTH_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(3).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

export function validateServerEnvironment(environment: Record<string, string | undefined>) {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error("Invalid server environment configuration.");
  return parsed.data;
}

export function validateProductionEnvironment(environment: Record<string, string | undefined>) {
  const parsed = productionSchema.safeParse(environment);
  if (!parsed.success) throw new Error("Invalid production environment configuration.");
  return parsed.data;
}
