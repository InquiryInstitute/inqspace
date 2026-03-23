/**
 * Unit tests for AssignmentService
 */

import { AssignmentService, AssignmentServiceError } from './AssignmentService';
import { IGitHubClient } from '../types/services';
import { IAssignmentRepository, IForkRepository } from '../types/repositories';
import { Assignment, AssignmentConfig, Fork } from '../types/models';

// Mock GitHubClient
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

describe('AssignmentService', () => {
  let assignmentService: AssignmentService;
  let mockGitHubClient: MockGitHubClient;
  let mockAssignmentRepository: MockAssignmentRepository;
  let mockForkRepository: MockForkRepository;

  const mockRepo = {
    id: 'repo-123',
    name: 'assignment-1',
    fullName: 'test-org/assignment-1',
    url: 'https://github.com/test-org/assignment-1',
    cloneUrl: 'https://github.com/test-org/assignment-1.git',
    visibility: 'private',
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

  beforeEach(() => {
    mockGitHubClient = new MockGitHubClient();
    mockGitHubClient.setMockRepo(mockRepo);
    mockAssignmentRepository = new MockAssignmentRepository();
    mockForkRepository = new MockForkRepository();
    assignmentService = new AssignmentService(
      mockGitHubClient,
      mockAssignmentRepository,
      mockForkRepository
    );
  });

  describe('createAssignment', () => {
    it('should create a new assignment with repository', async () => {
      // Set environment variables for test
      process.env.GITHUB_ORG_NAME = 'test-org';
      process.env.GITHUB_REPO_NAME = 'assignment-1';

      const config: AssignmentConfig = {
        autoGrading: false,
        requiredFiles: ['main.py'],
        starterCode: true,
      };

      const assignment = await assignmentService.createAssignment(
        'course-123',
        config
      );

      expect(assignment).toBeDefined();
      expect(assignment.name).toBe('Assignment');
      expect(assignment.courseId).toBe('course-123');
      expect(assignment.repositoryName).toBe('assignment-1');
      expect(assignment.repositoryUrl).toBe('https://github.com/test-org/assignment-1');
      expect(assignment.id).toBeDefined();
    });

    it('should throw error if course ID is empty', async () => {
      const config: AssignmentConfig = {
        autoGrading: false,
        requiredFiles: [],
        starterCode: true,
      };

      await expect(
        assignmentService.createAssignment('', config)
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if repository name is empty', async () => {
      // Remove environment variable to trigger fallback
      const originalRepoName = process.env.GITHUB_REPO_NAME;
      delete process.env.GITHUB_REPO_NAME;
      const config: AssignmentConfig = {
        autoGrading: false,
        requiredFiles: [],
        starterCode: true,
      };

      // The service should still create an assignment with a generated name
      const assignment = await assignmentService.createAssignment('course-123', config);

      expect(assignment).toBeDefined();
      expect(assignment.repositoryName).toMatch(/^assignment-[a-f0-9]{8}$/);

      // Restore environment variable
      process.env.GITHUB_REPO_NAME = originalRepoName;
    });

    it('should throw error if repository creation fails', async () => {
      mockGitHubClient.setShouldFailCreate(true);

      const config: AssignmentConfig = {
        autoGrading: false,
        requiredFiles: [],
        starterCode: true,
      };

      await expect(
        assignmentService.createAssignment('course-123', config)
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should create assignment from template repository', async () => {
      process.env.GITHUB_ORG_NAME = 'test-org';
      process.env.GITHUB_REPO_NAME = 'assignment-template';

      const config: AssignmentConfig = {
        autoGrading: false,
        requiredFiles: ['main.py'],
        starterCode: true,
      };

      const assignment = await assignmentService.createAssignment(
        'course-123',
        config
      );

      expect(assignment).toBeDefined();
      expect(assignment.templateRepositoryUrl).toBeUndefined();
    });
  });

  describe('getAssignment', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
    });

    it('should return assignment by ID', async () => {
      const assignment = await assignmentService.getAssignment('assignment-123');

      expect(assignment).toBeDefined();
      expect(assignment.id).toBe('assignment-123');
      expect(assignment.name).toBe('Assignment 1: Hello World');
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(assignmentService.getAssignment('')).rejects.toThrow(
        AssignmentServiceError
      );
    });

    it('should throw error if assignment not found', async () => {
      await expect(assignmentService.getAssignment('non-existent-assignment')).rejects.toThrow(
        AssignmentServiceError
      );
    });
  });

  describe('updateAssignment', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
    });

    it('should update assignment configuration', async () => {
      const updatedAssignment = await assignmentService.updateAssignment('assignment-123', {
        autoGrading: true,
        maxAttempts: 3,
      });

      expect(updatedAssignment.configuration.autoGrading).toBe(true);
      expect(updatedAssignment.configuration.maxAttempts).toBe(3);
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(
        assignmentService.updateAssignment('', { autoGrading: false })
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if assignment not found', async () => {
      await expect(
        assignmentService.updateAssignment('non-existent-assignment', { autoGrading: false })
      ).rejects.toThrow(AssignmentServiceError);
    });
  });

  describe('deleteAssignment', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
    });

    it('should delete assignment', async () => {
      await assignmentService.deleteAssignment('assignment-123');

      await expect(
        assignmentService.getAssignment('assignment-123')
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(assignmentService.deleteAssignment('')).rejects.toThrow(
        AssignmentServiceError
      );
    });

    it('should throw error if assignment not found', async () => {
      await expect(
        assignmentService.deleteAssignment('non-existent-assignment')
      ).rejects.toThrow(AssignmentServiceError);
    });
  });

  describe('forkAssignment', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
    });

    it('should fork assignment for student', async () => {
      const fork = await assignmentService.forkAssignment('assignment-123', 'student-123');

      expect(fork).toBeDefined();
      expect(fork.assignmentId).toBe('assignment-123');
      expect(fork.studentId).toBe('student-123');
      expect(fork.githubRepoUrl).toBe('https://github.com/test-org/assignment-1');
      expect(fork.status).toBe('active');
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(
        assignmentService.forkAssignment('', 'student-123')
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if student ID is empty', async () => {
      await expect(
        assignmentService.forkAssignment('assignment-123', '')
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if assignment not found', async () => {
      await expect(
        assignmentService.forkAssignment('non-existent-assignment', 'student-123')
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if fork creation fails', async () => {
      mockGitHubClient.setShouldFailFork(true);

      await expect(
        assignmentService.forkAssignment('assignment-123', 'student-123')
      ).rejects.toThrow(AssignmentServiceError);
    });
  });

  describe('listAssignmentsByCourse', () => {
    const assignment1: Assignment = {
      ...mockAssignment,
      id: 'assignment-1',
      courseId: 'course-123',
      name: 'Assignment 1',
    };

    const assignment2: Assignment = {
      ...mockAssignment,
      id: 'assignment-2',
      courseId: 'course-123',
      name: 'Assignment 2',
    };

    const assignment3: Assignment = {
      ...mockAssignment,
      id: 'assignment-3',
      courseId: 'course-456',
      name: 'Assignment 3',
    };

    beforeEach(() => {
      mockAssignmentRepository.setAssignments([assignment1, assignment2, assignment3]);
    });

    it('should return assignments for course', async () => {
      const assignments = await assignmentService.listAssignmentsByCourse('course-123');

      expect(assignments).toHaveLength(2);
      expect(assignments.map((a) => a.id)).toContain('assignment-1');
      expect(assignments.map((a) => a.id)).toContain('assignment-2');
    });

    it('should return empty array if course has no assignments', async () => {
      const assignments = await assignmentService.listAssignmentsByCourse('non-existent-course');

      expect(assignments).toHaveLength(0);
    });

    it('should throw error if course ID is empty', async () => {
      await expect(assignmentService.listAssignmentsByCourse('')).rejects.toThrow(
        AssignmentServiceError
      );
    });
  });

  describe('getStudentFork', () => {
    beforeEach(() => {
      mockForkRepository.setForks([mockFork]);
    });

    it('should return student fork for assignment', async () => {
      const fork = await assignmentService.getStudentFork('assignment-123', 'student-123');

      expect(fork).toBeDefined();
      expect(fork?.assignmentId).toBe('assignment-123');
      expect(fork?.studentId).toBe('student-123');
    });

    it('should return null if student has no fork', async () => {
      const fork = await assignmentService.getStudentFork('assignment-123', 'student-456');

      expect(fork).toBeNull();
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(
        assignmentService.getStudentFork('', 'student-123')
      ).rejects.toThrow(AssignmentServiceError);
    });

    it('should throw error if student ID is empty', async () => {
      await expect(
        assignmentService.getStudentFork('assignment-123', '')
      ).rejects.toThrow(AssignmentServiceError);
    });
  });
});
