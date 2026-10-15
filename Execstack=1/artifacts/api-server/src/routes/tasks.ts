import { Router, type IRouter, type RequestHandler } from "express";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  GetTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
  ToggleTaskCompleteParams,
  ToggleTaskCompleteResponse,
  ListTasksResponse,
  GetTaskStatsResponse,
} from "@workspace/api-zod";
import { normalizeQueryParams } from "../lib/queryNormalizer";
import { requireAuth } from "../middlewares/requireAuth";
import { sendError, sendValidationError } from "../lib/apiErrors";
import * as taskService from "../services/taskService";

const router: IRouter = Router();

type AuthRequest = import("express").Request & { userId: string };

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

router.get("/tasks", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const queryParsed = ListTasksQueryParams.safeParse(normalizeQueryParams(req.query));
  if (!queryParsed.success) {
    sendValidationError(req, res, queryParsed.error);
    return;
  }

  const tasks = await taskService.listTasks(userId, queryParsed.data);

  res.json(ListTasksResponse.parse(taskService.toApiTasks(tasks)));
}));

router.get("/tasks/stats", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const stats = await taskService.getTaskStats(userId);

  res.json(
    GetTaskStatsResponse.parse(stats)
  );
}));

router.post("/tasks", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(req, res, parsed.error);
    return;
  }

  const task = await taskService.createTask(userId, parsed.data);

  res.status(201).json(GetTaskResponse.parse(taskService.toApiTask(task)));
}));

router.get("/tasks/:id", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTaskParams.safeParse({ id: rawId });
  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const task = await taskService.getTask(userId, params.data.id);

  if (!task) {
    sendError(req, res, 404, "TASK_NOT_FOUND", "Task not found");
    return;
  }

  res.json(GetTaskResponse.parse(taskService.toApiTask(task)));
}));

router.patch("/tasks/:id", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTaskParams.safeParse({ id: rawId });
  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(req, res, parsed.error);
    return;
  }

  const task = await taskService.updateTask(userId, params.data.id, parsed.data);

  if (!task) {
    sendError(req, res, 404, "TASK_NOT_FOUND", "Task not found");
    return;
  }

  res.json(UpdateTaskResponse.parse(taskService.toApiTask(task)));
}));

router.delete("/tasks/:id", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTaskParams.safeParse({ id: rawId });
  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const task = await taskService.deleteTask(userId, params.data.id);

  if (!task) {
    sendError(req, res, 404, "TASK_NOT_FOUND", "Task not found");
    return;
  }

  res.sendStatus(204);
}));

router.patch("/tasks/:id/toggle", requireAuth, asyncRoute(async (req, res): Promise<void> => {
  const { userId } = req as AuthRequest;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleTaskCompleteParams.safeParse({ id: rawId });
  if (!params.success) {
    sendValidationError(req, res, params.error);
    return;
  }

  const updated = await taskService.toggleTaskComplete(userId, params.data.id);
  if (!updated) {
    sendError(req, res, 404, "TASK_NOT_FOUND", "Task not found");
    return;
  }

  res.json(ToggleTaskCompleteResponse.parse(taskService.toApiTask(updated)));
}));

export default router;
