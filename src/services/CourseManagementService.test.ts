/**
 * Unit tests for CourseManagementService
 */

import { CourseManagementService, CourseManagementServiceError } from './CourseManagementService';
import { IGitHubClient } from '../types/services';
import { ICourseRepository } from '../types/repositories';
import { Course } from '../types/models';

// Mock GitHubClient
class MockGitHubClient implements Pick<IGitHubClient, 'createOrganization' | 'getOrganization' | 'deleteOrganization' | 'authenticateWithOAuth' | 'refreshToken' | 'validateToken' | 'createRepository' | 'forkRepository' | 'getRepository' | 'syncFork' | 'createPullRequest'> {
  private mockOrg: any | null = null;
  private shouldFailCreate = false;
  private shouldFailDelete = false;
  private shouldFailGet = false;

  setMockOrg(org: any) {
    this.mockOrg = org;
  }

  setShouldFailCreate(shouldFail: boolean) {
    this.shouldFailCreate = shouldFail;
  }

  setShouldFailDelete(shouldFail: boolean) {
    this.shouldFailDelete = shouldFail;
  }

  setShouldFailGet(shouldFail: boolean) {
    this.shouldFailGet = shouldFail;
  }

  async createOrganization(_name: string, _adminToken: string): Promise<any> {
    if (this.shouldFailCreate) {
      throw new CourseManagementServiceError('Failed to create organization');
    }
    if (!this.mockOrg) {
      throw new CourseManagementServiceError('Mock org not set');
    }
    return this.mockOrg;
  }

  async getOrganization(_name: string): Promise<any> {
    if (this.shouldFailGet) {
      throw new CourseManagementServiceError('Failed to get organization');
    }
    if (!this.mockOrg) {
      throw new CourseManagementServiceError('Mock org not set');
    }
    return this.mockOrg;
  }

  async deleteOrganization(_name: string, _adminToken: string): Promise<void> {
    if (this.shouldFailDelete) {
      throw new CourseManagementServiceError('Failed to delete organization');
    }
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
    throw new Error('Not implemented');
  }
}

// Mock CourseRepository
class MockCourseRepository implements Pick<ICourseRepository, 'create' | 'findById' | 'update' | 'delete' | 'listAll' | 'findByInstructorId' | 'findByGitHubOrgName'> {
  private courses: Map<string, Course> = new Map();

  setCourses(courses: Course[]) {
    this.courses.clear();
    for (const course of courses) {
      this.courses.set(course.id, { ...course });
    }
  }

  async create(course: Course): Promise<Course> {
    this.courses.set(course.id, { ...course });
    return { ...course };
  }

  async findById(id: string): Promise<Course | null> {
    const course = this.courses.get(id);
    return course ? { ...course } : null;
  }

  async findByInstructorId(instructorId: string): Promise<Course[]> {
    return Array.from(this.courses.values())
      .filter((c) => c.instructorId === instructorId)
      .map((c) => ({ ...c }));
  }

  async findByGitHubOrgName(orgName: string): Promise<Course | null> {
    const course = Array.from(this.courses.values()).find(
      (c) => c.githubOrgName === orgName
    );
    return course ? { ...course } : null;
  }

