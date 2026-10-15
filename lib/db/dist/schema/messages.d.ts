import { z } from "zod/v4";
import { messages } from "./tables";
export { messages };
export declare const insertMessageSchema: z.ZodObject<{
    conversationId: z.ZodInt;
    role: z.ZodString;
    content: z.ZodString;
}, {
    out: {};
    in: {};
}>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
//# sourceMappingURL=messages.d.ts.map