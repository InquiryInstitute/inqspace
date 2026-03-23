/**
 * Unit tests for EnvironmentSetupService
 */

import { EnvironmentSetupService, EnvironmentSetupError, SetupProgress } from './EnvironmentSetupService';
import { IDevcontainerParser } from '../types/services';
import { IForkRepository } from '../types/repositories';
import { Fork, DevcontainerConfig } from '../types/models';

// Mock DevcontainerParser
class MockDevcontainerParser implements Pick<IDevcontainerParser, 'parse' | 'validate' | 'extractDependencies' | 'getImage' | 'getFeatures'> {
  private mockConfig: DevcontainerConfig | null = null;
  private shouldFailParse = false;

  setMockConfig(config: DevcontainerConfig) {
    this.mockConfig = config;
  }

  setShouldFailParse(shouldFail: boolean) {
    this.shouldFailParse = shouldFail;
  }

  async parse(_content: string): Promise<DevcontainerConfig> {
    if (this.shouldFailParse) {
      throw new Error('Failed to parse devcontainer');
    }
    if (!this.mockConfig) {
      throw new Error('Mock config not set');
    }
    return this.mockConfig;
  }

  async validate(_config: DevcontainerConfig): Promise<any> {
    return { valid: true, errors: [] };
  }

  extractDependencies(_config: DevcontainerConfig): string[] {
    return [];
  }

  getImage(_config: DevcontainerConfig): string {
    return _config.image || 'node:18';
  }

  getFeatures(_config: DevcontainerConfig): any[] {
    return [];
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

describe('EnvironmentSetupService', () => {
  let service: EnvironmentSetupService;
  let mockDevcontainerParser: MockDevcontainerParser;
  let mockForkRepository: MockForkRepository;

  const mockFork: Fork = {
    id: 'fork-123',
    assignmentId: 'assignment-123',
    studentId: 'student-123',
    githubRepoUrl: 'https://github.com/student-user/assignment-1',
    githubRepoId: 'repo-456',
    forkedAt: new Date(),
    status: 'active',
    environmentSetup: {
      status: 'pending',
    },
  };

  const mockDevcontainerConfig: DevcontainerConfig = {
    image: 'node:18',
    postCreateCommand: 'npm install',
    forwardPorts: [3000],
  };

  beforeEach(() => {
    mockDevcontainerParser = new MockDevcontainerParser();
    mockForkRepository = new MockForkRepository();
    service = new EnvironmentSetupService(mockForkRepository);
  });

  describe('setupEnvironment', () => {
    beforeEach(() => {
      mockForkRepository.setForks([mockFork]);
      mockDevcontainerParser.setMockConfig(mockDevcontainerConfig);
    });

    it('should setup environment for fork', async () => {
      const progressEvents: SetupProgress[] = [];
      const progressCallback = (progress: SetupProgress) => {
        progressEvents.push(progress);
      };

      // Create a new service instance with mocked cloneRepository
      const mockService = new EnvironmentSetupService(mockForkRepository);
      (mockService as any).cloneRepository = jest.fn().mockResolvedValue('/tmp/test-fork');

      await mockService.setupEnvironment('fork-123', progressCallback);

      expect(progressEvents).toHaveLength(4);
      expect(progressEvents[0].stage).toBe('cloning');
      expect(progressEvents[1].stage).toBe('installing');
      expect(progressEvents[2].stage).toBe('configuring');
      expect(progressEvents[3].stage).toBe('completed');
    });

    it('should handle setup failure', async () => {
      const progressEvents: SetupProgress[] = [];
      const progressCallback = (progress: SetupProgress) => {
        progressEvents.push(progress);
      };

      // Create a new service instance with mocked cloneRepository and parseDevcontainer
      const mockService = new EnvironmentSetupService(mockForkRepository);
      (mockService as any).cloneRepository = jest.fn().mockResolvedValue('/tmp/test-fork');
      (mockService as any).parseDevcontainer = jest.fn().mockRejectedValue(new Error('Failed to parse devcontainer'));

      await expect(mockService.setupEnvironment('fork-123', progressCallback)).rejects.toThrow();

      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0].stage).toBe('cloning');
      expect(progressEvents[1].stage).toBe('installing');
      expect(progressEvents[2].stage).toBe('failed');
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(service.setupEnvironment('')).rejects.toThrow(EnvironmentSetupError);
    });

    it('should throw error if fork not found', async () => {
      await expect(service.setupEnvironment('non-existent-fork')).rejects.toThrow(
        EnvironmentSetupError
      );
    });
  });

  describe('cancelSetup', () => {
    beforeEach(() => {
      mockForkRepository.setForks([mockFork]);
    });

    it('should cancel environment setup', async () => {
      await service.cancelSetup('fork-123');

      const fork = await mockForkRepository.findById('fork-123');
      expect(fork?.environmentSetup.status).toBe('pending');
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(service.cancelSetup('')).rejects.toThrow(EnvironmentSetupError);
    });

    it('should throw error if fork not found', async () => {
      await expect(service.cancelSetup('non-existent-fork')).rejects.toThrow(
        EnvironmentSetupError
      );
    });
  });

  describe('getSetupStatus', () => {
    beforeEach(() => {
      mockForkRepository.setForks([mockFork]);
    });

    it('should get setup status for fork', async () => {
      const status = await service.getSetupStatus('fork-123');

      expect(status).toBeDefined();
      expect(status.stage).toBe('pending');
      expect(status.percentage).toBe(0);
    });

    it('should return correct status for completed setup', async () => {
      const completedFork: Fork = {
        ...mockFork,
        environmentSetup: {
          status: 'completed',
        },
      };
      mockForkRepository.setForks([completedFork]);

      const status = await service.getSetupStatus('fork-123');

      expect(status.stage).toBe('completed');
      expect(status.percentage).toBe(100);
    });

    it('should return correct status for failed setup', async () => {
      const failedFork: Fork = {
        ...mockFork,
        environmentSetup: {
          status: 'failed',
          errorMessage: 'Setup failed',
        },
      };
      mockForkRepository.setForks([failedFork]);

      const status = await service.getSetupStatus('fork-123');

      expect(status.stage).toBe('failed');
      expect(status.percentage).toBe(100);
      expect(status.error).toBe('Setup failed');
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(service.getSetupStatus('')).rejects.toThrow(EnvironmentSetupError);
    });

    it('should throw error if fork not found', async () => {
      await expect(service.getSetupStatus('non-existent-fork')).rejects.toThrow(
        EnvironmentSetupError
      );
    });
  });
});
