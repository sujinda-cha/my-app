// src/utils/api.ts
export interface GoRes<T> {
  code: number;
  data: T;
  message?: string;
  uiText: {
    version:string,
    isUptoDate:boolean,
  }
}

interface ApiOptions<TBody> {
  method?: string;
  headers?: Record<string, string>;
  body?: TBody;
  token?: string;
}

export async function apiFetch<TResponse, TBody = undefined>(
  endpoint: string,
  { method = "GET", headers = {}, body, token }: ApiOptions<TBody> = {}
): Promise<GoRes<TResponse>> {
  const resp = await fetch(endpoint, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    throw new Error(`HTTP error! Status: ${resp.status}`);
  }

  return resp.json() as Promise<GoRes<TResponse>>;
}