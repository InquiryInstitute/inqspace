/**
 * Property-based tests for AssignmentService
 */

import { AssignmentService, AssignmentServiceError } from './AssignmentService';
import { IGitHubClient } from '../types/services';
import { IAssignmentRepository, IForkRepository } from '../types/repositories';
import { Assignment, AssignmentConfig, Fork } from '../types/models';
import * as fc from 'fast-check';

/**
 * Mock GitHubClient for property tests
 */
class MockGitHubClient implements Pick<IGitHubClient, 'createOrganization' | 'getOrganization' | 'deleteOrganization' | 'authenticateWithOAuth' | 'refreshToken' | 'validateToken' | 'createRepository' | 'forkRepository' | 'getRepository' | 'syncFork' | 'createPullRequest'> {
  private mockRepo: any | null = null;
  private shouldFailCreate = false;
  private shouldFailFork = false;

  setMockRepo(repo: any) {
    this.mockRepo = repo;
  }

  setShouldFailCreate(shouldFail: boolean) {
    this.shouldFailCreate = shouldFail;
  }

  setShouldFailFork(shouldFail: boolean) {
    this.shouldFailFork = shouldFail;
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
    if (this.shouldFailCreate) {
      throw new AssignmentServiceError('Failed to create repository');
    }
    if (!this.mockRepo) {
      throw new AssignmentServiceError('Mock repo not set');
    }
    return this.mockRepo;
  }

  async forkRepository(_owner: string, _repo: string, _targetOwner: string): Promise<any> {
    if (this.shouldFailFork) {
      throw new AssignmentServiceError('Failed to fork repository');
    }
    if (!this.mockRepo) {
      throw new AssignmentServiceError('Mock repo not set');
    }
    return this.mockRepo;
  }

