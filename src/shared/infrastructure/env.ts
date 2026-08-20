import { z } from "zod";

const httpUrl = z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"));
const schema = z.object({
  DATABASE_URL: z.string().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://")),
  BETTER_AUTH_URL: httpUrl,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  S3_ENDPOINT: httpUrl.optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(3).optional(),
  S3_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(10_485_760).default(5_242_880),
});

export function validateServerEnvironment(environment: Record<string, string | undefined>) {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error("Invalid server environment configuration.");
  return parsed.data;
}
