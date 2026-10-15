export interface ToolSchema {
  [key: string]: any;
}

export interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  safety: "safe" | "sensitive";
  execute(args: any, context?: any): Promise<any>;
}

export interface ToolInfo {
  name: string;
  description: string;
  schema: ToolSchema;
  safety: "safe" | "sensitive";
}

export function registerTool(tool: Tool): Tool;
export function getTool(name: string): Tool | null;
export function listTools(): ToolInfo[];
export function executeTool(name: string, args: any, context?: any): Promise<any>;
