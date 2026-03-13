/**
 * GitHub Client for GitHub API integration
 * Handles organization, repository, and authentication operations
 */

import {
  IGitHubClient,
  GitHubOrganization,
  GitHubRepository,
  RepositoryConfig,
  SyncResult,
  PullRequestConfig,
  GitHubPullRequest,
} from '../types/services';
import { AuthToken } from '../types/models';

/**
 * Custom error class for GitHub API errors
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public rateLimitReset?: Date
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Custom error class for authentication errors
 */
export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

/**
 * Custom error class for rate limit errors
 */
export class GitHubRateLimitError extends GitHubAPIError {
  constructor(message: string, resetDate: Date) {
    super(message, 429, true, resetDate);
    this.name = 'GitHubRateLimitError';
  }
}

/**
 * GitHubClient implementation
 * Abstracts GitHub API interactions with error handling and retry logic
 */
export class GitHubClient implements IGitHubClient {
  private readonly baseUrl: string = 'https://api.github.com';
  private readonly maxRetries: number = 3;
  private readonly initialBackoffMs: number = 1000;

  constructor(private readonly defaultToken?: string) {}

  /**
   * Create a new GitHub Organization
   * Requires admin-level OAuth scope: admin:org
   */
  async createOrganization(name: string, adminToken: string): Promise<GitHubOrganization> {
    this.validateOrgName(name);
    this.validateAuthToken(adminToken);

    try {
      const response = await this.makeRequest<any>(
        '/orgs',
        {
          method: 'POST',
          body: JSON.stringify({
            login: name,
            profile_name: name,
          }),
        },
        adminToken
      );

      return this.mapToOrganization(response);
    } catch (error) {
      if (error instanceof GitHubAPIError || error instanceof GitHubAuthError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to create organization: ${(error as Error).message}`);
    }
  }

  /**
   * Get GitHub Organization by name
   */
  async getOrganization(name: string): Promise<GitHubOrganization> {
    this.validateOrgName(name);

    try {
      const response = await this.makeRequest<any>(`/orgs/${name}`, {
        method: 'GET',
      });

      return this.mapToOrganization(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to get organization: ${(error as Error).message}`);
    }
  }

  /**
   * Delete GitHub Organization
   * Requires admin-level OAuth scope and confirmation
   */
  async deleteOrganization(name: string, adminToken: string): Promise<void> {
    this.validateOrgName(name);
    this.validateAuthToken(adminToken);

    try {
      await this.makeRequest<void>(
        `/orgs/${name}`,
        {
          method: 'DELETE',
        },
        adminToken
      );
    } catch (error) {
      if (error instanceof GitHubAPIError || error instanceof GitHubAuthError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to delete organization: ${(error as Error).message}`);
    }
  }

  /**
   * Create a repository in an organization
   * Supports creating from template repositories to preserve commit history
   */
  async createRepository(
    orgName: string,
    repoName: string,
    config: RepositoryConfig
  ): Promise<GitHubRepository> {
    this.validateOrgName(orgName);
    this.validateRepoName(repoName);

    try {
      // If template repository is specified, use GitHub's template API
      if (config.templateRepository) {
        return await this.createFromTemplate(orgName, repoName, config);
      }

      // Otherwise, create a regular repository
      const response = await this.makeRequest<any>(
        `/orgs/${orgName}/repos`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: repoName,
            description: config.description,
            private: config.visibility === 'private',
            auto_init: config.autoInit ?? false,
          }),
        },
        this.defaultToken
      );

      return this.mapToRepository(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to create repository: ${(error as Error).message}`);
    }
  }

  /**
   * Create a repository from a template
   * Preserves commit history from the template repository
   */
  private async createFromTemplate(
    orgName: string,
    repoName: string,
    config: RepositoryConfig
  ): Promise<GitHubRepository> {
    if (!config.templateRepository) {
      throw new GitHubAPIError('Template repository URL is required');
    }

    // Parse template repository URL to extract owner and repo name
    const templateMatch = config.templateRepository.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (!templateMatch) {
      throw new GitHubAPIError('Invalid template repository URL format');
    }

    const [, templateOwner, templateRepo] = templateMatch;

    try {
      const response = await this.makeRequest<any>(
        `/repos/${templateOwner}/${templateRepo}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({
            owner: orgName,
            name: repoName,
            description: config.description,
            private: config.visibility === 'private',
            include_all_branches: false, // Only include default branch
          }),
        },
        this.defaultToken
      );

      return this.mapToRepository(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        `Failed to create repository from template: ${(error as Error).message}`
      );
    }
  }

  /**
   * Fork a repository to a target owner
   */
  async forkRepository(
    owner: string,
    repo: string,
    targetOwner: string
  ): Promise<GitHubRepository> {
    this.validateRepoName(repo);

    try {
      const response = await this.makeRequest<any>(
        `/repos/${owner}/${repo}/forks`,
        {
          method: 'POST',
          body: JSON.stringify({
            organization: targetOwner,
          }),
        },
        this.defaultToken
      );

      return this.mapToRepository(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to fork repository: ${(error as Error).message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    this.validateRepoName(repo);

    try {
      const response = await this.makeRequest<any>(`/repos/${owner}/${repo}`, {
        method: 'GET',
      });

      return this.mapToRepository(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to get repository: ${(error as Error).message}`);
    }
  }

