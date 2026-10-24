import { z } from "zod";

export const signupSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.email().toLowerCase(), phone: z.string().trim().max(30).optional(), password: z.string().min(12).max(128) });
export const loginSchema = z.object({ email: z.email().toLowerCase(), password: z.string().min(1) });
export const fieldSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/).refine(value => !/password|secret|pin/i.test(value), "Passwords and secret fields are not permitted"), label: z.string().min(1).max(120), type: z.enum(["text", "textarea", "date", "select", "radio", "checkbox", "file"]), required: z.boolean(), options: z.array(z.string()).optional(), condition: z.object({ key: z.string(), equals: z.string() }).optional() });
export const serviceConfigSchema = z.object({ fields: z.array(fieldSchema).max(60), documents: z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean() })).max(40), workflow: z.array(z.enum(["SUBMITTED","UNDER_REVIEW","DOCUMENTS_REQUIRED","APPROVED","IN_PROGRESS","AWAITING_REVIEW","COMPLETED"])).min(2).default(["SUBMITTED","UNDER_REVIEW","DOCUMENTS_REQUIRED","APPROVED","IN_PROGRESS","AWAITING_REVIEW","COMPLETED"]) });
export const serviceSchema = z.object({ title: z.string().min(3).max(150), slug: z.string().regex(/^[a-z0-9-]+$/), summary: z.string().min(10).max(300), description: z.string().min(20), published: z.boolean(), featured: z.boolean().default(false), feePkr: z.number().int().min(0).nullable(), estimate: z.string().max(100).nullable(), jurisdiction: z.string().max(100).nullable(), sourceUrl: z.url().nullable(), config: serviceConfigSchema });

export function validateApplication(config: Pick<z.infer<typeof serviceConfigSchema>, "fields" | "documents">, input: unknown) {
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const data: Record<string, string | boolean | null> = {};
  const allowed = new Set(config.fields.map(field => field.key));
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue;
    if (/password|secret|pin/i.test(key)) throw new Error("Password and secret fields are not permitted");
    if (typeof value === "string" || typeof value === "boolean" || value === null) data[key] = value;
  }
  const errors: string[] = [];
  for (const field of config.fields) {
    if (field.type === "file") continue;
    const visible = !field.condition || String(data[field.condition.key] ?? "") === field.condition.equals;
    if (!visible) continue;
    const value = data[field.key];
    if (field.required && (value === undefined || value === null || value === "" || value === false)) errors.push(`${field.label} is required`);
    if (value !== undefined && value !== null && value !== "") {
      if (field.type === "checkbox" && typeof value !== "boolean") errors.push(`${field.label} must be a checkbox value`);
      else if (field.type !== "checkbox" && typeof value !== "string") errors.push(`${field.label} must be text`);
      else if ((field.type === "select" || field.type === "radio") && field.options && !field.options.includes(String(value))) errors.push(`${field.label} has an invalid choice`);
      else if (typeof value === "string" && value.length > 2000) errors.push(`${field.label} is too long`);
    }
  }
  return { data, errors };
}
