import { DEFAULT_TIMEOUT_MS, enforceSafety, withTimeout } from "./safetyPolicy.js";

const tools = new Map();

function registerTool(tool) {
  if (!tool || typeof tool !== "object") throw new Error("Tool must be an object");
  if (!tool.name || typeof tool.name !== "string") throw new Error("Tool name is required");
  if (!tool.description || typeof tool.description !== "string") throw new Error(`Tool "${tool.name}" needs a description`);
  if (!tool.schema || typeof tool.schema !== "object") throw new Error(`Tool "${tool.name}" needs a schema`);
  if (tool.safety !== "safe" && tool.safety !== "sensitive") throw new Error(`Tool "${tool.name}" has invalid safety level`);
  if (typeof tool.execute !== "function") throw new Error(`Tool "${tool.name}" needs an execute function`);
  tools.set(tool.name, tool);
  return tool;
}

function getTool(name) {
  return tools.get(name) ?? null;
}

function listTools() {
  return Array.from(tools.values()).map(({ name, description, schema, safety }) => ({
    name,
    description,
    schema,
    safety,
  }));
}

async function executeTool(name, args, context = {}) {
  const tool = getTool(name);
  enforceSafety(tool, args, context);
  const timeoutMs = Number(context.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return withTimeout(() => tool.execute(args, context), timeoutMs);
}

export { registerTool, getTool, listTools, executeTool };