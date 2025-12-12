export interface TokenMetadata {
  ipAddress: string;
  userAgent: string;
}

export interface IJwtPayload {
  userId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
