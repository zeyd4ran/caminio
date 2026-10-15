import { z } from "zod/v4";
import { conversations } from "./tables";
export { conversations };
export declare const insertConversationSchema: z.ZodObject<{
    title: z.ZodString;
    source: z.ZodOptional<z.ZodString>;
}, {
    out: {};
    in: {};
}>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
//# sourceMappingURL=conversations.d.ts.map