import { and, asc, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";

export type ConversationSource = "agent_lab" | "jarvis";
export type ConversationMessageRole = "user" | "assistant" | "system";

export interface CreateConversationInput {
  title: string;
  source: ConversationSource;
}

export interface AppendConversationMessageInput {
  role: ConversationMessageRole;
  content: string;
}

function toApiMessage(message: typeof messages.$inferSelect) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

function toApiConversation(
  conversation: typeof conversations.$inferSelect,
  messageCount: number,
) {
  return {
    id: conversation.id,
    title: conversation.title,
    source: conversation.source as ConversationSource,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount,
  };
}

export async function listConversations(userId: string, search?: string) {
  const conditions = [eq(conversations.userId, userId)];
  const term = search?.trim();

  if (term) {
    const pattern = `%${term}%`;
    conditions.push(
      or(
        ilike(conversations.title, pattern),
        exists(
          db
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, conversations.id),
                ilike(messages.content, pattern),
              ),
            ),
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      conversation: conversations,
      messageCount: sql<number>`(
        select count(*)::int
        from ${messages} as conversation_messages
        where conversation_messages.conversation_id = ${conversations.id}
      )`,
    })
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt));

  return rows.map(({ conversation, messageCount }) =>
    toApiConversation(conversation, Number(messageCount)),
  );
}

export async function createConversation(
  userId: string,
  input: CreateConversationInput,
) {
  const [conversation] = await db
    .insert(conversations)
    .values({ ...input, userId })
    .returning();

  return conversation ? toApiConversation(conversation, 0) : null;
}

export async function getConversation(userId: string, conversationId: number) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    )
    .limit(1);

  return conversation ?? null;
}

export async function listConversationMessages(
  userId: string,
  conversationId: number,
) {
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) return null;

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  return {
    conversation: toApiConversation(conversation, rows.length),
    messages: rows.map(toApiMessage),
  };
}

export async function appendConversationMessage(
  userId: string,
  conversationId: number,
  input: AppendConversationMessageInput,
) {
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) return null;

  const [message] = await db
    .insert(messages)
    .values({ conversationId, ...input })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    );

  return message ? toApiMessage(message) : null;
}

export async function renameConversation(
  userId: string,
  conversationId: number,
  title: string,
) {
  const [conversation] = await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    )
    .returning();

  if (!conversation) return null;

  const [{ messageCount }] = await db
    .select({ messageCount: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  return toApiConversation(conversation, Number(messageCount ?? 0));
}

export async function deleteConversation(
  userId: string,
  conversationId: number,
) {
  const [conversation] = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    )
    .returning({ id: conversations.id });

  return conversation ?? null;
}
