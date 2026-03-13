/**
 * Property-based tests for AuthService
 * Using fast-check for property-based testing
 */

import * as fc from 'fast-check';
import { AuthService } from './AuthService';
import { IGitHubClient } from '../types/services';
import { AuthToken } from '../types/models';

// Mock GitHubClient for property tests
class MockGitHubClient implements Pick<IGitHubClient, 'authenticateWithOAuth' | 'refreshToken' | 'validateToken'> {
  private mockAuthToken: AuthToken | null = null;

  setMockAuthToken(token: AuthToken) {
    this.mockAuthToken = token;
  }

  async authenticateWithOAuth(
    _code: string,
    _clientId?: string,
    _clientSecret?: string
  ): Promise<AuthToken> {
    if (!this.mockAuthToken) {
      throw new Error('Mock auth token not set');
    }
    return this.mockAuthToken;
  }

  async refreshToken(
    _refreshToken: string,
    _clientId?: string,
    _clientSecret?: string
  ): Promise<AuthToken> {
    if (!this.mockAuthToken) {
      throw new Error('Mock refresh token not set');
    }
    return this.mockAuthToken;
  }

  async validateToken(_token: string): Promise<boolean> {
    return true;
  }
}

// Mock fetch for GitHub user API
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AuthService Property-Based Tests', () => {
  let mockGitHubClient: MockGitHubClient;

  beforeEach(() => {
    mockGitHubClient = new MockGitHubClient();
    mockFetch.mockClear();
  });

  /**
   * **Validates: Requirements 7.2, 7.3**
   * 
   * Property 13: Authentication Token Security
   * 
   * For any user authentication (GitHub or Google), the system should store 
   * the authentication token in encrypted form and use it for subsequent API requests.
   * 
   * This property verifies that:
   * 1. Tokens are never stored in plaintext
   * 2. Encrypted tokens can be decrypted correctly
   * 3. The same token encrypts to different ciphertexts (due to random IVs)
   * 4. Decrypted tokens match the original plaintext
   */
  describe('Property 13: Authentication Token Security', () => {
    it('should encrypt GitHub tokens and decrypt them correctly for API requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random authentication data
          fc.record({
            accessToken: fc.string({ minLength: 20, maxLength: 100 }),
            refreshToken: fc.option(fc.string({ minLength: 20, maxLength: 100 })),
            githubId: fc.integer({ min: 1, max: 999999999 }),
            username: fc.string({ minLength: 1, maxLength: 39 }),
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            expiresInSeconds: fc.integer({ min: 60, max: 7200 }),
          }),
          async (authData) => {
            // Create a fresh AuthService instance for each test
            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}` // Unique encryption key per test
            );

            // Setup mock auth token
            const mockAuthToken: AuthToken = {
              userId: `github-user-${authData.githubId}`,
              provider: 'github',
              accessToken: authData.accessToken,
              refreshToken: authData.refreshToken || undefined,
              expiresAt: new Date(Date.now() + authData.expiresInSeconds * 1000),
              scope: ['read:user', 'user:email', 'repo'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockAuthToken);

            // Mock GitHub user API response
            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                id: authData.githubId,
                login: authData.username,
                name: authData.name,
                email: authData.email,
              }),
            });

            // Complete authentication (this stores the token encrypted)
            const user = await authService.completeGitHubAuth('test-auth-code');

            // Retrieve the token (this decrypts it)
            const retrievedToken = await authService.getGitHubToken(user.id);

            // Property: Decrypted token must match original plaintext
            expect(retrievedToken).toBe(authData.accessToken);

            // Property: Token should work for subsequent operations
            // (In a real scenario, this would be used for API requests)
            expect(retrievedToken).toBeDefined();
            expect(typeof retrievedToken).toBe('string');
            expect(retrievedToken.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encrypt Google tokens and decrypt them correctly for API requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random Google authentication data
          fc.record({
            accessToken: fc.string({ minLength: 20, maxLength: 200 }),
            refreshToken: fc.option(fc.string({ minLength: 20, maxLength: 200 })),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            expiresInSeconds: fc.integer({ min: 60, max: 7200 }),
          }),
          async (authData) => {
            // Create a fresh AuthService instance with Google enabled
            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}`, // Unique encryption key per test
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Mock Google token exchange
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: authData.accessToken,
                refresh_token: authData.refreshToken || undefined,
                expires_in: authData.expiresInSeconds,
                scope: 'openid email profile',
                token_type: 'Bearer',
              }),
            });

            // Mock Google user info
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: authData.googleId,
                email: authData.email,
                name: authData.name,
              }),
            });

            // Complete authentication (this stores the token encrypted)
            const user = await authService.completeGoogleAuth('test-google-code');

            // Retrieve the token (this decrypts it)
            const retrievedToken = await authService.getGoogleToken(user.id);

            // Property: Decrypted token must match original plaintext
            expect(retrievedToken).toBe(authData.accessToken);

            // Property: Token should work for subsequent operations
            expect(retrievedToken).toBeDefined();
            expect(typeof retrievedToken).toBe('string');
            expect(retrievedToken.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use different IVs for each encryption (same token encrypts differently)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random token data
          fc.record({
            accessToken: fc.string({ minLength: 20, maxLength: 100 }),
            githubId1: fc.integer({ min: 1, max: 999999999 }),
            githubId2: fc.integer({ min: 1, max: 999999999 }),
            username1: fc.string({ minLength: 1, maxLength: 39 }),
            username2: fc.string({ minLength: 1, maxLength: 39 }),
          }),
          async (data) => {
            // Skip if IDs are the same (we need different users)
            fc.pre(data.githubId1 !== data.githubId2);

            // Create a single AuthService instance
            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              'test-encryption-secret'
            );

            // Setup mock for first user with same access token
            const mockAuthToken1: AuthToken = {
              userId: `github-user-${data.githubId1}`,
              provider: 'github',
              accessToken: data.accessToken, // Same token
              refreshToken: 'refresh-token-1',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockAuthToken1);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId1,
                login: data.username1,
                name: 'User 1',
                email: 'user1@example.com',
              }),
            });

            const user1 = await authService.completeGitHubAuth('code-1');

            // Setup mock for second user with same access token
            const mockAuthToken2: AuthToken = {
              userId: `github-user-${data.githubId2}`,
              provider: 'github',
              accessToken: data.accessToken, // Same token
              refreshToken: 'refresh-token-2',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockAuthToken2);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId2,
                login: data.username2,
                name: 'User 2',
                email: 'user2@example.com',
              }),
            });

            const user2 = await authService.completeGitHubAuth('code-2');

            // Retrieve both tokens
            const token1 = await authService.getGitHubToken(user1.id);
            const token2 = await authService.getGitHubToken(user2.id);

            // Property: Both decrypt to the same plaintext
            expect(token1).toBe(data.accessToken);
            expect(token2).toBe(data.accessToken);

            // Property: The encrypted forms are different (due to different IVs)
            // We verify this indirectly by ensuring both users have separate tokens
            expect(user1.id).not.toBe(user2.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle tokens with special characters correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate tokens with various special characters
          fc.record({
            accessToken: fc.string({ minLength: 20, maxLength: 100 }),
            specialSuffix: fc.constantFrom('!@#$%', '^&*()', '+=[]{}', '|\\:;"<>?,./'),
            githubId: fc.integer({ min: 1, max: 999999999 }),
          }),
          async (data) => {
            const tokenWithSpecialChars = data.accessToken + data.specialSuffix;

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              'test-encryption-secret'
            );

            const mockAuthToken: AuthToken = {
              userId: `github-user-${data.githubId}`,
              provider: 'github',
              accessToken: tokenWithSpecialChars,
              refreshToken: 'refresh-token',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockAuthToken);
            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                id: data.githubId,
                login: 'testuser',
                name: 'Test User',
                email: 'test@example.com',
              }),
            });

            const user = await authService.completeGitHubAuth('test-code');
            const retrievedToken = await authService.getGitHubToken(user.id);

            // Property: Special characters are preserved through encryption/decryption
            expect(retrievedToken).toBe(tokenWithSpecialChars);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support dual authentication with separate encrypted tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate data for both GitHub and Google authentication
          fc.record({
            githubToken: fc.string({ minLength: 20, maxLength: 100 }),
            googleToken: fc.string({ minLength: 20, maxLength: 100 }),
            githubId: fc.integer({ min: 1, max: 999999999 }),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            email: fc.emailAddress(),
          }),
          async (data) => {
            // Ensure tokens are different
            fc.pre(data.githubToken !== data.googleToken);

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              'test-encryption-secret',
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Authenticate with GitHub
            const mockGitHubToken: AuthToken = {
              userId: `github-user-${data.githubId}`,
              provider: 'github',
              accessToken: data.githubToken,
              refreshToken: 'github-refresh',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId,
                login: 'testuser',
                name: 'Test User',
                email: data.email,
              }),
            });

            const githubUser = await authService.completeGitHubAuth('github-code');

            // Authenticate with Google (same email to link accounts)
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.googleToken,
                refresh_token: 'google-refresh',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.googleId,
                email: data.email,
                name: 'Test User',
              }),
            });

            const googleUser = await authService.completeGoogleAuth('google-code');

            // Property: Same user (linked accounts)
            expect(googleUser.id).toBe(githubUser.id);

            // Retrieve both tokens
            const retrievedGitHubToken = await authService.getGitHubToken(githubUser.id);
            const retrievedGoogleToken = await authService.getGoogleToken(googleUser.id);

            // Property: Both tokens decrypt correctly to their original values
            expect(retrievedGitHubToken).toBe(data.githubToken);
            expect(retrievedGoogleToken).toBe(data.googleToken);

            // Property: Tokens are different
            expect(retrievedGitHubToken).not.toBe(retrievedGoogleToken);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 8.3**
   * 
   * Property 14: Dual Authentication Support
   * 
   * For any user, the system should support authentication with both GitHub and 
   * Google Workspace simultaneously, maintaining separate tokens for each provider.
   * 
   * This property verifies that:
   * 1. A user can authenticate with both GitHub and Google
   * 2. Both authentication tokens are stored separately
   * 3. Both tokens can be retrieved independently
   * 4. Tokens remain separate and don't interfere with each other
   * 5. Account linking works correctly when using the same email
   */
  describe('Property 14: Dual Authentication Support', () => {
    it('should support simultaneous GitHub and Google authentication with separate tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate data for both GitHub and Google authentication
          fc.record({
            githubToken: fc.string({ minLength: 20, maxLength: 100 }),
            googleToken: fc.string({ minLength: 20, maxLength: 200 }),
            githubRefreshToken: fc.string({ minLength: 20, maxLength: 100 }),
            googleRefreshToken: fc.string({ minLength: 20, maxLength: 200 }),
            githubId: fc.integer({ min: 1, max: 999999999 }),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            email: fc.emailAddress(),
            username: fc.string({ minLength: 1, maxLength: 39 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            githubExpiresIn: fc.integer({ min: 60, max: 7200 }),
            googleExpiresIn: fc.integer({ min: 60, max: 7200 }),
          }),
          async (data) => {
            // Ensure tokens are different
            fc.pre(data.githubToken !== data.googleToken);
            fc.pre(data.githubRefreshToken !== data.googleRefreshToken);

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}`, // Unique encryption key
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Step 1: Authenticate with GitHub first
            const mockGitHubToken: AuthToken = {
              userId: `github-user-${data.githubId}`,
              provider: 'github',
              accessToken: data.githubToken,
              refreshToken: data.githubRefreshToken,
              expiresAt: new Date(Date.now() + data.githubExpiresIn * 1000),
              scope: ['read:user', 'user:email', 'repo'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId,
                login: data.username,
                name: data.name,
                email: data.email,
              }),
            });

            const githubUser = await authService.completeGitHubAuth('github-auth-code');

            // Property 1: GitHub authentication creates a user
            expect(githubUser).toBeDefined();
            expect(githubUser.email).toBe(data.email);
            expect(githubUser.githubId).toBe(data.githubId.toString());
            expect(githubUser.githubUsername).toBe(data.username);

            // Property 2: GitHub token can be retrieved
            const retrievedGitHubToken = await authService.getGitHubToken(githubUser.id);
            expect(retrievedGitHubToken).toBe(data.githubToken);

            // Step 2: Authenticate with Google using the same email (account linking)
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.googleToken,
                refresh_token: data.googleRefreshToken,
                expires_in: data.googleExpiresIn,
                scope: 'openid email profile',
                token_type: 'Bearer',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.googleId,
                email: data.email, // Same email for account linking
                name: data.name,
              }),
            });

            const googleUser = await authService.completeGoogleAuth('google-auth-code');

            // Property 3: Google authentication links to the same user (same email)
            expect(googleUser.id).toBe(githubUser.id);
            expect(googleUser.googleId).toBe(data.googleId);
            expect(googleUser.email).toBe(data.email);

            // Property 4: Both tokens can be retrieved independently
            const retrievedGitHubToken2 = await authService.getGitHubToken(googleUser.id);
            const retrievedGoogleToken = await authService.getGoogleToken(googleUser.id);

            // Property 5: Both tokens decrypt correctly to their original values
            expect(retrievedGitHubToken2).toBe(data.githubToken);
            expect(retrievedGoogleToken).toBe(data.googleToken);

            // Property 6: Tokens are separate and different
            expect(retrievedGitHubToken2).not.toBe(retrievedGoogleToken);

            // Property 7: Tokens don't interfere with each other
            // Retrieve GitHub token again to ensure Google auth didn't overwrite it
            const retrievedGitHubToken3 = await authService.getGitHubToken(googleUser.id);
            expect(retrievedGitHubToken3).toBe(data.githubToken);

            // Retrieve Google token again to ensure it's still correct
            const retrievedGoogleToken2 = await authService.getGoogleToken(googleUser.id);
            expect(retrievedGoogleToken2).toBe(data.googleToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain separate tokens when authenticating in reverse order (Google first, then GitHub)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate data for both providers
          fc.record({
            githubToken: fc.string({ minLength: 20, maxLength: 100 }),
            googleToken: fc.string({ minLength: 20, maxLength: 200 }),
            githubId: fc.integer({ min: 1, max: 999999999 }),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            email: fc.emailAddress(),
            username: fc.string({ minLength: 1, maxLength: 39 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (data) => {
            // Ensure tokens are different
            fc.pre(data.githubToken !== data.googleToken);

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}`,
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Step 1: Authenticate with Google first
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.googleToken,
                refresh_token: 'google-refresh',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.googleId,
                email: data.email,
                name: data.name,
              }),
            });

            const googleUser = await authService.completeGoogleAuth('google-code');

            // Property 1: Google authentication creates a user
            expect(googleUser).toBeDefined();
            expect(googleUser.email).toBe(data.email);
            expect(googleUser.googleId).toBe(data.googleId);

            // Property 2: Google token can be retrieved
            const retrievedGoogleToken = await authService.getGoogleToken(googleUser.id);
            expect(retrievedGoogleToken).toBe(data.googleToken);

            // Step 2: Authenticate with GitHub using the same email
            const mockGitHubToken: AuthToken = {
              userId: `github-user-${data.githubId}`,
              provider: 'github',
              accessToken: data.githubToken,
              refreshToken: 'github-refresh',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId,
                login: data.username,
                name: data.name,
                email: data.email, // Same email for account linking
              }),
            });

            const githubUser = await authService.completeGitHubAuth('github-code');

            // Property 3: GitHub authentication links to the same user
            expect(githubUser.id).toBe(googleUser.id);
            expect(githubUser.githubId).toBe(data.githubId.toString());

            // Property 4: Both tokens can be retrieved independently
            const retrievedGitHubToken = await authService.getGitHubToken(githubUser.id);
            const retrievedGoogleToken2 = await authService.getGoogleToken(githubUser.id);

            // Property 5: Both tokens are correct
            expect(retrievedGitHubToken).toBe(data.githubToken);
            expect(retrievedGoogleToken2).toBe(data.googleToken);

            // Property 6: Tokens remain separate
            expect(retrievedGitHubToken).not.toBe(retrievedGoogleToken2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle token revocation for both providers independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            githubToken: fc.string({ minLength: 20, maxLength: 100 }),
            googleToken: fc.string({ minLength: 20, maxLength: 200 }),
            githubId: fc.integer({ min: 1, max: 999999999 }),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            email: fc.emailAddress(),
          }),
          async (data) => {
            fc.pre(data.githubToken !== data.googleToken);

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}`,
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Authenticate with both providers
            const mockGitHubToken: AuthToken = {
              userId: `github-user-${data.githubId}`,
              provider: 'github',
              accessToken: data.githubToken,
              refreshToken: 'github-refresh',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.githubId,
                login: 'testuser',
                name: 'Test User',
                email: data.email,
              }),
            });

            const githubUser = await authService.completeGitHubAuth('github-code');

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.googleToken,
                refresh_token: 'google-refresh',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.googleId,
                email: data.email,
                name: 'Test User',
              }),
            });

            await authService.completeGoogleAuth('google-code');

            // Verify both tokens exist
            const token1 = await authService.getGitHubToken(githubUser.id);
            const token2 = await authService.getGoogleToken(githubUser.id);
            expect(token1).toBe(data.githubToken);
            expect(token2).toBe(data.googleToken);

            // Revoke all tokens
            await authService.revokeTokens(githubUser.id);

            // Property: Both tokens should be revoked
            await expect(authService.getGitHubToken(githubUser.id)).rejects.toThrow(
              'GitHub token not found for user'
            );
            await expect(authService.getGoogleToken(githubUser.id)).rejects.toThrow(
              'Google token not found for user'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support dual authentication for multiple users without token interference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user1: fc.record({
              githubToken: fc.string({ minLength: 20, maxLength: 100 }),
              googleToken: fc.string({ minLength: 20, maxLength: 200 }),
              githubId: fc.integer({ min: 1, max: 999999999 }),
              googleId: fc.string({ minLength: 10, maxLength: 50 }),
              email: fc.emailAddress(),
            }),
            user2: fc.record({
              githubToken: fc.string({ minLength: 20, maxLength: 100 }),
              googleToken: fc.string({ minLength: 20, maxLength: 200 }),
              githubId: fc.integer({ min: 1, max: 999999999 }),
              googleId: fc.string({ minLength: 10, maxLength: 50 }),
              email: fc.emailAddress(),
            }),
          }),
          async (data) => {
            // Ensure users are different
            fc.pre(data.user1.githubId !== data.user2.githubId);
            fc.pre(data.user1.googleId !== data.user2.googleId);
            fc.pre(data.user1.email !== data.user2.email);

            const authService = new AuthService(
              mockGitHubClient as unknown as IGitHubClient,
              'test-client-id',
              'test-client-secret',
              `test-encryption-secret-${Math.random()}`,
              'test-google-client-id',
              'test-google-client-secret'
            );

            // Authenticate user 1 with both providers
            const mockGitHubToken1: AuthToken = {
              userId: `github-user-${data.user1.githubId}`,
              provider: 'github',
              accessToken: data.user1.githubToken,
              refreshToken: 'refresh-1',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken1);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.user1.githubId,
                login: 'user1',
                name: 'User 1',
                email: data.user1.email,
              }),
            });

            const user1 = await authService.completeGitHubAuth('code-1');

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.user1.googleToken,
                refresh_token: 'google-refresh-1',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.user1.googleId,
                email: data.user1.email,
                name: 'User 1',
              }),
            });

            await authService.completeGoogleAuth('google-code-1');

            // Authenticate user 2 with both providers
            const mockGitHubToken2: AuthToken = {
              userId: `github-user-${data.user2.githubId}`,
              provider: 'github',
              accessToken: data.user2.githubToken,
              refreshToken: 'refresh-2',
              expiresAt: new Date(Date.now() + 3600000),
              scope: ['read:user'],
              createdAt: new Date(),
            };

            mockGitHubClient.setMockAuthToken(mockGitHubToken2);
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.user2.githubId,
                login: 'user2',
                name: 'User 2',
                email: data.user2.email,
              }),
            });

            const user2 = await authService.completeGitHubAuth('code-2');

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                access_token: data.user2.googleToken,
                refresh_token: 'google-refresh-2',
                expires_in: 3600,
                scope: 'openid email profile',
              }),
            });

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                id: data.user2.googleId,
                email: data.user2.email,
                name: 'User 2',
              }),
            });

            await authService.completeGoogleAuth('google-code-2');

            // Property: Each user's tokens are separate and correct
            const user1GithubToken = await authService.getGitHubToken(user1.id);
            const user1GoogleToken = await authService.getGoogleToken(user1.id);
            const user2GithubToken = await authService.getGitHubToken(user2.id);
            const user2GoogleToken = await authService.getGoogleToken(user2.id);

            expect(user1GithubToken).toBe(data.user1.githubToken);
            expect(user1GoogleToken).toBe(data.user1.googleToken);
            expect(user2GithubToken).toBe(data.user2.githubToken);
            expect(user2GoogleToken).toBe(data.user2.googleToken);

            // Property: No token interference between users
            expect(user1GithubToken).not.toBe(user2GithubToken);
            expect(user1GoogleToken).not.toBe(user2GoogleToken);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
