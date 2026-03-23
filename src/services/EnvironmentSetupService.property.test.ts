/**
 * Property-based tests for EnvironmentSetupService
 */

import { EnvironmentSetupService, SetupProgress } from './EnvironmentSetupService';
import { IForkRepository } from '../types/repositories';
import { Fork, DevcontainerConfig } from '../types/models';
import * as fc from 'fast-check';

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

// Feature: github-classroom-support, Property 15: Environment Setup with Dependencies
test('Property 15: Environment Setup with Dependencies', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        forkId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes(' ') && !s.startsWith('/')),
        image: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        hasPostCreateCommand: fc.boolean(),
        hasPostStartCommand: fc.boolean(),
        hasExtensions: fc.boolean(),
      }),
      async (configData) => {
        // Setup
        const mockForkRepository = new MockForkRepository();

        const mockFork: Fork = {
          id: configData.forkId as string,
          assignmentId: 'assignment-' + configData.forkId,
          studentId: configData.studentId as string,
          githubRepoUrl: `https://github.com/student-${configData.studentId}/${configData.repoName}`,
          githubRepoId: 'repo-' + configData.studentId,
          forkedAt: new Date(),
          status: 'active',
          environmentSetup: {
            status: 'pending',
          },
        };

        mockForkRepository.setForks([mockFork]);

        const service = new EnvironmentSetupService(mockForkRepository);

        // Mock the cloneRepository method
        (service as any).cloneRepository = jest.fn().mockResolvedValue('/tmp/test-fork');

        // Mock the parseDevcontainer method
        const devcontainerConfig: DevcontainerConfig = {
          image: configData.image as string,
          postCreateCommand: configData.hasPostCreateCommand ? 'npm install' : undefined,
          postStartCommand: configData.hasPostStartCommand ? 'echo "started"' : undefined,
          customizations: configData.hasExtensions
            ? {
                vscode: {
                  extensions: ['ms-vscode.node-debug', 'ms-vscode.vscode-typescript'],
                },
              }
            : undefined,
          forwardPorts: [3000],
        };
        (service as any).parseDevcontainer = jest.fn().mockResolvedValue(devcontainerConfig);

        // Mock the installDependencies and configureEnvironment methods
        (service as any).installDependencies = jest.fn().mockResolvedValue(undefined);
        (service as any).configureEnvironment = jest.fn().mockResolvedValue(undefined);

        // Track progress events
        const progressEvents: SetupProgress[] = [];
        const progressCallback = (progress: SetupProgress) => {
          progressEvents.push(progress);
        };

        // Execute
        await service.setupEnvironment(configData.forkId as string, progressCallback);

        // Verify
        expect(progressEvents).toHaveLength(4);
        expect(progressEvents[0].stage).toBe('cloning');
        expect(progressEvents[1].stage).toBe('installing');
        expect(progressEvents[2].stage).toBe('configuring');
        expect(progressEvents[3].stage).toBe('completed');

        // Verify that the fork status was updated
        const updatedFork = await mockForkRepository.findById(configData.forkId as string);
        expect(updatedFork?.environmentSetup.status).toBe('completed');
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 16: Environment Setup Progress Tracking
test('Property 16: Environment Setup Progress Tracking', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        forkId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes(' ') && !s.startsWith('/')),
      }),
      async (configData) => {
        // Setup
        const mockForkRepository = new MockForkRepository();

        const mockFork: Fork = {
          id: configData.forkId as string,
          assignmentId: 'assignment-' + configData.forkId,
          studentId: configData.studentId as string,
          githubRepoUrl: `https://github.com/student-${configData.studentId}/${configData.repoName}`,
          githubRepoId: 'repo-' + configData.studentId,
          forkedAt: new Date(),
          status: 'active',
          environmentSetup: {
            status: 'pending',
          },
        };

        mockForkRepository.setForks([mockFork]);

        const service = new EnvironmentSetupService(mockForkRepository);

        // Mock the cloneRepository method
        (service as any).cloneRepository = jest.fn().mockResolvedValue('/tmp/test-fork');

        // Mock the parseDevcontainer method
        (service as any).parseDevcontainer = jest.fn().mockResolvedValue({
          image: 'node:18',
          postCreateCommand: 'npm install',
          forwardPorts: [3000],
        });

        // Mock the installDependencies and configureEnvironment methods
        (service as any).installDependencies = jest.fn().mockResolvedValue(undefined);
        (service as any).configureEnvironment = jest.fn().mockResolvedValue(undefined);

        // Track progress events
        const progressEvents: SetupProgress[] = [];
        const progressCallback = (progress: SetupProgress) => {
          progressEvents.push(progress);
        };

        // Execute
        await service.setupEnvironment(configData.forkId as string, progressCallback);

        // Verify progress tracking
        expect(progressEvents).toHaveLength(4);
        expect(progressEvents[0].percentage).toBe(10);
        expect(progressEvents[1].percentage).toBe(40);
        expect(progressEvents[2].percentage).toBe(80);
        expect(progressEvents[3].percentage).toBe(100);

        // Verify that progress events are in order
        expect(progressEvents[0].stage).toBe('cloning');
        expect(progressEvents[1].stage).toBe('installing');
        expect(progressEvents[2].stage).toBe('configuring');
        expect(progressEvents[3].stage).toBe('completed');
      }
    ),
    { numRuns: 100 }
  );
}, 10000);
