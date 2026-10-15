import { Router, type IRouter, type RequestHandler } from "express";
import {
  AppendConversationMessageBody,
  AppendConversationMessageParams,
  AppendConversationMessageResponse,
  CreateConversationBody,
  CreateConversationResponse,
  DeleteConversationParams,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
  ListConversationsQueryParams,
  ListConversationsResponse,
  RenameConversationBody,
  RenameConversationParams,
  RenameConversationResponse,
} from "@workspace/api-zod";
import { normalizeQueryParams, getParamAsString } from "../lib/queryNormalizer";
import { sendError, sendValidationError } from "../lib/apiErrors";
import { requireAuth } from "../middlewares/requireAuth";
import * as conversationService from "../services/conversationService";

const router: IRouter = Router();
type AuthRequest = import("express").Request & { userId: string };

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

router.get("/conversations", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = ListConversationsQueryParams.safeParse(normalizeQueryParams(req.query));

  if (!parsed.success) {
    sendValidationError(req, res, parsed.error);
    return;
  }

  const conversations = await conversationService.listConversations(
    userId,
    parsed.data.search,
  );
  res.json(ListConversationsResponse.parse(conversations));
}));

router.post("/conversations", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateConversationBody.safeParse(req.body);

  if (!parsed.success) {
    sendValidationError(req, res, parsed.error);
    return;
  }

  const conversation = await conversationService.createConversation(userId, parsed.data);
  if (!conversation) {
    sendError(req, res, 500, "CONVERSATION_CREATE_FAILED", "Could not create conversation");
    return;
  }

  res.status(201).json(CreateConversationResponse.parse(conversation));
}));

router.get("/conversations/:id/messages", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = ListConversationMessagesParams.safeParse({
    id: getParamAsString(req.params.id),
  });

  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const result = await conversationService.listConversationMessages(userId, params.data.id);
  if (!result) {
    sendError(req, res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    return;
  }

  res.json(ListConversationMessagesResponse.parse(result));
}));

router.post("/conversations/:id/messages", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = AppendConversationMessageParams.safeParse({
    id: getParamAsString(req.params.id),
  });

  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const body = AppendConversationMessageBody.safeParse(req.body);
  if (!body.success) {
    sendValidationError(req, res, body.error);
    return;
  }

  const message = await conversationService.appendConversationMessage(
    userId,
    params.data.id,
    body.data,
  );
  if (!message) {
    sendError(req, res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    return;
  }

  res.status(201).json(AppendConversationMessageResponse.parse(message));
}));

router.patch("/conversations/:id", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = RenameConversationParams.safeParse({
    id: getParamAsString(req.params.id),
  });

  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const body = RenameConversationBody.safeParse(req.body);
  if (!body.success) {
    sendValidationError(req, res, body.error);
    return;
  }

  const conversation = await conversationService.renameConversation(
    userId,
    params.data.id,
    body.data.title,
  );
  if (!conversation) {
    sendError(req, res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    return;
  }

  res.json(RenameConversationResponse.parse(conversation));
}));

router.delete("/conversations/:id", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteConversationParams.safeParse({
    id: getParamAsString(req.params.id),
  });

  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const conversation = await conversationService.deleteConversation(userId, params.data.id);
  if (!conversation) {
    sendError(req, res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    return;
  }

  res.sendStatus(204);
}));

export default router;
