import { z } from "zod/v4";
import { tasksTable } from "./tables";
export declare const insertTaskSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    userId: z.ZodString;
}, {
    out: {};
    in: {};
}>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
//# sourceMappingURL=tasks.d.ts.map