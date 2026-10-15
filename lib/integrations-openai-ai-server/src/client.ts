import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL is not set.\n" +
    "  On Replit: add the OpenAI integration in your Replit project.\n" +
    "  Locally: copy .env.example to .env and set AI_INTEGRATIONS_OPENAI_BASE_URL.\n" +
    "  Ollama: set it to http://localhost:11434/v1"
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY is not set.\n" +
    "  On Replit: add the OpenAI integration in your Replit project.\n" +
    "  Locally: copy .env.example to .env and set AI_INTEGRATIONS_OPENAI_API_KEY.\n" +
    "  Ollama: set it to the string 'ollama' (any value works)"
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
