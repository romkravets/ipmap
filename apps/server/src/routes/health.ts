import { Router } from "express";
import { getClientCount } from "../ws/broadcaster.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    clients: getClientCount(),
    ts: new Date().toISOString(),
  });
});
