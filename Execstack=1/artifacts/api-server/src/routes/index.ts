import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import agentsRouter from "./agents";
import jarvisRouter from "./jarvis";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tasksRouter);
router.use(agentsRouter);
router.use(jarvisRouter);
router.use(conversationsRouter);

export default router;
