import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "dev-jwt-refresh-secret";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DEFAULT = "30d";
const REFRESH_TOKEN_EXPIRY_REMEMBER = "90d";

export interface TokenPayload {
  userId: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(
  userId: string,
  rememberMe: boolean = false
): string {
  const expiresIn = rememberMe
    ? REFRESH_TOKEN_EXPIRY_REMEMBER
    : REFRESH_TOKEN_EXPIRY_DEFAULT;

  return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn,
  });
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, JWT_SECRET) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, JWT_REFRESH_SECRET) as DecodedToken;
}

export function getRefreshTokenExpiry(rememberMe: boolean = false): Date {
  const days = rememberMe ? 90 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
