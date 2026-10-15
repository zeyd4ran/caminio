import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteConversation,
  listConversationMessages,
  listConversations,
  renameConversation,
} from "@workspace/api-client-react";
import { Clock3, Loader2, MessageSquareText, Pencil, Search, Trash2 } from "lucide-react";
import Layout from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const searchTerm = search.trim();

  const conversationsQuery = useQuery({
    queryKey: ["conversation-history", searchTerm],
    queryFn: () => listConversations(searchTerm ? { search: searchTerm } : undefined),
  });
  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === selectedId);

  useEffect(() => {
    if (selectedId === null && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    } else if (selectedId !== null && !conversations.some((item) => item.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    setRenameTitle(selectedConversation?.title ?? "");
    setIsRenaming(false);
  }, [selectedConversation?.id, selectedConversation?.title]);

  const messagesQuery = useQuery({
    queryKey: ["conversation-history-messages", selectedId],
    queryFn: () => {
      if (selectedId === null) throw new Error("Choose a conversation first.");
      return listConversationMessages(selectedId);
    },
    enabled: selectedId !== null,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      renameConversation(id, { title }),
    onSuccess: async () => {
      setIsRenaming(false);
      await queryClient.invalidateQueries({ queryKey: ["conversation-history"] });
      if (selectedId !== null) {
        await queryClient.invalidateQueries({
          queryKey: ["conversation-history-messages", selectedId],
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteConversation(id),
    onSuccess: async (_data, deletedId) => {
      setDeleteId(null);
      if (selectedId === deletedId) setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["conversation-history"] });
    },
  });

  const isDeletingSelected = deleteId !== null && deleteMutation.isPending;
  const mutationError = renameMutation.error ?? deleteMutation.error;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Conversation history</h1>
        <p className="mt-1 text-muted-foreground">
          Search, review, rename, or remove saved Agent Lab and Jarvis runs.
        </p>
      </div>

      {mutationError && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(mutationError)}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <Card className="min-h-[420px]">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4" />
              Saved runs
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles and messages"
                aria-label="Search conversation history"
                maxLength={200}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {conversationsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved runs…
              </div>
            ) : conversationsQuery.isError ? (
              <p role="alert" className="py-6 text-sm text-destructive">
                {getErrorMessage(conversationsQuery.error)}
              </p>
            ) : conversations.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <MessageSquareText className="mx-auto mb-3 h-8 w-8 opacity-50" aria-hidden="true" />
                {searchTerm ? "No saved runs match that search." : "Your saved runs will appear here."}
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
                    selectedId === conversation.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-medium">{conversation.title}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {conversation.source === "jarvis" ? "Jarvis" : "Agent Lab"}
                    </Badge>
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {conversation.messageCount} {conversation.messageCount === 1 ? "message" : "messages"} ·{" "}
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[420px]">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const title = renameTitle.trim();
                          if (title) renameMutation.mutate({ id: selectedConversation.id, title });
                        }}
                      >
                        <Input
                          autoFocus
                          value={renameTitle}
                          onChange={(event) => setRenameTitle(event.target.value)}
                          maxLength={200}
                          aria-label="Conversation title"
                        />
                        <Button type="submit" size="sm" disabled={!renameTitle.trim() || renameMutation.isPending}>
                          {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setIsRenaming(false)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <CardTitle className="break-words">{selectedConversation.title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedConversation.source === "jarvis" ? "Jarvis" : "Agent Lab"} · Updated{" "}
                          {new Date(selectedConversation.updatedAt).toLocaleString()}
                        </p>
                      </>
                    )}
                  </div>
                  {!isRenaming && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRenaming(true)}
                        aria-label="Rename conversation"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(selectedConversation.id)}
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading messages…
                  </div>
                ) : messagesQuery.isError ? (
                  <p role="alert" className="py-8 text-sm text-destructive">
                    {getErrorMessage(messagesQuery.error)}
                  </p>
                ) : messagesQuery.data?.messages.length ? (
                  messagesQuery.data.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`rounded-lg border p-4 ${
                        message.role === "user" ? "ml-6 bg-muted/40" : "mr-6 bg-card"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold capitalize">{message.role}</span>
                        <time className="text-xs text-muted-foreground">
                          {new Date(message.createdAt).toLocaleString()}
                        </time>
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                        {message.content}
                      </pre>
                    </article>
                  ))
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    This conversation has no saved messages.
                  </p>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquareText className="mb-3 h-9 w-9 opacity-50" aria-hidden="true" />
              <p>{conversations.length ? "Select a saved run to view its messages." : "No conversation selected."}</p>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the saved run and its messages.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)} disabled={isDeletingSelected}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteId === null || deleteMutation.isPending}
              onClick={() => {
                if (deleteId !== null) deleteMutation.mutate(deleteId);
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
