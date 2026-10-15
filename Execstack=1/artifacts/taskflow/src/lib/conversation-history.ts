import {
  appendConversationMessage,
  createConversation,
} from "@workspace/api-client-react";

export type ConversationSource = "agent_lab" | "jarvis";
export type ConversationRole = "user" | "assistant" | "system";

const MAX_SAVED_MESSAGE_LENGTH = 19_000;
const MAX_TITLE_LENGTH = 200;

export function makeRunTitle(goal: string): string {
  return goal.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH) || "Untitled run";
}

export async function createRunConversation(
  goal: string,
  source: ConversationSource,
): Promise<number> {
  const conversation = await createConversation({
    title: makeRunTitle(goal),
    source,
  });

  return conversation.id;
}

export async function appendRunHistoryMessage(
  conversationId: number,
  role: ConversationRole,
  content: string,
): Promise<void> {
  const nonEmptyContent = content.trim() || "No output was recorded for this run.";
  const marker = "\n\n[Transcript truncated to fit the saved-history limit.]";
  const savedContent = nonEmptyContent.length > MAX_SAVED_MESSAGE_LENGTH
    ? `${nonEmptyContent.slice(0, MAX_SAVED_MESSAGE_LENGTH - marker.length)}${marker}`
    : nonEmptyContent;

  await appendConversationMessage(conversationId, {
    role,
    content: savedContent,
  });
}

export function formatAgentRunTranscript(run: {
  status: string;
  logs: Array<{ agent: string; type: string; content: string }>;
}): string {
  const entries = run.logs.map(
    (entry) => `[${entry.agent} · ${entry.type}]\n${entry.content}`,
  );

  return [`Agent Lab run status: ${run.status}`, ...entries].join("\n\n");
}
