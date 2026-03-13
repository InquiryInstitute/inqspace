/**
 * AuthService for managing authentication and session management
 * Handles GitHub OAuth flow, secure token storage with encryption, and session management
 */

import { IAuthService, IGitHubClient } from '../types/services';
import { User, AuthToken } from '../types/models';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

/**
 * Custom error class for authentication errors
 */
export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

/**
 * Session data structure
 */
interface Session {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Encrypted token storage structure
 */
interface EncryptedTokenData {
  encryptedAccessToken: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
  encryptedRefreshToken?: string;
  refreshTokenIv?: string;
  refreshTokenAuthTag?: string;
  expiresAt: Date;
  provider: 'github' | 'google';
}

/**
 * AuthService implementation
 * Manages GitHub OAuth flow, secure token storage with encryption, and session management
 */
export class AuthService implements IAuthService {
  private readonly githubClientId: string;
  private readonly githubClientSecret: string;
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly encryptionKey: Buffer;
  private readonly sessionDurationMs: number = 24 * 60 * 60 * 1000; // 24 hours
  private readonly googleWorkspaceEnabled: boolean;

  // In-memory session store (in production, use Redis or database)
  private sessions: Map<string, Session> = new Map();

  // In-memory token store (in production, use database)
  private tokenStore: Map<string, EncryptedTokenData> = new Map();

  // In-memory user store (in production, use database)
  private userStore: Map<string, User> = new Map();

  constructor(
    private readonly githubClient: IGitHubClient,
    githubClientId?: string,
    githubClientSecret?: string,
    encryptionSecret?: string,
    googleClientId?: string,
    googleClientSecret?: string
  ) {
    // In production, these would come from environment variables
    this.githubClientId = githubClientId || process.env.GITHUB_CLIENT_ID || '';
    this.githubClientSecret = githubClientSecret || process.env.GITHUB_CLIENT_SECRET || '';
    this.googleClientId = googleClientId || process.env.GOOGLE_CLIENT_ID || '';
    this.googleClientSecret = googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '';

    // Derive encryption key from secret using scrypt
    const secret =
      encryptionSecret ||
      process.env.ENCRYPTION_SECRET ||
      'default-secret-key-change-in-production';
    this.encryptionKey = scryptSync(secret, 'salt', 32);

    if (!this.githubClientId || !this.githubClientSecret) {
      console.warn('GitHub OAuth credentials not configured');
    }

    // Google Workspace is enabled if credentials are configured
    this.googleWorkspaceEnabled = !!(this.googleClientId && this.googleClientSecret);

    if (!this.googleWorkspaceEnabled) {
      console.warn('Google Workspace OAuth credentials not configured - fallback to GitHub only');
    }
  }

  /**
   * Initiate GitHub OAuth flow
   * Returns the OAuth authorization URL
   * Validates: Requirements 7.1
   */
  async initiateGitHubAuth(): Promise<string> {
    if (!this.githubClientId) {
      throw new AuthServiceError('GitHub OAuth client ID not configured');
    }

    // Generate state parameter for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state for validation (in production, use Redis with expiration)
    // For now, we'll skip state validation in completeGitHubAuth

    // Construct OAuth authorization URL
    const scopes = ['read:user', 'user:email', 'repo', 'admin:org'];
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', this.githubClientId);
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri());
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);

