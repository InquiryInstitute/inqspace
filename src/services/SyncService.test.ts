/**
 * Unit tests for SyncService
 */

import { SyncService, SyncServiceError } from './SyncService';
import { IGitHubClient } from '../types/services';
import { IForkRepository, IAssignmentRepository } from '../types/repositories';
import { Fork, Assignment } from '../types/models';

// Mock GitHubClient
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

// Mock ForkRepository
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

// Mock AssignmentRepository
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

describe('SyncService', () => {
  let syncService: SyncService;
  let mockGitHubClient: MockGitHubClient;
  let mockForkRepository: MockForkRepository;
  let mockAssignmentRepository: MockAssignmentRepository;

  const mockAssignment: Assignment = {
    id: 'assignment-123',
    courseId: 'course-123',
    name: 'Assignment 1: Hello World',
    repositoryName: 'assignment-1',
    repositoryUrl: 'https://github.com/test-org/assignment-1',
    devcontainerPath: '.devcontainer/devcontainer.json',
    visibility: 'private',
    allowLateSubmissions: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    configuration: {
      autoGrading: false,
      requiredFiles: ['main.py', 'README.md'],
      starterCode: true,
    },
  };

  const mockFork: Fork = {
    id: 'fork-123',
    assignmentId: 'assignment-123',
    studentId: 'student-123',
    githubRepoUrl: 'https://github.com/student-user/assignment-1',
    githubRepoId: 'repo-456',
    forkedAt: new Date(),
    status: 'active',
    environmentSetup: {
      status: 'completed',
    },
  };

  beforeEach(() => {
    mockGitHubClient = new MockGitHubClient();
    mockForkRepository = new MockForkRepository();
    mockAssignmentRepository = new MockAssignmentRepository();
    syncService = new SyncService(
      mockGitHubClient,
      mockForkRepository,
      mockAssignmentRepository
    );
  });

  describe('checkForUpdates', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
      mockForkRepository.setForks([mockFork]);
    });

    it('should check for updates in upstream repository', async () => {
      const status = await syncService.checkForUpdates('fork-123');

      expect(status).toBeDefined();
      expect(status.hasUpdates).toBeDefined();
      expect(status.commitCount).toBeDefined();
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(syncService.checkForUpdates('')).rejects.toThrow(SyncServiceError);
    });

    it('should throw error if fork not found', async () => {
      await expect(syncService.checkForUpdates('non-existent-fork')).rejects.toThrow(
        SyncServiceError
      );
    });

    it('should throw error if assignment not found', async () => {
      mockAssignmentRepository.setAssignments([]);
      await expect(syncService.checkForUpdates('fork-123')).rejects.toThrow(
        SyncServiceError
      );
    });
  });

  describe('syncFork', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
      mockForkRepository.setForks([mockFork]);
    });

    it('should sync fork with upstream repository', async () => {
      mockGitHubClient.setMockSyncResult({
        success: true,
        conflicts: [],
        message: 'Successfully synced fork',
      });

      const result = await syncService.syncFork('fork-123');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle merge conflicts', async () => {
      mockGitHubClient.setMockSyncResult({
        success: false,
        conflicts: ['src/app.ts'],
        message: 'Merge conflicts need to be resolved manually',
      });

      const result = await syncService.syncFork('fork-123');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(syncService.syncFork('')).rejects.toThrow(SyncServiceError);
    });

    it('should throw error if fork not found', async () => {
      await expect(syncService.syncFork('non-existent-fork')).rejects.toThrow(
        SyncServiceError
      );
    });

    it('should throw error if sync fails', async () => {
      mockGitHubClient.setShouldFailSync(true);
      await expect(syncService.syncFork('fork-123')).rejects.toThrow(SyncServiceError);
    });
  });

  describe('notifyStudentsOfUpdates', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
      mockForkRepository.setForks([mockFork]);
    });

    it('should notify students of updates', async () => {
      // This should not throw
      await syncService.notifyStudentsOfUpdates('assignment-123');
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(syncService.notifyStudentsOfUpdates('')).rejects.toThrow(
        SyncServiceError
      );
    });

    it('should throw error if assignment not found', async () => {
      mockAssignmentRepository.setAssignments([]);
      await expect(syncService.notifyStudentsOfUpdates('non-existent-assignment')).rejects.toThrow(
        SyncServiceError
      );
    });
  });

  describe('resolveMergeConflicts', () => {
    beforeEach(() => {
      mockForkRepository.setForks([mockFork]);
    });

    it('should resolve merge conflicts', async () => {
      const resolution = {
        files: [{ path: 'src/app.ts', resolution: 'keep-ours' }],
        strategy: 'ours' as const,
      };

      await syncService.resolveMergeConflicts('fork-123', resolution);
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(
        syncService.resolveMergeConflicts('', { files: [], strategy: 'ours' })
      ).rejects.toThrow(SyncServiceError);
    });

    it('should throw error if fork not found', async () => {
      await expect(
        syncService.resolveMergeConflicts('non-existent-fork', { files: [], strategy: 'ours' })
      ).rejects.toThrow(SyncServiceError);
    });

    it('should throw error if resolution files are empty', async () => {
      await expect(
        syncService.resolveMergeConflicts('fork-123', { files: [], strategy: 'ours' })
      ).rejects.toThrow(SyncServiceError);
    });
  });
});
