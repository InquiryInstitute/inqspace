/**
 * Course Management Service implementation
 * Handles course lifecycle, GitHub Organization association, and instructor permissions
 */

import { ICourseManagementService, IGitHubClient } from '../types/services';
import { Course } from '../types/models';
import { ICourseRepository } from '../types/repositories';
import { randomBytes } from 'crypto';

/**
 * Custom error class for course management errors
 */
export class CourseManagementServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseManagementServiceError';
  }
}

/**
 * CourseManagementService implementation
 * Manages course lifecycle, GitHub Organization association, and instructor permissions
 */
export class CourseManagementService implements ICourseManagementService {
  constructor(
    private readonly githubClient: IGitHubClient,
    private readonly courseRepository: ICourseRepository
  ) {}

  /**
   * Create a new course with an associated GitHub Organization
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   */
  async createCourse(instructorId: string, courseName: string, orgName: string): Promise<Course> {
    // Validate inputs
    if (!instructorId || instructorId.trim().length === 0) {
      throw new CourseManagementServiceError('Instructor ID is required');
    }
    if (!courseName || courseName.trim().length === 0) {
      throw new CourseManagementServiceError('Course name is required');
    }
    if (!orgName || orgName.trim().length === 0) {
      throw new CourseManagementServiceError('GitHub organization name is required');
    }

    // Validate organization name format
    this.validateOrgName(orgName);

    try {
      // Create GitHub Organization
      const adminToken = process.env.GITHUB_ADMIN_TOKEN || '';
      if (!adminToken) {
        throw new CourseManagementServiceError('GitHub admin token not configured');
      }

      const githubOrg = await this.githubClient.createOrganization(orgName, adminToken);

      // Create course record
      const course: Course = {
        id: this.generateCourseId(),
        name: courseName,
        instructorId,
        githubOrgName: orgName,
        githubOrgId: githubOrg.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false,
        metadata: {
          semester: undefined,
          year: undefined,
          description: undefined,
        },
      };

      // Save course to repository
      const savedCourse = await this.courseRepository.create(course);

      return savedCourse;
    } catch (error) {
      if (error instanceof CourseManagementServiceError) {
        throw error;
      }
      throw new CourseManagementServiceError(
        `Failed to create course: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get a course by ID
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  async getCourse(courseId: string): Promise<Course> {
    if (!courseId || courseId.trim().length === 0) {
      throw new CourseManagementServiceError('Course ID is required');
    }

    const course = await this.courseRepository.findById(courseId);

    if (!course) {
      throw new CourseManagementServiceError(`Course with id ${courseId} not found`);
    }

    return course;
  }

  /**
   * Update a course
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course> {
    if (!courseId || courseId.trim().length === 0) {
      throw new CourseManagementServiceError('Course ID is required');
    }

    // Check if course exists
    const existingCourse = await this.courseRepository.findById(courseId);
    if (!existingCourse) {
      throw new CourseManagementServiceError(`Course with id ${courseId} not found`);
    }

    // Validate updates if org name is being changed
    if (updates.githubOrgName) {
      this.validateOrgName(updates.githubOrgName);
    }

    // Update the course
    const updatedCourse = await this.courseRepository.update(courseId, {
      ...updates,
      updatedAt: new Date(),
    });

    return updatedCourse;
  }

  /**
   * Delete a course
   * Validates: Requirements 1.1, 1.4
   */
  async deleteCourse(courseId: string, confirmOrgDeletion: boolean): Promise<void> {
    if (!courseId || courseId.trim().length === 0) {
      throw new CourseManagementServiceError('Course ID is required');
    }

    // Check if course exists
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new CourseManagementServiceError(`Course with id ${courseId} not found`);
    }

    // Check if organization should be deleted
    if (confirmOrgDeletion) {
      try {
        const adminToken = process.env.GITHUB_ADMIN_TOKEN || '';
        if (!adminToken) {
          throw new CourseManagementServiceError('GitHub admin token not configured');
        }

        // Delete GitHub Organization
        await this.githubClient.deleteOrganization(course.githubOrgName, adminToken);
      } catch (error) {
        throw new CourseManagementServiceError(
          `Failed to delete GitHub organization: ${(error as Error).message}`
        );
      }
    }

    // Delete course from repository
    await this.courseRepository.delete(courseId);
  }

  /**
   * List courses by instructor ID
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  async listCoursesByInstructor(instructorId: string): Promise<Course[]> {
    if (!instructorId || instructorId.trim().length === 0) {
      throw new CourseManagementServiceError('Instructor ID is required');
    }

    // Get all courses and filter by instructor
    const allCourses = await this.courseRepository.listAll();
    return allCourses.filter((course) => course.instructorId === instructorId);
  }

  /**
   * Associate a GitHub Organization with a course
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  async associateGitHubOrg(courseId: string, orgName: string): Promise<void> {
    if (!courseId || courseId.trim().length === 0) {
      throw new CourseManagementServiceError('Course ID is required');
    }
    if (!orgName || orgName.trim().length === 0) {
      throw new CourseManagementServiceError('GitHub organization name is required');
    }

    // Validate organization name format
    this.validateOrgName(orgName);

    // Check if course exists
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new CourseManagementServiceError(`Course with id ${courseId} not found`);
    }

    // Check if organization already exists
    const existingOrg = await this.githubClient.getOrganization(orgName);
    if (!existingOrg) {
      throw new CourseManagementServiceError(`GitHub organization ${orgName} not found`);
    }

    // Update course with organization info
    await this.courseRepository.update(courseId, {
      githubOrgName: orgName,
      githubOrgId: existingOrg.id,
      updatedAt: new Date(),
    });
  }

  /**
   * Validate GitHub organization name format
   */
  private validateOrgName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new CourseManagementServiceError('Organization name cannot be empty');
    }
    if (name.length > 39) {
      throw new CourseManagementServiceError('Organization name cannot exceed 39 characters');
    }
    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      throw new CourseManagementServiceError(
        'Organization name can only contain alphanumeric characters and hyphens'
      );
    }
  }

  /**
   * Get all courses from repository
   */

  /**
   * Generate a unique course ID
   */
  private generateCourseId(): string {
    return randomBytes(16).toString('hex');
  }
}