  /**
   * Sync a fork with upstream repository
   */
  async syncFork(
    owner: string,
    repo: string,
    _upstreamOwner: string,
    _upstreamRepo: string
  ): Promise<SyncResult> {
    this.validateRepoName(repo);

    try {
      const response = await this.makeRequest<any>(
        `/repos/${owner}/${repo}/merge-upstream`,
        {
          method: 'POST',
          body: JSON.stringify({
            branch: 'main',
          }),
        },
        this.defaultToken
      );

      return {
        success: true,
        conflicts: [],
        message: response.message || 'Successfully synced fork',
      };
    } catch (error) {
      if (error instanceof GitHubAPIError && error.statusCode === 409) {
        return {
          success: false,
          conflicts: ['Merge conflict detected'],
          message: 'Merge conflicts need to be resolved manually',
        };
      }
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to sync fork: ${(error as Error).message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    pr: PullRequestConfig
  ): Promise<GitHubPullRequest> {
    this.validateRepoName(repo);

    try {
      const response = await this.makeRequest<any>(
        `/repos/${owner}/${repo}/pulls`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: pr.title,
            body: pr.body,
            head: pr.head,
            base: pr.base,
          }),
        },
        this.defaultToken
      );

      return this.mapToPullRequest(response);
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to create pull request: ${(error as Error).message}`);
    }
  }

  /**
   * Authenticate with GitHub OAuth
   * Exchanges authorization code for access token
   */
  async authenticateWithOAuth(
    code: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<AuthToken> {
    if (!code || code.trim().length === 0) {
      throw new GitHubAuthError('OAuth code is required');
    }

    // Client ID and secret would typically come from environment variables
    // For now, we validate they are provided
    if (!clientId || !clientSecret) {
      throw new GitHubAuthError('OAuth client credentials are required');
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      });

      if (!tokenResponse.ok) {
        throw new GitHubAuthError(`OAuth token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData: any = await tokenResponse.json();

      if (tokenData.error) {
        throw new GitHubAuthError(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      if (!tokenData.access_token) {
        throw new GitHubAuthError('No access token received from GitHub');
      }

      // Get user information to extract userId
      const userResponse = await this.makeRequest<any>(
        '/user',
        { method: 'GET' },
        tokenData.access_token
      );

      // Parse scope string into array
      const scopes = tokenData.scope ? tokenData.scope.split(',').map((s: string) => s.trim()) : [];

      // Create AuthToken object
      const authToken: AuthToken = {
        userId: userResponse.id.toString(),
        provider: 'github',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year if no expiry
        scope: scopes,
        createdAt: new Date(),
      };

      return authToken;
    } catch (error) {
      if (error instanceof GitHubAuthError || error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAuthError(`OAuth authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh an expired GitHub token
   * Uses exponential backoff for retry logic
   */
  async refreshToken(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<AuthToken> {
    if (!refreshToken || refreshToken.trim().length === 0) {
      throw new GitHubAuthError('Refresh token is required');
    }

    if (!clientId || !clientSecret) {
      throw new GitHubAuthError('OAuth client credentials are required');
    }

    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        if (!tokenResponse.ok) {
          // If it's a client error (4xx), don't retry
          if (tokenResponse.status >= 400 && tokenResponse.status < 500) {
            throw new GitHubAuthError(`Token refresh failed: ${tokenResponse.statusText}`);
          }
          // For server errors (5xx), we'll retry
          throw new Error(`Server error: ${tokenResponse.statusText}`);
        }

        const tokenData: any = await tokenResponse.json();

        if (tokenData.error) {
          throw new GitHubAuthError(
            `Token refresh error: ${tokenData.error_description || tokenData.error}`
          );
        }

        if (!tokenData.access_token) {
          throw new GitHubAuthError('No access token received from token refresh');
        }

        // Get user information
        const userResponse = await this.makeRequest<any>(
          '/user',
          { method: 'GET' },
          tokenData.access_token
        );

        // Parse scope string into array
        const scopes = tokenData.scope
          ? tokenData.scope.split(',').map((s: string) => s.trim())
          : [];

        // Create refreshed AuthToken object
        const authToken: AuthToken = {
          userId: userResponse.id.toString(),
          provider: 'github',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          scope: scopes,
          createdAt: new Date(),
        };

        return authToken;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors
        if (error instanceof GitHubAuthError) {
          throw error;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries - 1) {
          const backoffMs = this.calculateBackoff(attempt);
          await this.sleep(backoffMs);
        }
      }
    }

    // If we exhausted all retries, throw the last error
    throw new GitHubAuthError(
      `Token refresh failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Validate a GitHub token
   */
  async validateToken(token: string): Promise<boolean> {
    if (!token || token.trim().length === 0) {
      return false;
    }

    try {
      await this.makeRequest<any>('/user', { method: 'GET' }, token);
      return true;
    } catch (error) {
      if (error instanceof GitHubAuthError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Make an HTTP request to GitHub API with retry logic and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    token?: string,
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      if (response.status === 429 || (rateLimitRemaining && parseInt(rateLimitRemaining) === 0)) {
        const resetDate = rateLimitReset
          ? new Date(parseInt(rateLimitReset) * 1000)
          : new Date(Date.now() + 60000);
        throw new GitHubRateLimitError('GitHub API rate limit exceeded', resetDate);
      }

      // Handle authentication errors
      if (response.status === 401) {
        throw new GitHubAuthError('Authentication failed: Invalid or expired token');
      }

      if (response.status === 403) {
        const body = await response.text();
        if (body.includes('rate limit')) {
          const resetDate = rateLimitReset
            ? new Date(parseInt(rateLimitReset) * 1000)
            : new Date(Date.now() + 60000);
          throw new GitHubRateLimitError('GitHub API rate limit exceeded', resetDate);
        }
        throw new GitHubAuthError('Authentication failed: Insufficient permissions');
      }

      // Handle other client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        const errorBody: any = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new GitHubAPIError(
          errorBody.message || `GitHub API error: ${response.statusText}`,
          response.status,
          false
        );
      }

      // Handle server errors (5xx) with retry
      if (response.status >= 500) {
        const isRetryable = [502, 503, 504].includes(response.status);
        if (isRetryable && retryCount < this.maxRetries) {
          const backoffMs = this.calculateBackoff(retryCount);
          await this.sleep(backoffMs);
          return this.makeRequest<T>(endpoint, options, token, retryCount + 1);
        }
        throw new GitHubAPIError(
          `GitHub API server error: ${response.statusText}`,
          response.status,
          isRetryable
        );
      }

      // Handle successful responses
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      // Re-throw our custom errors
      if (
        error instanceof GitHubAPIError ||
        error instanceof GitHubAuthError ||
        error instanceof GitHubRateLimitError
      ) {
        throw error;
      }

      // Handle network errors with retry
      if (retryCount < this.maxRetries) {
        const backoffMs = this.calculateBackoff(retryCount);
        await this.sleep(backoffMs);
        return this.makeRequest<T>(endpoint, options, token, retryCount + 1);
      }

      throw new GitHubAPIError(`Network error: ${(error as Error).message}`, undefined, true);
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialBackoff = this.initialBackoffMs * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000;
    return exponentialBackoff + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate organization name
   */
  private validateOrgName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new GitHubAPIError('Organization name cannot be empty');
    }
    if (name.length > 39) {
      throw new GitHubAPIError('Organization name cannot exceed 39 characters');
    }
    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      throw new GitHubAPIError(
        'Organization name can only contain alphanumeric characters and hyphens'
      );
    }
  }

  /**
   * Validate repository name
   */
  private validateRepoName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new GitHubAPIError('Repository name cannot be empty');
    }
    if (name.length > 100) {
      throw new GitHubAPIError('Repository name cannot exceed 100 characters');
    }
  }

  /**
   * Validate authentication token
   */
  private validateAuthToken(token: string): void {
    if (!token || token.trim().length === 0) {
      throw new GitHubAuthError('Authentication token is required');
    }
  }

  /**
   * Map GitHub API response to Organization model
   */
  private mapToOrganization(data: any): GitHubOrganization {
    return {
      id: data.id.toString(),
      name: data.name || data.login,
      login: data.login,
      url: data.html_url,
    };
  }

  /**
   * Map GitHub API response to Repository model
   */
  private mapToRepository(data: any): GitHubRepository {
    return {
      id: data.id.toString(),
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      cloneUrl: data.clone_url,
      visibility: data.private ? 'private' : 'public',
    };
  }

  /**
   * Map GitHub API response to PullRequest model
   */
  private mapToPullRequest(data: any): GitHubPullRequest {
    return {
      id: data.id,
      number: data.number,
      url: data.html_url,
      title: data.title,
      state: data.state,
    };
  }
}
