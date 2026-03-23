/**
 * Property-based tests for GradingService
 * Using fast-check for property-based testing
 */

import { GradingService, GradingServiceError } from './GradingService';
import { IGitHubClient } from '../types/services';
import { IAssignmentRepository, IForkRepository, ISubmissionRepository } from '../types/repositories';
import { Submission, Grade, Fork, Assignment } from '../types/models';
import * as fc from 'fast-check';

/** Segments safe for `github.com/owner/repo` URLs used in mocks (no `/`). */
const githubSlugArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,98}$/);

// Mock GitHubClient for property tests
class MockGitHubClient implements Pick<IGitHubClient, 'createOrganization' | 'getOrganization' | 'deleteOrganization' | 'authenticateWithOAuth' | 'refreshToken' | 'validateToken' | 'createRepository' | 'forkRepository' | 'getRepository' | 'syncFork' | 'createPullRequest'> {
  private mockPR: any | null = null;
  private shouldFailPR = false;

  setMockPR(pr: any) {
    this.mockPR = pr;
  }

  setShouldFailPR(shouldFail: boolean) {
    this.shouldFailPR = shouldFail;
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
    throw new Error('Not implemented');
  }

  async createPullRequest(_owner: string, _repo: string, _pr: any): Promise<any> {
    if (this.shouldFailPR) {
      throw new GradingServiceError('Failed to create pull request');
    }
    if (!this.mockPR) {
      throw new GradingServiceError('Mock PR not set');
    }
    return this.mockPR;
  }
}

// Mock AssignmentRepository for property tests
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

// Mock ForkRepository for property tests
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

// Mock SubmissionRepository for property tests
class MockSubmissionRepository implements Pick<ISubmissionRepository, 'create' | 'findById' | 'findByForkId' | 'findByAssignmentId' | 'findByStudentAndCourse' | 'update' | 'delete'> {
  private submissions: Map<string, Submission> = new Map();

  setSubmissions(submissions: Submission[]) {
    this.submissions.clear();
    for (const submission of submissions) {
      this.submissions.set(submission.id, { ...submission });
    }
  }

  async create(submission: Submission): Promise<Submission> {
    this.submissions.set(submission.id, { ...submission });
    return { ...submission };
  }

  async findById(id: string): Promise<Submission | null> {
    const submission = this.submissions.get(id);
    return submission ? { ...submission } : null;
  }

