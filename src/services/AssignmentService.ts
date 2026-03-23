/**
 * Assignment Service implementation
 * Handles assignment creation, configuration, and student fork management
 */

import { Assignment, AssignmentConfig, Fork } from '../types/models';
import { IAssignmentService, IGitHubClient } from '../types/services';
import type { IXapiEventSink } from '../xapi/xapiSinkTypes';
import { IAssignmentRepository, IForkRepository } from '../types/repositories';
import { randomBytes } from 'crypto';
import { noopXapiSink } from '../xapi/noopXapiSink';

/**
 * Custom error class for assignment service errors
 */
export class AssignmentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentServiceError';
  }
}

/**
 * AssignmentService implementation
 * Handles assignment creation, configuration, and student fork management
 */
export class AssignmentService implements IAssignmentService {
  constructor(
    private readonly githubClient: IGitHubClient,
    private readonly assignmentRepository: IAssignmentRepository,
    private readonly forkRepository: IForkRepository,
    private readonly xapiSink: IXapiEventSink = noopXapiSink
  ) {}

  /**
   * Create a new assignment with repository creation
   * Validates: Requirements 2.1, 2.2, 2.4, 6.1
   */
  async createAssignment(courseId: string, config: AssignmentConfig, templateRepoUrl?: string): Promise<Assignment> {
    if (!courseId || courseId.trim().length === 0) {
      throw new AssignmentServiceError('Course ID is required');
    }

    // Get repository name from environment or generate one
    const repoName = process.env.GITHUB_REPO_NAME || 'assignment-' + this.generateAssignmentId().substring(0, 8);

    try {
      // Create repository in GitHub
      const githubRepoConfig = {
        name: repoName,
        description: 'Assignment repository',
        visibility: 'private' as const,
        templateRepository: templateRepoUrl,
        autoInit: config.starterCode,
      };

      // Get organization name from course (in production would fetch course first)
      const orgName = process.env.GITHUB_ORG_NAME || 'default-org';

      const githubRepo = await this.githubClient.createRepository(
        orgName,
        repoName,
        githubRepoConfig
      );

      // Create assignment record
      const assignment: Assignment = {
        id: this.generateAssignmentId(),
        courseId,
        name: 'Assignment',
        repositoryName: repoName,
        repositoryUrl: githubRepo.url,
        templateRepositoryUrl: templateRepoUrl,
        devcontainerPath: '.devcontainer/devcontainer.json',
        visibility: githubRepo.visibility,
        allowLateSubmissions: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        configuration: {
          autoGrading: config.autoGrading,
          maxAttempts: config.maxAttempts,
          requiredFiles: config.requiredFiles,
          starterCode: config.starterCode,
          ...(config.jupyterBook !== undefined ? { jupyterBook: config.jupyterBook } : {}),
        },
      };

      // Save assignment to repository
      const savedAssignment = await this.assignmentRepository.create(assignment);

      return savedAssignment;
    } catch (error) {
      if (error instanceof AssignmentServiceError) {
        throw error;
      }
      throw new AssignmentServiceError(
        `Failed to create assignment: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get an assignment by ID
   * Validates: Requirements 2.1, 2.2, 2.4
   */
  async getAssignment(assignmentId: string): Promise<Assignment> {
    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new AssignmentServiceError('Assignment ID is required');
    }

    const assignment = await this.assignmentRepository.findById(assignmentId);

    if (!assignment) {
      throw new AssignmentServiceError(`Assignment with id ${assignmentId} not found`);
    }

    return assignment;
  }

  /**
   * Update an assignment
   * Validates: Requirements 2.1, 2.2, 2.4
   */
  async updateAssignment(
    assignmentId: string,
    updates: Partial<AssignmentConfig>
  ): Promise<Assignment> {
    const existing = await this.assignmentRepository.findById(assignmentId);
    if (!existing) {
      throw new AssignmentServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Merge configuration updates
    const updatedConfig = {
      ...existing.configuration,
      ...updates,
    };

    // Update the assignment with new configuration
    const updatedAssignment = await this.assignmentRepository.update(assignmentId, {
      configuration: updatedConfig,
      updatedAt: new Date(),
    });

    return updatedAssignment;
  }

  /**
   * Delete an assignment
   * Validates: Requirements 2.1, 2.4
   */
  async deleteAssignment(assignmentId: string): Promise<void> {
    const existing = await this.assignmentRepository.findById(assignmentId);
    if (!existing) {
      throw new AssignmentServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Delete from repository
    await this.assignmentRepository.delete(assignmentId);
  }

  /**
   * Fork an assignment for a student
   * Validates: Requirements 3.1, 3.2, 3.3, 6.2, 6.3
   */
  async forkAssignment(assignmentId: string, studentId: string): Promise<Fork> {
    if (!studentId || studentId.trim().length === 0) {
      throw new AssignmentServiceError('Student ID is required');
    }

    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new AssignmentServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Parse repository URL to get owner and repo name
    const repoMatch = assignment.repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new AssignmentServiceError('Invalid repository URL format');
    }

    const [, owner, repo] = repoMatch;

    try {
      // Fork repository to student's account
      // In production, studentId would map to GitHub username
      const studentGitHubUsername = `student-${studentId.substring(0, 8)}`;
      const forkedRepo = await this.githubClient.forkRepository(
        owner,
        repo,
        studentGitHubUsername
      );

      // Create fork record
      const fork: Fork = {
        id: this.generateForkId(),
        assignmentId,
        studentId,
        githubRepoUrl: forkedRepo.url,
        githubRepoId: forkedRepo.id,
        forkedAt: new Date(),
        lastSyncedAt: undefined,
        status: 'active',
        environmentSetup: {
          status: 'pending',
        },
      };

      // Save fork to repository
      const savedFork = await this.forkRepository.create(fork);

      this.xapiSink.emit({
        type: 'assignment_forked',
        occurredAt: savedFork.forkedAt,
        courseId: assignment.courseId,
        assignmentId,
        studentId,
        forkId: savedFork.id,
        repositoryUrl: savedFork.githubRepoUrl,
      });

      return savedFork;
    } catch (error) {
      if (error instanceof AssignmentServiceError) {
        throw error;
      }
      throw new AssignmentServiceError(
        `Failed to fork assignment: ${(error as Error).message}`
      );
    }
  }

  /**
   * List assignments by course ID
   * Validates: Requirements 6.1
   */
  async listAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    if (!courseId || courseId.trim().length === 0) {
      throw new AssignmentServiceError('Course ID is required');
    }

    return await this.assignmentRepository.findByCourseId(courseId);
  }

  /**
   * Get student's fork for an assignment
   * Validates: Requirements 6.2, 6.3
   */
  async getStudentFork(assignmentId: string, studentId: string): Promise<Fork | null> {
    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new AssignmentServiceError('Assignment ID is required');
    }
    if (!studentId || studentId.trim().length === 0) {
      throw new AssignmentServiceError('Student ID is required');
    }

    return await this.forkRepository.findByAssignmentAndStudent(assignmentId, studentId);
  }

  /**
   * Generate a unique assignment ID
   */
  private generateAssignmentId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate a unique fork ID
   */
  private generateForkId(): string {
    return randomBytes(16).toString('hex');
  }
}
