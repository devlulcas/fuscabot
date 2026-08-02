import { zValidator as honoZValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

export const zValidator = <
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema) =>
  honoZValidator(target, schema, (result) => {
    if (!result.success) throw result.error;
  });

export const IdParamSchema = z.object({ id: z.uuid() });
