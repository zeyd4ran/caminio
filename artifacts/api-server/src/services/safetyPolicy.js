class ToolSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolSafetyError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

function getSchemaProperties(schema) {
  if (!schema || typeof schema !== "object") return {};
  if (schema.properties && typeof schema.properties === "object") return schema.properties;
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => !["type", "required", "additionalProperties"].includes(key)),
  );
}

function getSchemaRequired(schema, properties) {
  if (Array.isArray(schema?.required)) return schema.required;
  return Object.keys(properties);
}

function getExpectedType(definition) {
  if (typeof definition === "string") return definition;
  if (definition && typeof definition === "object" && typeof definition.type === "string") return definition.type;
  return null;
}

function validateValue(name, value, definition) {
  const expected = getExpectedType(definition);
  if (!expected) return;
  if (expected === "array") {
    if (!Array.isArray(value)) throw new ToolSafetyError(`Invalid tool argument "${name}": expected array`);
    return;
  }
  if (expected === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ToolSafetyError(`Invalid tool argument "${name}": expected object`);
    }
    return;
  }
  if (typeof value !== expected) {
    throw new ToolSafetyError(`Invalid tool argument "${name}": expected ${expected}`);
  }
}

function validateSchema(tool, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new ToolSafetyError(`Tool "${tool.name}" requires an object argument payload`);
  }

  const properties = getSchemaProperties(tool.schema);
  const allowed = new Set(Object.keys(properties));
  const required = getSchemaRequired(tool.schema, properties);

  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) {
      throw new ToolSafetyError(`Unknown argument "${key}" for tool "${tool.name}"`);
    }
  }

  for (const key of required) {
    if (!(key in args)) {
      throw new ToolSafetyError(`Missing required argument "${key}" for tool "${tool.name}"`);
    }
    validateValue(key, args[key], properties[key]);
  }

  for (const [key, definition] of Object.entries(properties)) {
    if (key in args) validateValue(key, args[key], definition);
  }
}

function enforceSafety(tool, args, context = {}) {
  if (!tool) throw new ToolSafetyError("Unknown tool");
  if (tool.safety === "sensitive" && context.confirmed !== true) {
    throw new ToolSafetyError(`Tool "${tool.name}" requires explicit confirmation`);
  }
  validateSchema(tool, args);
}

async function withTimeout(promiseFactory, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timeout;
  try {
    return await Promise.race([
      promiseFactory(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new ToolSafetyError(`Tool execution exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export { ToolSafetyError, enforceSafety, withTimeout, DEFAULT_TIMEOUT_MS };