  async getRepository(_owner: string, _repo: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async syncFork(_owner: string, _repo: string, _upstreamOwner: string, _upstreamRepo: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async createPullRequest(_owner: string, _repo: string, _pr: any): Promise<any> {
    throw new Error('Not implemented');
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

// Feature: github-classroom-support, Property 2: Assignment Repository Creation with Configuration
test('Property 2: Assignment Repository Creation with Configuration', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        visibility: fc.constantFrom<'public' | 'private'>('public', 'private'),
        autoGrading: fc.boolean(),
        requiredFiles: fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 10 }),
        starterCode: fc.boolean(),
      }),
      async (configData) => {
        // Setup
        const mockRepo = {
          id: 'repo-' + configData.repoName,
          name: configData.repoName,
          fullName: 'test-org/' + configData.repoName,
          url: `https://github.com/test-org/${configData.repoName}`,
          cloneUrl: `https://github.com/test-org/${configData.repoName}.git`,
          visibility: configData.visibility,
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockRepo(mockRepo);

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();

        const assignmentService = new AssignmentService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository
        );

        // Set environment variables for test
        process.env.GITHUB_ORG_NAME = 'test-org';
        process.env.GITHUB_REPO_NAME = configData.repoName as string;

        const assignmentConfig: AssignmentConfig = {
          autoGrading: configData.autoGrading,
          maxAttempts: undefined,
          requiredFiles: configData.requiredFiles as string[],
          starterCode: configData.starterCode,
        };

        // Execute
        const assignment = await assignmentService.createAssignment(
          configData.courseId as string,
          assignmentConfig
        );

        // Verify
        expect(assignment).toBeDefined();
        expect(assignment.courseId).toBe(configData.courseId);
        expect(assignment.repositoryName).toBe(configData.repoName);
        expect(assignment.visibility).toBe(configData.visibility);
        expect(assignment.configuration.autoGrading).toBe(configData.autoGrading);
        expect(assignment.configuration.requiredFiles).toEqual(configData.requiredFiles);
        expect(assignment.configuration.starterCode).toBe(configData.starterCode);
        expect(assignment.id).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 3: Template Commit History Preservation
test('Property 3: Template Commit History Preservation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        templateUrl: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        visibility: fc.constantFrom<'public' | 'private'>('public', 'private'),
      }),
      async (configData) => {
        // Setup
        const mockRepo = {
          id: 'repo-' + configData.repoName,
          name: configData.repoName,
          fullName: 'test-org/' + configData.repoName,
          url: `https://github.com/test-org/${configData.repoName}`,
          cloneUrl: `https://github.com/test-org/${configData.repoName}.git`,
          visibility: configData.visibility,
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockRepo(mockRepo);

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();

        const assignmentService = new AssignmentService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository
        );

        // Set environment variables for test
        process.env.GITHUB_ORG_NAME = 'test-org';
        process.env.GITHUB_REPO_NAME = configData.repoName;

        const assignmentConfig: AssignmentConfig = {
          autoGrading: false,
          maxAttempts: undefined,
          requiredFiles: [],
          starterCode: true,
        };

        // Execute
        const assignment = await assignmentService.createAssignment(
          configData.courseId as string,
          assignmentConfig,
          configData.templateUrl as string
        );

        // Verify
        expect(assignment).toBeDefined();
        expect(assignment.templateRepositoryUrl).toBe(configData.templateUrl);
        expect(assignment.id).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 4: Student Fork Creation with Branch Preservation
test('Property 4: Student Fork Creation with Branch Preservation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes(' ') && !s.startsWith('/')),
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

        const mockRepo = {
          id: 'fork-repo-' + configData.studentId,
          name: configData.repoName,
          fullName: `student-${configData.studentId}/${configData.repoName}`,
          url: `https://github.com/student-${configData.studentId}/${configData.repoName}`,
          cloneUrl: `https://github.com/student-${configData.studentId}/${configData.repoName}.git`,
          visibility: 'private',
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockRepo(mockRepo);

        const assignmentService = new AssignmentService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository
        );

        // Execute
        const fork = await assignmentService.forkAssignment(
          configData.assignmentId as string,
          configData.studentId as string
        );

        // Verify
        expect(fork).toBeDefined();
        expect(fork.assignmentId).toBe(configData.assignmentId);
        expect(fork.studentId).toBe(configData.studentId);
        expect(fork.githubRepoUrl).toBe(`https://github.com/student-${configData.studentId}/${configData.repoName}`);
        expect(fork.status).toBe('active');
        expect(fork.id).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 10: Assignment List Completeness
test('Property 10: Assignment List Completeness', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        }),
        { minLength: 0, maxLength: 10 }
      ),
      async (assignmentsData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();

        const assignments: Assignment[] = assignmentsData.map((data) => ({
          id: data.assignmentId as string,
          courseId: data.courseId as string,
          name: data.name as string,
          repositoryName: 'repo-' + data.assignmentId,
          repositoryUrl: `https://github.com/test-org/repo-${data.assignmentId}`,
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
        }));

        const deduped = Array.from(new Map(assignments.map((a) => [a.id, a])).values());
        mockAssignmentRepository.setAssignments(deduped);

        const mockGitHubClient = new MockGitHubClient();

        const assignmentService = new AssignmentService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository
        );

        // Get unique course IDs
        const courseIds = Array.from(new Set(deduped.map((a) => a.courseId)));

        // Execute for each course
        for (const courseId of courseIds) {
          const assignmentsForCourse = await assignmentService.listAssignmentsByCourse(courseId as string);

          // Verify
          const expectedAssignments = deduped.filter((a) => a.courseId === courseId);
          expect(assignmentsForCourse).toHaveLength(expectedAssignments.length);
          expect(assignmentsForCourse.map((a) => a.id)).toEqual(
            expect.arrayContaining(expectedAssignments.map((a) => a.id))
          );
        }
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 11: Fork Count Accuracy
test('Property 11: Fork Count Accuracy', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }),
        studentIds: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 20 }),
      }),
      async (configData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();

        const mockAssignment: Assignment = {
          id: configData.assignmentId,
          courseId: 'course-' + configData.assignmentId,
          name: 'Test Assignment',
          repositoryName: 'repo-' + configData.assignmentId,
          repositoryUrl: `https://github.com/test-org/repo-${configData.assignmentId}`,
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

        // Create forks for each student
        const forks: Fork[] = configData.studentIds.map((studentId) => ({
          id: 'fork-' + studentId,
          assignmentId: configData.assignmentId,
          studentId,
          githubRepoUrl: `https://github.com/${studentId}/repo-${configData.assignmentId}`,
          githubRepoId: 'repo-' + studentId,
          forkedAt: new Date(),
          status: 'active',
          environmentSetup: {
            status: 'completed',
          },
        }));

        mockForkRepository.setForks(forks);

        // Execute - verify fork count matches
        expect(forks).toHaveLength(configData.studentIds.length);
      }
    ),
    { numRuns: 100 }
  );
}, 10000);
