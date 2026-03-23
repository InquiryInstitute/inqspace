/**
 * Unit tests for GradingService
 */

import { GradingService, GradingServiceError } from './GradingService';
import { IGitHubClient } from '../types/services';
import { IAssignmentRepository, IForkRepository, ISubmissionRepository } from '../types/repositories';
import { Submission, Grade, Feedback, Fork, Assignment } from '../types/models';

// Mock GitHubClient
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

// Mock SubmissionRepository
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

describe('GradingService', () => {
  let gradingService: GradingService;
  let mockGitHubClient: MockGitHubClient;
  let mockAssignmentRepository: MockAssignmentRepository;
  let mockForkRepository: MockForkRepository;
  let mockSubmissionRepository: MockSubmissionRepository;

  const mockPR = {
    id: 123,
    number: 42,
    url: 'https://github.com/test-org/test-repo/pull/42',
    title: 'Test PR',
    state: 'open',
  };

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

  const mockSubmission: Submission = {
    id: 'submission-123',
    forkId: 'fork-123',
    studentId: 'student-123',
    assignmentId: 'assignment-123',
    submittedAt: new Date(),
    pullRequestUrl: 'https://github.com/test-org/assignment-1/pull/42',
    pullRequestNumber: 42,
    status: 'pending',
    grade: undefined,
    feedback: [],
  };

  beforeEach(() => {
    mockGitHubClient = new MockGitHubClient();
    mockGitHubClient.setMockPR(mockPR);
    mockAssignmentRepository = new MockAssignmentRepository();
    mockForkRepository = new MockForkRepository();
    mockSubmissionRepository = new MockSubmissionRepository();
    gradingService = new GradingService(
      mockGitHubClient,
      mockAssignmentRepository,
      mockForkRepository,
      mockSubmissionRepository
    );
  });

  describe('submitAssignment', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
      mockForkRepository.setForks([mockFork]);
    });

    it('should create submission with pull request', async () => {
      const submission = await gradingService.submitAssignment('fork-123', 'student-123');

      expect(submission).toBeDefined();
      expect(submission.forkId).toBe('fork-123');
      expect(submission.studentId).toBe('student-123');
      expect(submission.pullRequestUrl).toBe('https://github.com/test-org/test-repo/pull/42');
      expect(submission.status).toBe('pending');
    });

    it('should throw error if fork ID is empty', async () => {
      await expect(gradingService.submitAssignment('', 'student-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if student ID is empty', async () => {
      await expect(gradingService.submitAssignment('fork-123', '')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if fork not found', async () => {
      await expect(gradingService.submitAssignment('non-existent-fork', 'student-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if assignment not found', async () => {
      mockAssignmentRepository.setAssignments([]);
      await expect(gradingService.submitAssignment('fork-123', 'student-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if fork is not active', async () => {
      const submittedFork: Fork = {
        ...mockFork,
        status: 'submitted',
      };
      mockForkRepository.setForks([submittedFork]);

      await expect(gradingService.submitAssignment('fork-123', 'student-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if PR creation fails', async () => {
      mockGitHubClient.setShouldFailPR(true);

      await expect(gradingService.submitAssignment('fork-123', 'student-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should update fork status to submitted', async () => {
      await gradingService.submitAssignment('fork-123', 'student-123');

      const updatedFork = await mockForkRepository.findById('fork-123');
      expect(updatedFork?.status).toBe('submitted');
    });
  });

  describe('getSubmission', () => {
    beforeEach(() => {
      mockSubmissionRepository.setSubmissions([mockSubmission]);
    });

    it('should return submission by ID', async () => {
      const submission = await gradingService.getSubmission('submission-123');

      expect(submission).toBeDefined();
      expect(submission.id).toBe('submission-123');
      expect(submission.forkId).toBe('fork-123');
    });

    it('should throw error if submission ID is empty', async () => {
      await expect(gradingService.getSubmission('')).rejects.toThrow(GradingServiceError);
    });

    it('should throw error if submission not found', async () => {
      await expect(gradingService.getSubmission('non-existent-submission')).rejects.toThrow(
        GradingServiceError
      );
    });
  });

  describe('gradeSubmission', () => {
    beforeEach(() => {
      mockSubmissionRepository.setSubmissions([mockSubmission]);
      mockForkRepository.setForks([mockFork]);
    });

    it('should grade submission', async () => {
      const grade: Grade = {
        score: 85,
        maxScore: 100,
        gradedBy: 'instructor-123',
        gradedAt: new Date(),
        comments: 'Good work!',
      };

      await gradingService.gradeSubmission('submission-123', grade);

      const updatedSubmission = await mockSubmissionRepository.findById('submission-123');
      expect(updatedSubmission?.grade).toBeDefined();
      expect(updatedSubmission?.grade?.score).toBe(85);
      expect(updatedSubmission?.status).toBe('graded');
    });

    it('should throw error if submission ID is empty', async () => {
      const grade: Grade = {
        score: 85,
        maxScore: 100,
        gradedBy: 'instructor-123',
        gradedAt: new Date(),
      };

      await expect(gradingService.gradeSubmission('', grade)).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if submission not found', async () => {
      const grade: Grade = {
        score: 85,
        maxScore: 100,
        gradedBy: 'instructor-123',
        gradedAt: new Date(),
      };

      await expect(gradingService.gradeSubmission('non-existent-submission', grade)).rejects.toThrow(
        GradingServiceError
      );
    });
  });

  describe('addFeedback', () => {
    beforeEach(() => {
      mockSubmissionRepository.setSubmissions([mockSubmission]);
    });

    it('should add feedback to submission', async () => {
      const feedback: Feedback = {
        id: 'feedback-123',
        authorId: 'instructor-123',
        content: 'Great implementation!',
        lineNumber: 10,
        filePath: 'main.py',
        createdAt: new Date(),
      };

      await gradingService.addFeedback('submission-123', feedback);

      const updatedSubmission = await mockSubmissionRepository.findById('submission-123');
      expect(updatedSubmission?.feedback).toHaveLength(1);
      expect(updatedSubmission?.feedback[0].content).toBe('Great implementation!');
    });

    it('should throw error if submission ID is empty', async () => {
      const feedback: Feedback = {
        id: 'feedback-123',
        authorId: 'instructor-123',
        content: 'Great implementation!',
        createdAt: new Date(),
      };

      await expect(gradingService.addFeedback('', feedback)).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if feedback author ID is empty', async () => {
      const feedback: Feedback = {
        id: 'feedback-123',
        authorId: '',
        content: 'Great implementation!',
        createdAt: new Date(),
      };

      await expect(gradingService.addFeedback('submission-123', feedback)).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if feedback content is empty', async () => {
      const feedback: Feedback = {
        id: 'feedback-123',
        authorId: 'instructor-123',
        content: '',
        createdAt: new Date(),
      };

      await expect(gradingService.addFeedback('submission-123', feedback)).rejects.toThrow(
        GradingServiceError
      );
    });
  });

  describe('listSubmissionsByAssignment', () => {
    beforeEach(() => {
      mockSubmissionRepository.setSubmissions([mockSubmission]);
    });

    it('should return submissions for assignment', async () => {
      const submissions = await gradingService.listSubmissionsByAssignment('assignment-123');

      expect(submissions).toHaveLength(1);
      expect(submissions[0].assignmentId).toBe('assignment-123');
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(gradingService.listSubmissionsByAssignment('')).rejects.toThrow(
        GradingServiceError
      );
    });
  });

  describe('getStudentSubmissions', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
      mockSubmissionRepository.setSubmissions([mockSubmission]);
    });

    it('should return student submissions for course', async () => {
      const submissions = await gradingService.getStudentSubmissions('student-123', 'course-123');

      expect(submissions).toHaveLength(1);
      expect(submissions[0].studentId).toBe('student-123');
    });

    it('should throw error if student ID is empty', async () => {
      await expect(gradingService.getStudentSubmissions('', 'course-123')).rejects.toThrow(
        GradingServiceError
      );
    });

    it('should throw error if course ID is empty', async () => {
      await expect(gradingService.getStudentSubmissions('student-123', '')).rejects.toThrow(
        GradingServiceError
      );
    });
  });
});
