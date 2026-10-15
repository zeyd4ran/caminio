import type { ToolCall } from "./types.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1";
const GENERATE_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;

export class OllamaClient {
  private url: string;
  public readonly model: string;

  constructor(
    url: string = DEFAULT_OLLAMA_URL,
    model: string = DEFAULT_MODEL,
  ) {
    this.url = url.replace(/\/$/, "");
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(userPrompt: string, systemPrompt: string): Promise<string> {
    const combined = `${systemPrompt}\n\n${userPrompt}`;

    const res = await fetch(`${this.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: combined,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_predict: 512,
        },
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { response: string; done: boolean };
    return data.response;
  }

  parseToolCall(raw: string): ToolCall {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(
        `No JSON object in Ollama response: ${raw.slice(0, 200)}`,
      );
    }

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON from Ollama: ${match[0].slice(0, 200)}`);
    }

    if (typeof obj["tool"] !== "string" || obj["tool"].length === 0) {
      throw new Error(
        `Missing or empty "tool" field in: ${JSON.stringify(obj)}`,
      );
    }

    return {
      tool: obj["tool"] as ToolCall["tool"],
      input:
        obj["input"] !== undefined && obj["input"] !== null
          ? String(obj["input"])
          : "",
      reason: typeof obj["reason"] === "string" ? obj["reason"] : "",
    };
  }
}
