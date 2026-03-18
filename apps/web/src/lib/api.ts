const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

let getAccessToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};
let onRefreshToken: () => Promise<string | null> = async () => null;

// Dedup concurrent refresh attempts so multiple 401s don't race
let refreshPromise: Promise<string | null> | null = null;

export function setAuthHandlers(
  tokenGetter: () => string | null,
  unauthorizedHandler: () => void,
  refreshHandler: () => Promise<string | null>
) {
  getAccessToken = tokenGetter;
  onUnauthorized = unauthorizedHandler;
  onRefreshToken = refreshHandler;
}

function silentRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = onRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    // On 401 for non-auth endpoints, try a silent refresh + retry once
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      const newToken = await silentRefresh();
      if (newToken) {
        // Retry the original request with the fresh token
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          method,
          headers: { "Content-Type": "application/json", ...retryHeaders },
          body: body ? JSON.stringify(body) : undefined,
          credentials: "include",
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
        // Retry also failed — if still 401, session is truly gone
        if (retryResponse.status === 401) {
          onUnauthorized();
        }
        const retryError = await retryResponse.json().catch(() => ({ error: "Request failed" }));
        throw new ApiError(retryResponse.status, retryError.error || "Request failed", retryError.details);
      }
      // Refresh failed — redirect to login
      onUnauthorized();
    }

    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(response.status, error.error || "Request failed", error.details);
  }

  return response.json();
}
