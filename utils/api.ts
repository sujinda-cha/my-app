// src/utils/api.ts
export interface GoRes<T> {
  code: number;
  data: T;
  message?: string;
  uiText: {
    version: string;
    isUptoDate: boolean;
  };
}

interface ApiOptions<TBody> {
  method?: string;
  headers?: Record<string, string>;
  body?: TBody;
  token?: string;
}

function toQueryString(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj as Record<string, any>)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => params.append(k, String(item)));
    } else if (typeof v === "object") {
      params.append(k, JSON.stringify(v)); // เก็บ object เป็น JSON string
    } else {
      params.append(k, String(v));
    }
  }
  return params.toString();
}

export async function apiFetch<TResponse, TBody = undefined>(
    endpoint: string,
    { method = "GET", headers = {}, body, token }: ApiOptions<TBody> = {}
): Promise<GoRes<TResponse>> {
  const upperMethod = (method ?? "GET").toUpperCase();
  let finalUrl = endpoint;

  // สร้าง fetch options พื้นฐาน
  const fetchOptions: RequestInit = {
    method: upperMethod,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...headers,
    },
  };

  // ถ้าเป็น GET/HEAD → ห้ามมี body; ถ้ามี body ให้แปลงเป็น query string
  if (upperMethod === "GET" || upperMethod === "HEAD") {
    const qs = toQueryString(body as any);
    if (qs) {
      finalUrl += (finalUrl.includes("?") ? "&" : "?") + qs;
    }
  } else {
    // เมธอดอื่น ๆ ส่ง body เป็น JSON ตามเดิม (ถ้ามี)
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const resp = await fetch(finalUrl, fetchOptions);

  if (!resp.ok) {
    // พยายามอ่านข้อความผิดพลาดเพื่อดีบักง่ายขึ้น
    let detail = "";
    try {
      detail = await resp.text();
    } catch {
      /* noop */
    }
    throw new Error(`HTTP ${resp.status} ${resp.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return (await resp.json()) as GoRes<TResponse>;
}