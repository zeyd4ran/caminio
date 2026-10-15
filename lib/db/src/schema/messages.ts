import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { messages } from "./tables";

export { messages };

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