    return authUrl.toString();
  }

  /**
   * Complete GitHub OAuth flow
   * Exchanges authorization code for access token and creates user session
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  async completeGitHubAuth(code: string): Promise<User> {
    if (!code || code.trim().length === 0) {
      throw new AuthServiceError('Authorization code is required');
    }

    try {
      // Exchange code for access token using GitHubClient
      const authToken = await this.githubClient.authenticateWithOAuth(
        code,
        this.githubClientId,
        this.githubClientSecret
      );

      // Get user information from GitHub
      const githubUser = await this.fetchGitHubUser(authToken.accessToken);

      // Find or create user in our system
      let user = this.findUserByGitHubId(githubUser.id.toString());

      if (!user) {
        // Check if user exists with same email (for linking accounts)
        const email = githubUser.email || `${githubUser.login}@github.local`;
        user = this.findUserByEmail(email);

        if (user) {
          // Link GitHub account to existing user
          user.githubId = githubUser.id.toString();
          user.githubUsername = githubUser.login;
          user.lastLoginAt = new Date();
          this.userStore.set(user.id, user);
        } else {
          // Create new user
          user = {
            id: this.generateUserId(),
            email,
            name: githubUser.name || githubUser.login,
            role: 'student', // Default role
            githubUsername: githubUser.login,
            githubId: githubUser.id.toString(),
            createdAt: new Date(),
            lastLoginAt: new Date(),
            enrollments: [],
          };
          this.userStore.set(user.id, user);
        }
      } else {
        // Update last login
        user.lastLoginAt = new Date();
        this.userStore.set(user.id, user);
      }

      // Store encrypted token
      await this.storeEncryptedToken(user.id, authToken);

      return user;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      throw new AuthServiceError(`GitHub authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Initiate Google Workspace OAuth flow
   * Returns the OAuth authorization URL
   * Validates: Requirements 8.1, 8.2, 8.4
   */
  async initiateGoogleAuth(): Promise<string> {
    // Check if Google Workspace is enabled
    if (!this.googleWorkspaceEnabled) {
      throw new AuthServiceError(
        'Google Workspace authentication not configured - falling back to GitHub authentication'
      );
    }

    if (!this.googleClientId) {
      throw new AuthServiceError('Google OAuth client ID not configured');
    }

    // Generate state parameter for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state for validation (in production, use Redis with expiration)
    // For now, we'll skip state validation in completeGoogleAuth

    // Construct OAuth authorization URL
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.googleClientId);
    authUrl.searchParams.set('redirect_uri', this.getGoogleRedirectUri());
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

    return authUrl.toString();
  }

  /**
   * Complete Google Workspace OAuth flow
   * Exchanges authorization code for access token and creates/links user
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   */
  async completeGoogleAuth(code: string): Promise<User> {
    // Check if Google Workspace is enabled
    if (!this.googleWorkspaceEnabled) {
      throw new AuthServiceError(
        'Google Workspace authentication not configured - falling back to GitHub authentication'
      );
    }

    if (!code || code.trim().length === 0) {
      throw new AuthServiceError('Authorization code is required');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeGoogleCode(code);

      // Get user information from Google
      const googleUser = await this.fetchGoogleUser(tokenResponse.access_token);

      // Find or create user in our system
      let user = this.findUserByGoogleId(googleUser.id);

      if (!user) {
        // Check if user exists with same email (for linking accounts)
        user = this.findUserByEmail(googleUser.email);

        if (user) {
          // Link Google account to existing user
          user.googleId = googleUser.id;
          user.lastLoginAt = new Date();
          this.userStore.set(user.id, user);
        } else {
          // Create new user
          user = {
            id: this.generateUserId(),
            email: googleUser.email,
            name: googleUser.name || googleUser.email,
            role: 'student', // Default role
            googleId: googleUser.id,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            enrollments: [],
          };
          this.userStore.set(user.id, user);
        }
      } else {
        // Update last login
        user.lastLoginAt = new Date();
        this.userStore.set(user.id, user);
      }

      // Store encrypted token
      const authToken: AuthToken = {
        userId: user.id,
        provider: 'google',
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        scope: tokenResponse.scope?.split(' ') || [],
        createdAt: new Date(),
      };

      await this.storeEncryptedToken(user.id, authToken);

      return user;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      throw new AuthServiceError(`Google authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get GitHub token for a user
   * Decrypts and returns the access token
   * Automatically refreshes token if expired
   * Validates: Requirements 7.2, 7.3
   */
  async getGitHubToken(userId: string): Promise<string> {
    const encryptedData = this.tokenStore.get(`${userId}:github`);

    if (!encryptedData) {
      throw new AuthServiceError('GitHub token not found for user');
    }

    try {
      // Check if token is expired
      if (encryptedData.expiresAt < new Date()) {
        // Token is expired, attempt to refresh
        if (!encryptedData.encryptedRefreshToken) {
          throw new AuthServiceError('Token expired and no refresh token available');
        }

        // Refresh the token automatically
        return await this.refreshGitHubToken(userId);
      }

      const accessToken = this.decryptToken(
        encryptedData.encryptedAccessToken,
        encryptedData.accessTokenIv,
        encryptedData.accessTokenAuthTag
      );

      return accessToken;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      throw new AuthServiceError(`Failed to decrypt token: ${(error as Error).message}`);
    }
  }

  /**
   * Get Google token for a user
   * Decrypts and returns the access token
   * Automatically refreshes token if expired
   * Validates: Requirements 8.3
   */
  async getGoogleToken(userId: string): Promise<string> {
    const encryptedData = this.tokenStore.get(`${userId}:google`);

    if (!encryptedData) {
      throw new AuthServiceError('Google token not found for user');
    }

    try {
      // Check if token is expired
      if (encryptedData.expiresAt < new Date()) {
        // Token is expired, attempt to refresh
        if (!encryptedData.encryptedRefreshToken) {
          throw new AuthServiceError('Token expired and no refresh token available');
        }

        // Refresh the token automatically
        return await this.refreshGoogleToken(userId);
      }

      const accessToken = this.decryptToken(
        encryptedData.encryptedAccessToken,
        encryptedData.accessTokenIv,
        encryptedData.accessTokenAuthTag
      );

      return accessToken;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      throw new AuthServiceError(`Failed to decrypt token: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh GitHub token
   * Uses refresh token to obtain new access token
   * Validates: Requirements 7.2, 7.3
   */
  async refreshGitHubToken(userId: string): Promise<string> {
    const encryptedData = this.tokenStore.get(`${userId}:github`);

    if (!encryptedData || !encryptedData.encryptedRefreshToken) {
      throw new AuthServiceError('Refresh token not found for user');
    }

    try {
      const refreshToken = this.decryptToken(
        encryptedData.encryptedRefreshToken,
        encryptedData.refreshTokenIv!,
        encryptedData.refreshTokenAuthTag!
      );

      // Use GitHubClient to refresh token
      const newAuthToken = await this.githubClient.refreshToken(
        refreshToken,
        this.githubClientId,
        this.githubClientSecret
      );

      // Store new encrypted token
      await this.storeEncryptedToken(userId, newAuthToken);

      return newAuthToken.accessToken;
    } catch (error) {
      throw new AuthServiceError(`Failed to refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh Google token
   * Uses refresh token to obtain new access token
   * Validates: Requirements 8.3
   */
  async refreshGoogleToken(userId: string): Promise<string> {
    const encryptedData = this.tokenStore.get(`${userId}:google`);

    if (!encryptedData || !encryptedData.encryptedRefreshToken) {
      throw new AuthServiceError('Refresh token not found for user');
    }

    try {
      const refreshToken = this.decryptToken(
        encryptedData.encryptedRefreshToken,
        encryptedData.refreshTokenIv!,
        encryptedData.refreshTokenAuthTag!
      );

      // Exchange refresh token for new access token
      const tokenResponse = await this.refreshGoogleTokenWithAPI(refreshToken);

      // Create new auth token
      const newAuthToken: AuthToken = {
        userId,
        provider: 'google',
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken, // Use new refresh token if provided
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        scope: tokenResponse.scope?.split(' ') || [],
        createdAt: new Date(),
      };

      // Store new encrypted token
      await this.storeEncryptedToken(userId, newAuthToken);

      return newAuthToken.accessToken;
    } catch (error) {
      throw new AuthServiceError(`Failed to refresh Google token: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke all tokens for a user
   * Validates: Requirements 7.4
   */
  async revokeTokens(userId: string): Promise<void> {
    // Remove GitHub token
    this.tokenStore.delete(`${userId}:github`);

    // Remove Google token
    this.tokenStore.delete(`${userId}:google`);

    // In production, also revoke tokens with OAuth providers
  }

  /**
   * Check if Google Workspace authentication is available
   * Validates: Requirements 8.4
   */
  isGoogleWorkspaceEnabled(): boolean {
    return this.googleWorkspaceEnabled;
  }

  /**
   * Create a new session for a user
   * Validates: Requirements 7.4
   */
  async createSession(userId: string): Promise<string> {
    const user = this.userStore.get(userId);

    if (!user) {
      throw new AuthServiceError('User not found');
    }

    // Generate secure session ID
    const sessionId = randomBytes(32).toString('hex');

    const session: Session = {
      sessionId,
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionDurationMs),
    };

    this.sessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * Validate a session and return the user
   * Validates: Requirements 7.4
   */
  async validateSession(sessionId: string): Promise<User> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new AuthServiceError('Invalid session');
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      throw new AuthServiceError('Session expired');
    }

    const user = this.userStore.get(session.userId);

    if (!user) {
      this.sessions.delete(sessionId);
      throw new AuthServiceError('User not found');
    }

    return user;
  }

  /**
   * Destroy a session
   * Validates: Requirements 7.4
   */
  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * Encrypt a token using AES-256-GCM
   * Validates: Requirements 7.2
   */
  private encryptToken(token: string): { encrypted: string; iv: string; authTag: string } {
    // Generate random initialization vector
    const iv = randomBytes(16);

    // Create cipher
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    // Encrypt token
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt a token using AES-256-GCM
   * Validates: Requirements 7.2
   */
  private decryptToken(encrypted: string, ivHex: string, authTagHex: string): string {
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt token
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store encrypted token for a user
   * Validates: Requirements 7.2, 7.3
   */
  private async storeEncryptedToken(userId: string, authToken: AuthToken): Promise<void> {
    // Encrypt access token
    const encryptedAccess = this.encryptToken(authToken.accessToken);

    // Encrypt refresh token if present
    let encryptedRefresh: { encrypted: string; iv: string; authTag: string } | undefined;
    if (authToken.refreshToken) {
      encryptedRefresh = this.encryptToken(authToken.refreshToken);
    }

    const encryptedData: EncryptedTokenData = {
      encryptedAccessToken: encryptedAccess.encrypted,
      accessTokenIv: encryptedAccess.iv,
      accessTokenAuthTag: encryptedAccess.authTag,
      encryptedRefreshToken: encryptedRefresh?.encrypted,
      refreshTokenIv: encryptedRefresh?.iv,
      refreshTokenAuthTag: encryptedRefresh?.authTag,
      expiresAt: authToken.expiresAt,
      provider: authToken.provider,
    };

    // Store encrypted token
    this.tokenStore.set(`${userId}:${authToken.provider}`, encryptedData);
  }

  /**
   * Fetch GitHub user information
   */
  private async fetchGitHubUser(accessToken: string): Promise<any> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new AuthServiceError(`Failed to fetch GitHub user: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Exchange Google authorization code for access token
   */
  private async exchangeGoogleCode(code: string): Promise<any> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: this.getGoogleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      throw new AuthServiceError(
        `Failed to exchange Google code: ${errorData.error_description || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Refresh Google access token using refresh token
   */
  private async refreshGoogleTokenWithAPI(refreshToken: string): Promise<any> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      throw new AuthServiceError(
        `Failed to refresh Google token: ${errorData.error_description || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Fetch Google user information
   */
  private async fetchGoogleUser(accessToken: string): Promise<any> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AuthServiceError(`Failed to fetch Google user: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Find user by GitHub ID
   */
  private findUserByGitHubId(githubId: string): User | undefined {
    for (const user of this.userStore.values()) {
      if (user.githubId === githubId) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Find user by Google ID
   */
  private findUserByGoogleId(googleId: string): User | undefined {
    for (const user of this.userStore.values()) {
      if (user.googleId === googleId) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Find user by email
   */
  private findUserByEmail(email: string): User | undefined {
    for (const user of this.userStore.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get OAuth redirect URI
   */
  private getRedirectUri(): string {
    // In production, this would come from environment variables
    return process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback';
  }

  /**
   * Get Google OAuth redirect URI
   */
  private getGoogleRedirectUri(): string {
    // In production, this would come from environment variables
    return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
  }
}
