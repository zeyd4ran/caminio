import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL");
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("Missing AI_INTEGRATIONS_OPENAI_API_KEY");
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function extractBase64(response: unknown): string {
  const resp = response as any;
  if (!Array.isArray(resp?.data) || resp.data.length === 0) {
    throw new Error("OpenAI did not return image data (data missing or empty)");
  }
  const base64 = resp.data[0].b64_json;
  if (!base64) {
    throw new Error("OpenAI did not return image data (b64_json missing)");
  }
  return base64;
}

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });

  const base64 = extractBase64(response);
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const base64 = extractBase64(response);
  const imageBytes = Buffer.from(base64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}