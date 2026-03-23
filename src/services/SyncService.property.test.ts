/**
 * Property-based tests for SyncService
 */

import { SyncService, SyncServiceError } from './SyncService';
import { IGitHubClient } from '../types/services';
import { IForkRepository, IAssignmentRepository } from '../types/repositories';
import { Fork, Assignment } from '../types/models';
import * as fc from 'fast-check';

/**
 * Mock GitHubClient for property tests
 */
class MockGitHubClient implements Pick<IGitHubClient, 'createOrganization' | 'getOrganization' | 'deleteOrganization' | 'authenticateWithOAuth' | 'refreshToken' | 'validateToken' | 'createRepository' | 'forkRepository' | 'getRepository' | 'syncFork' | 'createPullRequest'> {
  private mockSyncResult: any | null = null;
  private shouldFailSync = false;

  setMockSyncResult(result: any) {
    this.mockSyncResult = result;
  }

  setShouldFailSync(shouldFail: boolean) {
    this.shouldFailSync = shouldFail;
  }

  async createOrganization(_name: string, _adminToken: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getOrganization(_name: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async deleteOrganization(_name: string, _adminToken: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async authenticateWithOAuth(_code: string, _clientId?: string, _clientSecret?: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async refreshToken(_refreshToken: string, _clientId?: string, _clientSecret?: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async validateToken(_token: string): Promise<boolean> {
    return true;
  }

  async createRepository(_orgName: string, _repoName: string, _config: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async forkRepository(_owner: string, _repo: string, _targetOwner: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getRepository(_owner: string, _repo: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async syncFork(_owner: string, _repo: string, _upstreamOwner: string, _upstreamRepo: string): Promise<any> {
    if (this.shouldFailSync) {
      throw new SyncServiceError('Failed to sync fork');
    }
    if (!this.mockSyncResult) {
      throw new SyncServiceError('Mock sync result not set');
    }
    return this.mockSyncResult;
  }

  async createPullRequest(_owner: string, _repo: string, _pr: any): Promise<any> {
    throw new Error('Not implemented');
  }
}

/**
 * Mock ForkRepository for property tests
 */
class MockForkRepository implements Pick<IForkRepository, 'create' | 'findById' | 'findByAssignmentId' | 'findByStudentId' | 'findByAssignmentAndStudent' | 'update' | 'delete'> {
  private forks: Map<string, Fork> = new Map();

  setForks(forks: Fork[]) {
    this.forks.clear();
    for (const fork of forks) {
      this.forks.set(fork.id, { ...fork });
    }
  }

  async create(fork: Fork): Promise<Fork> {
    this.forks.set(fork.id, { ...fork });
    return { ...fork };
  }

  async findById(id: string): Promise<Fork | null> {
    const fork = this.forks.get(id);
    return fork ? { ...fork } : null;
  }

  async findByAssignmentId(assignmentId: string): Promise<Fork[]> {
    return Array.from(this.forks.values())
      .filter((f) => f.assignmentId === assignmentId)
      .map((f) => ({ ...f }));
  }

  async findByStudentId(studentId: string): Promise<Fork[]> {
    return Array.from(this.forks.values())
      .filter((f) => f.studentId === studentId)
      .map((f) => ({ ...f }));
  }

  async findByAssignmentAndStudent(assignmentId: string, studentId: string): Promise<Fork | null> {
    const fork = Array.from(this.forks.values()).find(
      (f) => f.assignmentId === assignmentId && f.studentId === studentId
    );
    return fork ? { ...fork } : null;
  }

  async update(id: string, updates: Partial<Fork>): Promise<Fork> {
    const existing = this.forks.get(id);
    if (!existing) {
      throw new Error(`Fork with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
    };

    this.forks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.forks.delete(id);
  }
}

/**
 * Mock AssignmentRepository for property tests
 */
class MockAssignmentRepository implements Pick<IAssignmentRepository, 'create' | 'findById' | 'findByCourseId' | 'update' | 'delete'> {
  private assignments: Map<string, Assignment> = new Map();

  setAssignments(assignments: Assignment[]) {
    this.assignments.clear();
    for (const assignment of assignments) {
      this.assignments.set(assignment.id, { ...assignment });
    }
  }

  async create(assignment: Assignment): Promise<Assignment> {
    this.assignments.set(assignment.id, { ...assignment });
    return { ...assignment };
  }

  async findById(id: string): Promise<Assignment | null> {
    const assignment = this.assignments.get(id);
    return assignment ? { ...assignment } : null;
  }

  async findByCourseId(courseId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values())
      .filter((a) => a.courseId === courseId)
      .map((a) => ({ ...a }));
  }

  async update(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    const existing = this.assignments.get(id);
    if (!existing) {
      throw new Error(`Assignment with id ${id} not found`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.assignments.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.assignments.delete(id);
  }
}

// Feature: github-classroom-support, Property 24: Fork Synchronization with Upstream
test('Property 24: Fork Synchronization with Upstream', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        forkId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes(' ') && !s.startsWith('/')),
        syncSuccess: fc.boolean(),
        hasConflicts: fc.boolean(),
      }),
      async (configData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();

        const mockAssignment: Assignment = {
          id: configData.assignmentId as string,
          courseId: 'course-' + configData.assignmentId,
          name: 'Test Assignment',
          repositoryName: configData.repoName as string,
          repositoryUrl: `https://github.com/test-org/${configData.repoName}`,
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        mockAssignmentRepository.setAssignments([mockAssignment]);

        const mockFork: Fork = {
          id: configData.forkId as string,
          assignmentId: configData.assignmentId as string,
          studentId: configData.studentId as string,
          githubRepoUrl: `https://github.com/student-${configData.studentId}/${configData.repoName}`,
          githubRepoId: 'repo-' + configData.studentId,
          forkedAt: new Date(),
          status: 'active',
          environmentSetup: {
            status: 'completed',
          },
        };

        mockForkRepository.setForks([mockFork]);

        const mockGitHubClient = new MockGitHubClient();
        const syncResult = {
          success: configData.syncSuccess,
          conflicts: configData.hasConflicts ? ['src/app.ts'] : [],
          message: configData.syncSuccess ? 'Successfully synced fork' : 'Merge conflicts need to be resolved manually',
        };
        mockGitHubClient.setMockSyncResult(syncResult);

        const syncService = new SyncService(
          mockGitHubClient,
          mockForkRepository,
          mockAssignmentRepository
        );

        // Execute
        const result = await syncService.syncFork(configData.forkId as string);

        // Verify
        expect(result).toBeDefined();
        expect(result.success).toBe(configData.syncSuccess);
        if (configData.hasConflicts) {
          expect(result.conflicts).toHaveLength(1);
        } else {
          expect(result.conflicts).toHaveLength(0);
        }
      }
    ),
    { numRuns: 100, seed: 0 }
  );
}, 10000);
