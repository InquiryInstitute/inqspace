/**
 * Unit tests for GitHubClient
 */

import {
  GitHubClient,
  GitHubAPIError,
  GitHubAuthError,
  GitHubRateLimitError,
} from './GitHubClient';
import { RepositoryConfig, PullRequestConfig } from '../types/services';

// Mock fetch globally
global.fetch = jest.fn();

describe('GitHubClient', () => {
  let client: GitHubClient;
  const mockToken = 'test-token-123';

  beforeEach(() => {
    client = new GitHubClient(mockToken);
    jest.clearAllMocks();
  });

  describe('Organization Operations', () => {
    describe('createOrganization', () => {
      it('should create organization with valid data', async () => {
        const mockResponse = {
          id: 12345,
          login: 'test-org',
          name: 'test-org',
          html_url: 'https://github.com/test-org',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 201,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.createOrganization('test-org', mockToken);

        expect(result).toEqual({
          id: '12345',
          name: 'test-org',
          login: 'test-org',
          url: 'https://github.com/test-org',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/orgs',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockToken}`,
            }),
          })
        );
      });

      it('should reject empty organization name', async () => {
        await expect(client.createOrganization('', mockToken)).rejects.toThrow(
          'Organization name cannot be empty'
        );
      });

      it('should reject organization name exceeding 39 characters', async () => {
        const longName = 'a'.repeat(40);
        await expect(client.createOrganization(longName, mockToken)).rejects.toThrow(
          'Organization name cannot exceed 39 characters'
        );
      });

      it('should reject organization name with invalid characters', async () => {
        await expect(client.createOrganization('invalid org!', mockToken)).rejects.toThrow(
          'Organization name can only contain alphanumeric characters and hyphens'
        );
      });

      it('should reject empty token', async () => {
        await expect(client.createOrganization('test-org', '')).rejects.toThrow(
          GitHubAuthError
        );
      });

      it('should handle authentication failure', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 401,
          statusText: 'Unauthorized',
          headers: new Map(),
        });

        await expect(client.createOrganization('test-org', mockToken)).rejects.toThrow(
          GitHubAuthError
        );
      });

      it('should handle rate limit error', async () => {
        const resetTime = Math.floor(Date.now() / 1000) + 3600;
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([
            ['x-ratelimit-remaining', '0'],
            ['x-ratelimit-reset', resetTime.toString()],
          ]),
        });

        await expect(client.createOrganization('test-org', mockToken)).rejects.toThrow(
          GitHubRateLimitError
        );
      });
    });

    describe('getOrganization', () => {
      it('should get organization by name', async () => {
        const mockResponse = {
          id: 12345,
          login: 'test-org',
          name: 'Test Organization',
          html_url: 'https://github.com/test-org',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.getOrganization('test-org');

        expect(result).toEqual({
          id: '12345',
          name: 'Test Organization',
          login: 'test-org',
          url: 'https://github.com/test-org',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/orgs/test-org',
          expect.objectContaining({
            method: 'GET',
          })
        );
      });

      it('should reject empty organization name', async () => {
        await expect(client.getOrganization('')).rejects.toThrow(
          'Organization name cannot be empty'
        );
      });

      it('should handle organization not found', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(client.getOrganization('nonexistent-org')).rejects.toThrow(
          GitHubAPIError
        );
      });
    });

    describe('deleteOrganization', () => {
      it('should delete organization with valid token', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 204,
          headers: new Map(),
        });

        await expect(
          client.deleteOrganization('test-org', mockToken)
        ).resolves.toBeUndefined();

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/orgs/test-org',
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockToken}`,
            }),
          })
        );
      });

      it('should reject empty organization name', async () => {
        await expect(client.deleteOrganization('', mockToken)).rejects.toThrow(
          'Organization name cannot be empty'
        );
      });

      it('should reject empty token', async () => {
        await expect(client.deleteOrganization('test-org', '')).rejects.toThrow(
          GitHubAuthError
        );
      });

      it('should handle insufficient permissions', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Insufficient permissions',
          headers: new Map(),
        });

        await expect(client.deleteOrganization('test-org', mockToken)).rejects.toThrow(
          GitHubAuthError
        );
      });

      it('should handle organization not found', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(
          client.deleteOrganization('nonexistent-org', mockToken)
        ).rejects.toThrow(GitHubAPIError);
      });

      it('should handle organization with repositories', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ message: 'Organization has repositories' }),
          headers: new Map(),
        });

        await expect(client.deleteOrganization('test-org', mockToken)).rejects.toThrow(
          GitHubAPIError
        );
      });
    });

    describe('getOrganization edge cases', () => {
      it('should handle organization with no display name', async () => {
        const mockResponse = {
          id: 12345,
          login: 'test-org',
          html_url: 'https://github.com/test-org',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.getOrganization('test-org');

        expect(result.name).toBe('test-org'); // Should fall back to login
        expect(result.login).toBe('test-org');
      });

      it('should handle very long organization name', async () => {
        const longName = 'a'.repeat(40);
        await expect(client.getOrganization(longName)).rejects.toThrow(
          'Organization name cannot exceed 39 characters'
        );
      });

      it('should handle organization name with special characters', async () => {
        await expect(client.getOrganization('test org!')).rejects.toThrow(
          'Organization name can only contain alphanumeric characters and hyphens'
        );
      });

      it('should handle organization name with spaces', async () => {
        await expect(client.getOrganization('test org')).rejects.toThrow(
          'Organization name can only contain alphanumeric characters and hyphens'
        );
      });

      it('should handle organization name with underscores', async () => {
        await expect(client.getOrganization('test_org')).rejects.toThrow(
          'Organization name can only contain alphanumeric characters and hyphens'
        );
      });

      it('should accept organization name with hyphens', async () => {
        const mockResponse = {
          id: 12345,
          login: 'test-org-name',
          name: 'Test Org Name',
          html_url: 'https://github.com/test-org-name',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.getOrganization('test-org-name');

        expect(result.login).toBe('test-org-name');
      });
    });

    describe('createOrganization edge cases', () => {
      it('should handle organization creation with existing name', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ message: 'Organization name already exists' }),
          headers: new Map(),
        });

        await expect(client.createOrganization('existing-org', mockToken)).rejects.toThrow(
          GitHubAPIError
        );
      });

      it('should handle whitespace-only organization name', async () => {
        await expect(client.createOrganization('   ', mockToken)).rejects.toThrow(
          'Organization name cannot be empty'
        );
      });

      it('should handle whitespace-only token', async () => {
        await expect(client.createOrganization('test-org', '   ')).rejects.toThrow(
          GitHubAuthError
        );
      });
    });
  });

  describe('Repository Operations', () => {
    describe('createRepository', () => {
      it('should create repository with valid configuration', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          description: 'Test repository',
          visibility: 'private',
          autoInit: true,
        };

        const mockResponse = {
          id: 67890,
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          private: true,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 201,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.createRepository('test-org', 'test-repo', config);

        expect(result).toEqual({
          id: '67890',
          name: 'test-repo',
          fullName: 'test-org/test-repo',
          url: 'https://github.com/test-org/test-repo',
          cloneUrl: 'https://github.com/test-org/test-repo.git',
          visibility: 'private',
        });
      });

      it('should reject empty repository name', async () => {
        const config: RepositoryConfig = {
          name: '',
          visibility: 'public',
        };

        await expect(client.createRepository('test-org', '', config)).rejects.toThrow(
          'Repository name cannot be empty'
        );
      });

      it('should reject repository name exceeding 100 characters', async () => {
        const longName = 'a'.repeat(101);
        const config: RepositoryConfig = {
          name: longName,
          visibility: 'public',
        };

        await expect(client.createRepository('test-org', longName, config)).rejects.toThrow(
          'Repository name cannot exceed 100 characters'
        );
      });

      it('should create repository from template', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          description: 'Test repository from template',
          visibility: 'private',
          templateRepository: 'https://github.com/template-owner/template-repo',
        };

        const mockResponse = {
          id: 77777,
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          private: true,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 201,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.createRepository('test-org', 'test-repo', config);

        expect(result).toEqual({
          id: '77777',
          name: 'test-repo',
          fullName: 'test-org/test-repo',
          url: 'https://github.com/test-org/test-repo',
          cloneUrl: 'https://github.com/test-org/test-repo.git',
          visibility: 'private',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/template-owner/template-repo/generate',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"owner":"test-org"'),
          })
        );
      });

      it('should reject invalid template repository URL', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
          templateRepository: 'invalid-url',
        };

        await expect(client.createRepository('test-org', 'test-repo', config)).rejects.toThrow(
          'Invalid template repository URL format'
        );
      });

      it('should handle template repository not found', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
          templateRepository: 'https://github.com/template-owner/nonexistent-template',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(client.createRepository('test-org', 'test-repo', config)).rejects.toThrow(
          GitHubAPIError
        );
      });

      it('should handle repository name conflict', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ message: 'Repository already exists' }),
          headers: new Map(),
        });

        await expect(client.createRepository('test-org', 'test-repo', config)).rejects.toThrow(
          GitHubAPIError
        );
      });

      it('should handle organization not found', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Organization not found' }),
          headers: new Map(),
        });

        await expect(
          client.createRepository('nonexistent-org', 'test-repo', config)
        ).rejects.toThrow(GitHubAPIError);
      });

      it('should handle insufficient permissions to create repository', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Insufficient permissions',
          headers: new Map(),
        });

        await expect(client.createRepository('test-org', 'test-repo', config)).rejects.toThrow(
          GitHubAPIError
        );
      });

      it('should create public repository', async () => {
        const config: RepositoryConfig = {
          name: 'public-repo',
          description: 'Public test repository',
          visibility: 'public',
          autoInit: true,
        };

        const mockResponse = {
          id: 88888,
          name: 'public-repo',
          full_name: 'test-org/public-repo',
          html_url: 'https://github.com/test-org/public-repo',
          clone_url: 'https://github.com/test-org/public-repo.git',
          private: false,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 201,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.createRepository('test-org', 'public-repo', config);

        expect(result.visibility).toBe('public');
        expect(result.name).toBe('public-repo');
      });

      it('should reject empty organization name', async () => {
        const config: RepositoryConfig = {
          name: 'test-repo',
          visibility: 'public',
        };

        await expect(client.createRepository('', 'test-repo', config)).rejects.toThrow(
          'Organization name cannot be empty'
        );
      });
    });

    describe('forkRepository', () => {
      it('should fork repository to target owner', async () => {
        const mockResponse = {
          id: 99999,
          name: 'test-repo',
          full_name: 'student-user/test-repo',
          html_url: 'https://github.com/student-user/test-repo',
          clone_url: 'https://github.com/student-user/test-repo.git',
          private: false,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 202,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.forkRepository('test-org', 'test-repo', 'student-user');

        expect(result).toEqual({
          id: '99999',
          name: 'test-repo',
          fullName: 'student-user/test-repo',
          url: 'https://github.com/student-user/test-repo',
          cloneUrl: 'https://github.com/student-user/test-repo.git',
          visibility: 'public',
        });
      });

      it('should reject empty repository name', async () => {
        await expect(
          client.forkRepository('test-org', '', 'student-user')
        ).rejects.toThrow('Repository name cannot be empty');
      });

      it('should handle fork already exists error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ message: 'Fork already exists' }),
          headers: new Map(),
        });

        await expect(
          client.forkRepository('test-org', 'test-repo', 'student-user')
        ).rejects.toThrow(GitHubAPIError);
      });

      it('should handle source repository not found', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(
          client.forkRepository('test-org', 'nonexistent-repo', 'student-user')
        ).rejects.toThrow(GitHubAPIError);
      });

      it('should handle insufficient permissions to fork', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Insufficient permissions',
          headers: new Map(),
        });

        await expect(
          client.forkRepository('test-org', 'test-repo', 'student-user')
        ).rejects.toThrow(GitHubAPIError);
      });
    });

    describe('getRepository', () => {
      it('should get repository information', async () => {
        const mockResponse = {
          id: 67890,
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          private: true,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.getRepository('test-org', 'test-repo');

        expect(result.name).toBe('test-repo');
        expect(result.visibility).toBe('private');
      });

      it('should reject empty repository name', async () => {
        await expect(client.getRepository('test-org', '')).rejects.toThrow(
          'Repository name cannot be empty'
        );
      });

      it('should handle repository not found', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(client.getRepository('test-org', 'nonexistent-repo')).rejects.toThrow(
          GitHubAPIError
        );
      });

      it('should handle private repository without access', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Map(),
        });

        await expect(client.getRepository('test-org', 'private-repo')).rejects.toThrow(
          GitHubAPIError
        );
      });
    });

    describe('syncFork', () => {
      it('should sync fork successfully', async () => {
        const mockResponse = {
          message: 'Successfully fetched and fast-forwarded',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.syncFork(
          'student-user',
          'test-repo',
          'test-org',
          'test-repo'
        );

        expect(result.success).toBe(true);
        expect(result.conflicts).toEqual([]);
      });

      it('should handle merge conflicts', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          json: async () => ({ message: 'Merge conflict' }),
          headers: new Map(),
        });

        const result = await client.syncFork(
          'student-user',
          'test-repo',
          'test-org',
          'test-repo'
        );

        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);
      });

      it('should reject empty repository name', async () => {
        await expect(
          client.syncFork('student-user', '', 'test-org', 'test-repo')
        ).rejects.toThrow('Repository name cannot be empty');
      });

      it('should handle sync failure with error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Map(),
        });

        await expect(
          client.syncFork('student-user', 'test-repo', 'test-org', 'test-repo')
        ).rejects.toThrow(GitHubAPIError);
      });
    });
  });

  describe('Pull Request Operations', () => {
    describe('createPullRequest', () => {
      it('should create pull request with valid configuration', async () => {
        const prConfig: PullRequestConfig = {
          title: 'Test PR',
          body: 'This is a test pull request',
          head: 'feature-branch',
          base: 'main',
        };

        const mockResponse = {
          id: 111111,
          number: 42,
          html_url: 'https://github.com/test-org/test-repo/pull/42',
          title: 'Test PR',
          state: 'open',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 201,
          json: async () => mockResponse,
          headers: new Map(),
        });

        const result = await client.createPullRequest('test-org', 'test-repo', prConfig);

        expect(result).toEqual({
          id: 111111,
          number: 42,
          url: 'https://github.com/test-org/test-repo/pull/42',
          title: 'Test PR',
          state: 'open',
        });
      });

      it('should reject empty repository name', async () => {
        const prConfig: PullRequestConfig = {
          title: 'Test PR',
          body: 'Test body',
          head: 'feature',
          base: 'main',
        };

        await expect(
          client.createPullRequest('test-org', '', prConfig)
        ).rejects.toThrow('Repository name cannot be empty');
      });

      it('should handle PR creation failure when branches are identical', async () => {
        const prConfig: PullRequestConfig = {
          title: 'Test PR',
          body: 'Test body',
          head: 'main',
          base: 'main',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ message: 'No commits between main and main' }),
          headers: new Map(),
        });

        await expect(
          client.createPullRequest('test-org', 'test-repo', prConfig)
        ).rejects.toThrow(GitHubAPIError);
      });

      it('should handle PR creation when head branch does not exist', async () => {
        const prConfig: PullRequestConfig = {
          title: 'Test PR',
          body: 'Test body',
          head: 'nonexistent-branch',
          base: 'main',
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Head branch not found' }),
          headers: new Map(),
        });

        await expect(
          client.createPullRequest('test-org', 'test-repo', prConfig)
        ).rejects.toThrow(GitHubAPIError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should retry on server errors (502, 503, 504)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 12345,
            login: 'test-org',
            name: 'test-org',
            html_url: 'https://github.com/test-org',
          }),
          headers: new Map(),
        });

      const result = await client.getOrganization('test-org');

      expect(result.login).toBe('test-org');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors (4xx)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Not Found' }),
        headers: new Map(),
      });

      await expect(client.getOrganization('nonexistent-org')).rejects.toThrow(
        GitHubAPIError
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit with reset time', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', resetTime.toString()],
        ]),
      });

      try {
        await client.getOrganization('test-org');
        fail('Should have thrown GitHubRateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubRateLimitError);
        expect((error as GitHubRateLimitError).rateLimitReset).toBeDefined();
      }
    });

    it('should handle network errors with retry', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 12345,
            login: 'test-org',
            name: 'test-org',
            html_url: 'https://github.com/test-org',
          }),
          headers: new Map(),
        });

      const result = await client.getOrganization('test-org');

      expect(result.login).toBe('test-org');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries on persistent network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.getOrganization('test-org')).rejects.toThrow(
        'Network error'
      );

      // Should have tried 4 times (initial + 3 retries)
      expect(global.fetch).toHaveBeenCalledTimes(4);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle 403 rate limit error from response body', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'API rate limit exceeded',
        headers: new Map([
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', resetTime.toString()],
        ]),
      });

      await expect(client.getOrganization('test-org')).rejects.toThrow(
        GitHubRateLimitError
      );
    });

    it('should handle 403 insufficient permissions error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Insufficient permissions',
        headers: new Map(),
      });

      await expect(client.getOrganization('test-org')).rejects.toThrow(
        GitHubAPIError
      );
    });

    it('should handle 500 server error without retry after max attempts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 501,
        statusText: 'Not Implemented',
        headers: new Map(),
      });

      await expect(client.getOrganization('test-org')).rejects.toThrow(
        'GitHub API server error'
      );

      // 501 is not retryable, should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 502 Bad Gateway with retry', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 502,
          statusText: 'Bad Gateway',
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 12345,
            login: 'test-org',
            name: 'test-org',
            html_url: 'https://github.com/test-org',
          }),
          headers: new Map(),
        });

      const result = await client.getOrganization('test-org');

      expect(result.login).toBe('test-org');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle 504 Gateway Timeout with retry', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 504,
          statusText: 'Gateway Timeout',
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 12345,
            login: 'test-org',
            name: 'test-org',
            html_url: 'https://github.com/test-org',
          }),
          headers: new Map(),
        });

      const result = await client.getOrganization('test-org');

      expect(result.login).toBe('test-org');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        json: async () => {
          throw new Error('Invalid JSON');
        },
        headers: new Map(),
      });

      await expect(client.getOrganization('test-org')).rejects.toThrow(
        GitHubAPIError
      );
    });
  });

  describe('Token Validation', () => {
    describe('validateToken', () => {
      it('should return true for valid token', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 200,
          json: async () => ({ login: 'test-user' }),
          headers: new Map(),
        });

        const result = await client.validateToken(mockToken);

        expect(result).toBe(true);
      });

      it('should return false for invalid token', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          status: 401,
          statusText: 'Unauthorized',
          headers: new Map(),
        });

        const result = await client.validateToken('invalid-token');

        expect(result).toBe(false);
      });

      it('should return false for empty token', async () => {
        const result = await client.validateToken('');

        expect(result).toBe(false);
      });
    });

    describe('authenticateWithOAuth', () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';
      const authCode = 'test-auth-code';

      it('should exchange authorization code for access token', async () => {
        const mockTokenResponse = {
          access_token: 'gho_test_access_token',
          token_type: 'bearer',
          scope: 'repo,user',
          expires_in: 28800,
        };

        const mockUserResponse = {
          id: 12345,
          login: 'test-user',
          email: 'test@example.com',
        };

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            status: 200,
            json: async () => mockUserResponse,
            headers: new Map(),
          });

        const result = await client.authenticateWithOAuth(authCode, clientId, clientSecret);

        expect(result.userId).toBe('12345');
        expect(result.provider).toBe('github');
        expect(result.accessToken).toBe('gho_test_access_token');
        expect(result.scope).toEqual(['repo', 'user']);
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(result.createdAt).toBeInstanceOf(Date);

        // Verify OAuth token exchange call
        expect(global.fetch).toHaveBeenCalledWith(
          'https://github.com/login/oauth/access_token',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(authCode),
          })
        );
      });

      it('should reject empty authorization code', async () => {
        await expect(
          client.authenticateWithOAuth('', clientId, clientSecret)
        ).rejects.toThrow(GitHubAuthError);
      });

      it('should reject missing client credentials', async () => {
        await expect(client.authenticateWithOAuth(authCode, '', '')).rejects.toThrow(
          'OAuth client credentials are required'
        );
      });

      it('should handle OAuth token exchange failure', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        await expect(
          client.authenticateWithOAuth(authCode, clientId, clientSecret)
        ).rejects.toThrow(GitHubAuthError);
      });

      it('should handle OAuth error response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            error: 'invalid_grant',
            error_description: 'The authorization code is invalid',
          }),
        });

        await expect(
          client.authenticateWithOAuth(authCode, clientId, clientSecret)
        ).rejects.toThrow('OAuth error: The authorization code is invalid');
      });

      it('should handle missing access token in response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            token_type: 'bearer',
          }),
        });

        await expect(
          client.authenticateWithOAuth(authCode, clientId, clientSecret)
        ).rejects.toThrow('No access token received from GitHub');
      });

      it('should handle token without expiry', async () => {
        const mockTokenResponse = {
          access_token: 'gho_test_access_token',
          token_type: 'bearer',
          scope: 'repo',
        };

        const mockUserResponse = {
          id: 12345,
          login: 'test-user',
        };

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            status: 200,
            json: async () => mockUserResponse,
            headers: new Map(),
          });

        const result = await client.authenticateWithOAuth(authCode, clientId, clientSecret);

        expect(result.accessToken).toBe('gho_test_access_token');
        // Should default to 1 year expiry
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
        expect(result.expiresAt.getTime()).toBeLessThanOrEqual(oneYearFromNow.getTime());
      });
    });

    describe('refreshToken', () => {
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';
      const refreshToken = 'test-refresh-token';

      it('should refresh expired token successfully', async () => {
        const mockTokenResponse = {
          access_token: 'gho_new_access_token',
          refresh_token: 'new_refresh_token',
          token_type: 'bearer',
          scope: 'repo,user',
          expires_in: 28800,
        };

        const mockUserResponse = {
          id: 12345,
          login: 'test-user',
        };

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            status: 200,
            json: async () => mockUserResponse,
            headers: new Map(),
          });

        const result = await client.refreshToken(refreshToken, clientId, clientSecret);

        expect(result.accessToken).toBe('gho_new_access_token');
        expect(result.refreshToken).toBe('new_refresh_token');
        expect(result.userId).toBe('12345');
        expect(result.provider).toBe('github');

        // Verify refresh token call
        expect(global.fetch).toHaveBeenCalledWith(
          'https://github.com/login/oauth/access_token',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('refresh_token'),
          })
        );
      });

      it('should reject empty refresh token', async () => {
        await expect(client.refreshToken('', clientId, clientSecret)).rejects.toThrow(
          'Refresh token is required'
        );
      });

      it('should reject missing client credentials', async () => {
        await expect(client.refreshToken(refreshToken, '', '')).rejects.toThrow(
          'OAuth client credentials are required'
        );
      });

      it('should not retry on client errors (4xx)', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        await expect(
          client.refreshToken(refreshToken, clientId, clientSecret)
        ).rejects.toThrow(GitHubAuthError);

        // Should only be called once (no retries for 4xx)
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should retry on server errors (5xx) with exponential backoff', async () => {
        const mockTokenResponse = {
          access_token: 'gho_new_access_token',
          token_type: 'bearer',
          scope: 'repo',
          expires_in: 28800,
        };

        const mockUserResponse = {
          id: 12345,
          login: 'test-user',
        };

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            status: 200,
            json: async () => mockUserResponse,
            headers: new Map(),
          });

        const result = await client.refreshToken(refreshToken, clientId, clientSecret);

        expect(result.accessToken).toBe('gho_new_access_token');
        // Should have retried after 503 error
        expect(global.fetch).toHaveBeenCalledTimes(3); // 2 token calls + 1 user call
      }, 10000); // Increase timeout to 10 seconds

      it('should fail after max retries on persistent server errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

        await expect(
          client.refreshToken(refreshToken, clientId, clientSecret)
        ).rejects.toThrow('Token refresh failed after 3 attempts');

        // Should have tried 3 times
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      it('should handle OAuth error response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            error: 'invalid_grant',
            error_description: 'The refresh token is invalid',
          }),
        });

        await expect(
          client.refreshToken(refreshToken, clientId, clientSecret)
        ).rejects.toThrow('Token refresh error: The refresh token is invalid');
      });

      it('should reuse old refresh token if new one not provided', async () => {
        const mockTokenResponse = {
          access_token: 'gho_new_access_token',
          token_type: 'bearer',
          scope: 'repo',
          expires_in: 28800,
        };

        const mockUserResponse = {
          id: 12345,
          login: 'test-user',
        };

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockTokenResponse,
          })
          .mockResolvedValueOnce({
            status: 200,
            json: async () => mockUserResponse,
            headers: new Map(),
          });

        const result = await client.refreshToken(refreshToken, clientId, clientSecret);

        expect(result.refreshToken).toBe(refreshToken);
      });
    });
  });
});
