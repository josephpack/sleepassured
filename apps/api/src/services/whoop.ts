import crypto from "crypto";
import logger from "../lib/logger.js";

// WHOOP API configuration
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || "";
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || "";
const WHOOP_REDIRECT_URI =
  process.env.WHOOP_REDIRECT_URI || "http://localhost:3001/api/whoop/callback";

// Encryption key for storing tokens (derived from JWT secret)
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "dev-secret")
  .digest();

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// OAuth scopes for WHOOP (must match what's enabled in WHOOP developer portal)
const WHOOP_SCOPES = ["read:sleep", "read:recovery", "read:profile", "read:cycles"];

// Types
export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface WhoopUserProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopSleepStage {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

export interface WhoopSleepScore {
  stage_summary: WhoopSleepStage;
  sleep_needed: {
    baseline_milli: number;
    need_from_sleep_debt_milli: number;
    need_from_recent_strain_milli: number;
    need_from_recent_nap_milli: number;
  };
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
}

export interface WhoopSleepRecord {
  id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: WhoopSleepScore;
}

export interface WhoopRecoveryRecord {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
}

export interface WhoopPaginatedResponse<T> {
  records: T[];
  next_token?: string;
}

// Token encryption/decryption for secure storage
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted data
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const [ivHex, authTagHex, encrypted] = parts;

  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY,
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted!, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Generate the OAuth authorization URL
export function getAuthorizationUrl(state: string): string {
  logger.debug({ clientId: WHOOP_CLIENT_ID, redirectUri: WHOOP_REDIRECT_URI, scopes: WHOOP_SCOPES.join(" ") }, "WHOOP auth config");

  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    redirect_uri: WHOOP_REDIRECT_URI,
    response_type: "code",
    scope: WHOOP_SCOPES.join(" "),
    state,
  });

  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for access and refresh tokens
export async function exchangeCodeForTokens(
  code: string
): Promise<WhoopTokenResponse> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: WHOOP_CLIENT_ID,
      client_secret: WHOOP_CLIENT_SECRET,
      redirect_uri: WHOOP_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  logger.debug({ keys: Object.keys(data) }, "WHOOP token response");

  // WHOOP may not always return refresh_token - use access_token as fallback
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || data.access_token,
    expires_in: data.expires_in || 3600,
    token_type: data.token_type || "Bearer",
  };
}

// Refresh an expired access token
export async function refreshAccessToken(
  refreshToken: string
): Promise<WhoopTokenResponse> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: WHOOP_CLIENT_ID,
      client_secret: WHOOP_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json() as Promise<WhoopTokenResponse>;
}

// Fetch user profile
export async function fetchUserProfile(
  accessToken: string
): Promise<WhoopUserProfile> {
  const response = await fetch(`${WHOOP_API_BASE}/v2/user/profile/basic`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch user profile: ${error}`);
  }

  return response.json() as Promise<WhoopUserProfile>;
}

// Fetch sleep data for a date range
export async function fetchSleepData(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<WhoopSleepRecord[]> {
  const allRecords: WhoopSleepRecord[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    if (nextToken) {
      params.set("nextToken", nextToken);
    }

    const response = await fetch(
      `${WHOOP_API_BASE}/v2/activity/sleep?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch sleep data: ${error}`);
    }

    const data = (await response.json()) as WhoopPaginatedResponse<WhoopSleepRecord>;
    allRecords.push(...data.records);
    nextToken = data.next_token;
  } while (nextToken);

  return allRecords;
}

// Fetch recovery data for a date range
export async function fetchRecoveryData(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<WhoopRecoveryRecord[]> {
  const allRecords: WhoopRecoveryRecord[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    if (nextToken) {
      params.set("nextToken", nextToken);
    }

    const response = await fetch(
      `${WHOOP_API_BASE}/v2/recovery?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch recovery data: ${error}`);
    }

    const data = (await response.json()) as WhoopPaginatedResponse<WhoopRecoveryRecord>;
    allRecords.push(...data.records);
    nextToken = data.next_token;
  } while (nextToken);

  return allRecords;
}

// Revoke access (for disconnect)
export async function revokeAccess(_accessToken: string): Promise<void> {
  // WHOOP doesn't have a revoke endpoint, so we just delete our stored tokens
  // The user can revoke access from their WHOOP app settings
}

// Calculate token expiration date
export function getTokenExpiresAt(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

// Check if token is expired or about to expire (within 5 minutes)
export function isTokenExpired(expiresAt: Date): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return new Date(expiresAt.getTime() - bufferMs) < new Date();
}