  async update(id: string, updates: Partial<Course>): Promise<Course> {
    const existing = this.courses.get(id);
    if (!existing) {
      throw new Error(`Course with id ${id} not found`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.courses.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.courses.delete(id);
  }

  async listAll(): Promise<Course[]> {
    return Array.from(this.courses.values()).map((c) => ({ ...c }));
  }
}

describe('CourseManagementService', () => {
  let courseService: CourseManagementService;
  let mockGitHubClient: MockGitHubClient;
  let mockCourseRepository: MockCourseRepository;

  const mockOrg = {
    id: 'org-123',
    name: 'test-org',
    login: 'test-org',
    url: 'https://github.com/test-org',
  };

  const mockCourse: Course = {
    id: 'course-123',
    name: 'CS 101: Introduction to Programming',
    instructorId: 'instructor-123',
    githubOrgName: 'cs101-fall2024',
    githubOrgId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    archived: false,
    metadata: {
      semester: 'Fall',
      year: 2024,
      description: 'Introductory programming course',
    },
  };

  beforeEach(() => {
    mockGitHubClient = new MockGitHubClient();
    mockGitHubClient.setMockOrg(mockOrg);
    mockCourseRepository = new MockCourseRepository();
    courseService = new CourseManagementService(mockGitHubClient, mockCourseRepository);
  });

  describe('createCourse', () => {
    it('should create a new course with GitHub organization', async () => {
      // Set admin token for test
      process.env.GITHUB_ADMIN_TOKEN = 'test-admin-token';

      const course = await courseService.createCourse(
        'instructor-123',
        'CS 101: Introduction to Programming',
        'cs101-fall2024'
      );

      expect(course).toBeDefined();
      expect(course.name).toBe('CS 101: Introduction to Programming');
      expect(course.instructorId).toBe('instructor-123');
      expect(course.githubOrgName).toBe('cs101-fall2024');
      expect(course.githubOrgId).toBe('org-123');
      expect(course.id).toBeDefined();
    });

    it('should throw error if instructor ID is empty', async () => {
      await expect(
        courseService.createCourse('', 'CS 101', 'cs101-fall2024')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if course name is empty', async () => {
      await expect(
        courseService.createCourse('instructor-123', '', 'cs101-fall2024')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if organization name is empty', async () => {
      await expect(
        courseService.createCourse('instructor-123', 'CS 101', '')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if organization name is too long', async () => {
      const longName = 'a'.repeat(40);
      await expect(
        courseService.createCourse('instructor-123', 'CS 101', longName)
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if organization name has invalid characters', async () => {
      await expect(
        courseService.createCourse('instructor-123', 'CS 101', 'cs_101')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if GitHub organization creation fails', async () => {
      mockGitHubClient.setShouldFailCreate(true);

      await expect(
        courseService.createCourse('instructor-123', 'CS 101', 'cs101-fall2024')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if GitHub admin token not configured', async () => {
      const originalToken = process.env.GITHUB_ADMIN_TOKEN;
      delete process.env.GITHUB_ADMIN_TOKEN;

      try {
        await expect(
          courseService.createCourse('instructor-123', 'CS 101', 'cs101-fall2024')
        ).rejects.toThrow(CourseManagementServiceError);
      } finally {
        process.env.GITHUB_ADMIN_TOKEN = originalToken;
      }
    });
  });

  describe('getCourse', () => {
    beforeEach(() => {
      mockCourseRepository.setCourses([mockCourse]);
    });

    it('should return course by ID', async () => {
      const course = await courseService.getCourse('course-123');

      expect(course).toBeDefined();
      expect(course.id).toBe('course-123');
      expect(course.name).toBe('CS 101: Introduction to Programming');
    });

    it('should throw error if course ID is empty', async () => {
      await expect(courseService.getCourse('')).rejects.toThrow(
        CourseManagementServiceError
      );
    });

    it('should throw error if course not found', async () => {
      await expect(courseService.getCourse('non-existent-course')).rejects.toThrow(
        CourseManagementServiceError
      );
    });
  });

  describe('updateCourse', () => {
    beforeEach(() => {
      mockCourseRepository.setCourses([mockCourse]);
    });

    it('should update course information', async () => {
      const updatedCourse = await courseService.updateCourse('course-123', {
        name: 'CS 201: Advanced Programming',
        metadata: {
          semester: 'Spring',
          year: 2025,
          description: 'Advanced programming course',
        },
      });

      expect(updatedCourse.name).toBe('CS 201: Advanced Programming');
      expect(updatedCourse.metadata?.semester).toBe('Spring');
      expect(updatedCourse.metadata?.year).toBe(2025);
    });

    it('should throw error if course ID is empty', async () => {
      await expect(
        courseService.updateCourse('', { name: 'New Name' })
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if course not found', async () => {
      await expect(
        courseService.updateCourse('non-existent-course', { name: 'New Name' })
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if organization name is invalid', async () => {
      await expect(
        courseService.updateCourse('course-123', { githubOrgName: 'invalid_org' })
      ).rejects.toThrow(CourseManagementServiceError);
    });
  });

  describe('deleteCourse', () => {
    beforeEach(() => {
      mockCourseRepository.setCourses([mockCourse]);
    });

    it('should delete course without deleting organization', async () => {
      await courseService.deleteCourse('course-123', false);

      await expect(courseService.getCourse('course-123')).rejects.toThrow(
        CourseManagementServiceError
      );
    });

    it('should delete course and GitHub organization when confirmed', async () => {
      await courseService.deleteCourse('course-123', true);

      await expect(courseService.getCourse('course-123')).rejects.toThrow(
        CourseManagementServiceError
      );
    });

    it('should throw error if course ID is empty', async () => {
      await expect(courseService.deleteCourse('', false)).rejects.toThrow(
        CourseManagementServiceError
      );
    });

    it('should throw error if course not found', async () => {
      await expect(
        courseService.deleteCourse('non-existent-course', false)
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if GitHub organization deletion fails', async () => {
      mockGitHubClient.setShouldFailDelete(true);

      await expect(
        courseService.deleteCourse('course-123', true)
      ).rejects.toThrow(CourseManagementServiceError);
    });
  });

  describe('listCoursesByInstructor', () => {
    const course1: Course = {
      ...mockCourse,
      id: 'course-1',
      name: 'CS 101',
      instructorId: 'instructor-123',
    };

    const course2: Course = {
      ...mockCourse,
      id: 'course-2',
      name: 'CS 201',
      instructorId: 'instructor-123',
    };

    const course3: Course = {
      ...mockCourse,
      id: 'course-3',
      name: 'CS 301',
      instructorId: 'instructor-456',
    };

    beforeEach(() => {
      mockCourseRepository.setCourses([course1, course2, course3]);
    });

    it('should return courses for instructor', async () => {
      const courses = await courseService.listCoursesByInstructor('instructor-123');

      expect(courses).toHaveLength(2);
      expect(courses.map((c) => c.id)).toContain('course-1');
      expect(courses.map((c) => c.id)).toContain('course-2');
    });

    it('should return empty array if instructor has no courses', async () => {
      const courses = await courseService.listCoursesByInstructor('non-existent-instructor');

      expect(courses).toHaveLength(0);
    });

    it('should throw error if instructor ID is empty', async () => {
      await expect(courseService.listCoursesByInstructor('')).rejects.toThrow(
        CourseManagementServiceError
      );
    });
  });

  describe('associateGitHubOrg', () => {
    beforeEach(() => {
      mockCourseRepository.setCourses([mockCourse]);
    });

    it('should associate GitHub organization with course', async () => {
      await courseService.associateGitHubOrg('course-123', 'new-org-name');

      const course = await courseService.getCourse('course-123');
      expect(course.githubOrgName).toBe('new-org-name');
      expect(course.githubOrgId).toBe('org-123');
    });

    it('should throw error if course ID is empty', async () => {
      await expect(
        courseService.associateGitHubOrg('', 'new-org')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if organization name is empty', async () => {
      await expect(
        courseService.associateGitHubOrg('course-123', '')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if course not found', async () => {
      await expect(
        courseService.associateGitHubOrg('non-existent-course', 'new-org')
      ).rejects.toThrow(CourseManagementServiceError);
    });

    it('should throw error if GitHub organization not found', async () => {
      mockGitHubClient.setShouldFailGet(true);

      await expect(
        courseService.associateGitHubOrg('course-123', 'non-existent-org')
      ).rejects.toThrow(CourseManagementServiceError);
    });
  });
});