  async findByForkId(forkId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.forkId === forkId)
      .map((s) => ({ ...s }));
  }

  async findByAssignmentId(assignmentId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.assignmentId === assignmentId)
      .map((s) => ({ ...s }));
  }

  async findByStudentAndCourse(studentId: string, _courseId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.studentId === studentId)
      .map((s) => ({ ...s }));
  }

  async update(id: string, updates: Partial<Submission>): Promise<Submission> {
    const existing = this.submissions.get(id);
    if (!existing) {
      throw new Error(`Submission with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
    };

    this.submissions.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.submissions.delete(id);
  }
}

// Feature: github-classroom-support, Property 17: Submission Pull Request Creation
test('Property 17: Submission Pull Request Creation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: githubSlugArb,
        repoName: githubSlugArb,
        allowLateSubmissions: fc.boolean(),
        deadline: fc.option(fc.date()),
      }),
      async (configData) => {
        const deadline = configData.deadline;
        if (
          deadline != null &&
          !configData.allowLateSubmissions &&
          deadline.getTime() < Date.now()
        ) {
          return;
        }

        // Setup
        const mockPR = {
          id: 123,
          number: 42,
          url: `https://github.com/test-org/${configData.repoName}/pull/42`,
          title: 'Test PR',
          state: 'open',
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockPR(mockPR);

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();
        const mockSubmissionRepository = new MockSubmissionRepository();

        const assignment: Assignment = {
          id: configData.assignmentId as string,
          courseId: 'course-' + configData.assignmentId,
          name: 'Test Assignment',
          repositoryName: configData.repoName as string,
          repositoryUrl: `https://github.com/test-org/${configData.repoName}`,
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: configData.allowLateSubmissions,
          deadline: configData.deadline || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        mockAssignmentRepository.setAssignments([assignment]);

        const fork: Fork = {
          id: 'fork-' + configData.studentId,
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

        mockForkRepository.setForks([fork]);

        const gradingService = new GradingService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository,
          mockSubmissionRepository
        );

        // Execute
        const submission = await gradingService.submitAssignment(
          'fork-' + configData.studentId,
          configData.studentId as string
        );

        // Verify
        expect(submission).toBeDefined();
        expect(submission.forkId).toBe('fork-' + configData.studentId);
        expect(submission.studentId).toBe(configData.studentId);
        expect(submission.pullRequestUrl).toBe(mockPR.url);
        expect(submission.status).toBe('pending');
        expect(submission.id).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 18: Pre-Submission Validation
test('Property 18: Pre-Submission Validation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: githubSlugArb,
        repoName: githubSlugArb,
        allowLateSubmissions: fc.boolean(),
        deadline: fc.option(fc.date()),
        forkStatus: fc.constantFrom<'active' | 'submitted' | 'graded'>('active', 'submitted', 'graded'),
      }),
      async (configData) => {
        const deadline = configData.deadline;
        if (
          deadline != null &&
          !configData.allowLateSubmissions &&
          deadline.getTime() < Date.now()
        ) {
          return;
        }

        // Setup
        const mockPR = {
          id: 123,
          number: 42,
          url: `https://github.com/test-org/${configData.repoName}/pull/42`,
          title: 'Test PR',
          state: 'open',
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockPR(mockPR);

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();
        const mockSubmissionRepository = new MockSubmissionRepository();

        const assignment: Assignment = {
          id: configData.assignmentId as string,
          courseId: 'course-' + configData.assignmentId,
          name: 'Test Assignment',
          repositoryName: configData.repoName as string,
          repositoryUrl: `https://github.com/test-org/${configData.repoName}`,
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: configData.allowLateSubmissions,
          deadline: configData.deadline || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        mockAssignmentRepository.setAssignments([assignment]);

        const fork: Fork = {
          id: 'fork-' + configData.studentId,
          assignmentId: configData.assignmentId as string,
          studentId: configData.studentId as string,
          githubRepoUrl: `https://github.com/student-${configData.studentId}/${configData.repoName}`,
          githubRepoId: 'repo-' + configData.studentId,
          forkedAt: new Date(),
          status: configData.forkStatus,
          environmentSetup: {
            status: 'completed',
          },
        };

        mockForkRepository.setForks([fork]);

        const gradingService = new GradingService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository,
          mockSubmissionRepository
        );

        // Execute and verify
        if (configData.forkStatus === 'active') {
          // Should succeed for active fork
          const submission = await gradingService.submitAssignment(
            'fork-' + configData.studentId,
            configData.studentId as string
          );
          expect(submission).toBeDefined();
        } else {
          // Should fail for non-active fork
          await expect(
            gradingService.submitAssignment('fork-' + configData.studentId, configData.studentId as string)
          ).rejects.toThrow(GradingServiceError);
        }
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 19: Grading Data Completeness
test('Property 19: Grading Data Completeness', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        submissionId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: githubSlugArb,
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        score: fc.integer({ min: 0, max: 100 }),
        maxScore: fc.integer({ min: 1, max: 1000 }),
        gradedBy: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      }),
      async (configData) => {
        // Setup
        const mockGitHubClient = new MockGitHubClient();

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();
        const mockSubmissionRepository = new MockSubmissionRepository();

        const submission: Submission = {
          id: configData.submissionId as string,
          forkId: 'fork-' + configData.studentId,
          studentId: configData.studentId as string,
          assignmentId: configData.assignmentId as string,
          submittedAt: new Date(),
          pullRequestUrl: 'https://github.com/test-org/test-repo/pull/42',
          pullRequestNumber: 42,
          status: 'pending',
          grade: undefined,
          feedback: [],
        };

        mockSubmissionRepository.setSubmissions([submission]);

        const fork: Fork = {
          id: 'fork-' + configData.studentId,
          assignmentId: configData.assignmentId as string,
          studentId: configData.studentId as string,
          githubRepoUrl: `https://github.com/student-${configData.studentId}/r`,
          githubRepoId: 'repo-' + configData.studentId,
          forkedAt: new Date(),
          status: 'submitted',
          environmentSetup: { status: 'completed' },
        };
        mockForkRepository.setForks([fork]);

        const gradingService = new GradingService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository,
          mockSubmissionRepository
        );

        const grade: Grade = {
          score: configData.score,
          maxScore: configData.maxScore,
          gradedBy: configData.gradedBy as string,
          gradedAt: new Date(),
          comments: 'Good work!',
        };

        // Execute
        await gradingService.gradeSubmission(configData.submissionId as string, grade);

        // Verify
        const retrievedSubmission = await mockSubmissionRepository.findById(configData.submissionId as string);
        expect(retrievedSubmission).toBeDefined();
        expect(retrievedSubmission?.grade).toBeDefined();
        expect(retrievedSubmission?.grade?.score).toBe(configData.score);
        expect(retrievedSubmission?.grade?.maxScore).toBe(configData.maxScore);
        expect(retrievedSubmission?.grade?.gradedBy).toBe(configData.gradedBy);
        expect(retrievedSubmission?.status).toBe('graded');
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 8: Late Submission Timestamp Recording
test('Property 8: Late Submission Timestamp Recording', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        studentId: githubSlugArb,
        repoName: githubSlugArb,
        allowLateSubmissions: fc.constantFrom(true, false),
        deadline: fc.date(),
        submissionTime: fc.date(),
      }),
      async (configData) => {
        if (
          !configData.allowLateSubmissions &&
          configData.deadline.getTime() < Date.now()
        ) {
          return;
        }

        // Setup
        const mockPR = {
          id: 123,
          number: 42,
          url: `https://github.com/test-org/${configData.repoName}/pull/42`,
          title: 'Test PR',
          state: 'open',
        };

        const mockGitHubClient = new MockGitHubClient();
        mockGitHubClient.setMockPR(mockPR);

        const mockAssignmentRepository = new MockAssignmentRepository();
        const mockForkRepository = new MockForkRepository();
        const mockSubmissionRepository = new MockSubmissionRepository();

        const assignment: Assignment = {
          id: configData.assignmentId as string,
          courseId: 'course-' + configData.assignmentId,
          name: 'Test Assignment',
          repositoryName: configData.repoName as string,
          repositoryUrl: `https://github.com/test-org/${configData.repoName}`,
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: configData.allowLateSubmissions,
          deadline: configData.deadline,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        mockAssignmentRepository.setAssignments([assignment]);

        const fork: Fork = {
          id: 'fork-' + configData.studentId,
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

        mockForkRepository.setForks([fork]);

        const gradingService = new GradingService(
          mockGitHubClient,
          mockAssignmentRepository,
          mockForkRepository,
          mockSubmissionRepository
        );

        // Execute
        const submission = await gradingService.submitAssignment(
          'fork-' + configData.studentId,
          configData.studentId as string
        );

        // Verify submission timestamp is recorded
        expect(submission.submittedAt).toBeDefined();
        expect(submission.submittedAt instanceof Date).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
}, 10000);
