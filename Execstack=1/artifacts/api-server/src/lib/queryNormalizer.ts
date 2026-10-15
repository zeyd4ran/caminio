/**
 * Safely convert Express query parameters (which can be string | string[])
 * into a plain object with string values for zod validation
 */
export function normalizeQueryParams(query: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(query)) {
    // If it's an array, take the first element
    // If it's undefined, skip it
    if (Array.isArray(value)) {
      normalized[key] = value[0];
    } else if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Safely extract a string parameter from Express route params
 * Route params can be string | string[] in TypeScript typing
 */
export function getParamAsString(param: string | string[]): string {
  if (Array.isArray(param)) {
    return param[0] || "";
  }
  return param;
}
