import { dispatchApiUnauthorized } from "@workspace/api-client-react";

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: init.credentials ?? "same-origin",
  });

  if (response.status === 401) {
    dispatchApiUnauthorized();
  }

  return response;
}
