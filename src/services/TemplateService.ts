/**
 * Template Service implementation
 * Handles assignment template creation, storage, and management
 */

import { IAssignmentRepository } from '../types/repositories';
import { Assignment } from '../types/models';
import { randomBytes } from 'crypto';

/**
 * Custom error class for template service errors
 */
export class TemplateServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateServiceError';
  }
}

/**
 * TemplateService implementation
 * Handles assignment template creation, storage, and management
 */
export class TemplateService {
  constructor(
    private readonly assignmentRepository: IAssignmentRepository
  ) {}

  /**
   * Create a new template from an existing repository
   * Validates: Requirements 14.1, 14.2
   */
  async createTemplate(assignmentId: string, templateName: string): Promise<Assignment> {
    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new TemplateServiceError('Assignment ID is required');
    }

    if (!templateName || templateName.trim().length === 0) {
      throw new TemplateServiceError('Template name is required');
    }

    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new TemplateServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Create a template assignment
    const template: Assignment = {
      id: this.generateTemplateId(),
      courseId: assignment.courseId,
      name: templateName,
      repositoryName: assignment.repositoryName,
      repositoryUrl: assignment.repositoryUrl,
      templateRepositoryUrl: assignment.repositoryUrl,
      deadline: undefined,
      allowLateSubmissions: false,
      devcontainerPath: assignment.devcontainerPath,
      visibility: assignment.visibility,
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: {
        autoGrading: assignment.configuration.autoGrading,
        maxAttempts: assignment.configuration.maxAttempts,
        requiredFiles: assignment.configuration.requiredFiles,
        starterCode: assignment.configuration.starterCode,
      },
    };

    // Mark the original assignment as a template
    await this.assignmentRepository.update(assignmentId, {
      templateRepositoryUrl: template.repositoryUrl,
      updatedAt: new Date(),
    });

    // Save the template
    const savedTemplate = await this.assignmentRepository.create(template);

    return savedTemplate;
  }

  /**
   * Get a template by ID
   * Validates: Requirements 14.1, 14.2
   */
  async getTemplate(templateId: string): Promise<Assignment> {
    if (!templateId || templateId.trim().length === 0) {
      throw new TemplateServiceError('Template ID is required');
    }

    const template = await this.assignmentRepository.findById(templateId);
    if (!template) {
      throw new TemplateServiceError(`Template with id ${templateId} not found`);
    }

    return template;
  }

  /**
   * List all templates for a course
   * Validates: Requirements 14.1, 14.2
   */
  async listTemplatesByCourse(courseId: string): Promise<Assignment[]> {
    if (!courseId || courseId.trim().length === 0) {
      throw new TemplateServiceError('Course ID is required');
    }

    const assignments = await this.assignmentRepository.findByCourseId(courseId);
    return assignments.filter((a) => a.templateRepositoryUrl !== undefined);
  }

  /**
   * Delete a template
   * Validates: Requirements 14.3
   */
  async deleteTemplate(templateId: string, confirmDeletion: boolean = false): Promise<void> {
    if (!templateId || templateId.trim().length === 0) {
      throw new TemplateServiceError('Template ID is required');
    }

    const template = await this.assignmentRepository.findById(templateId);
    if (!template) {
      throw new TemplateServiceError(`Template with id ${templateId} not found`);
    }

    // Check if template is being used by any assignments
    const assignments = await this.assignmentRepository.findByCourseId(template.courseId);
    const usedByAssignments = assignments.filter(
      (a) => a.templateRepositoryUrl === template.repositoryUrl
    );

    if (usedByAssignments.length > 0 && !confirmDeletion) {
      throw new TemplateServiceError(
        `Template is being used by ${usedByAssignments.length} assignment(s). Set confirmDeletion to true to delete.`
      );
    }

    // Delete the template
    await this.assignmentRepository.delete(templateId);
  }

  /**
   * Update a template
   * Validates: Requirements 14.4
   */
  async updateTemplate(templateId: string, updates: Partial<Assignment>): Promise<Assignment> {
    if (!templateId || templateId.trim().length === 0) {
      throw new TemplateServiceError('Template ID is required');
    }

    const template = await this.assignmentRepository.findById(templateId);
    if (!template) {
      throw new TemplateServiceError(`Template with id ${templateId} not found`);
    }

    // Update the template
    const updatedTemplate = await this.assignmentRepository.update(templateId, {
      ...updates,
      updatedAt: new Date(),
    });

    return updatedTemplate;
  }

  /**
   * Get assignments that use a specific template
   * Validates: Requirements 14.4
   */
  async getAssignmentsUsingTemplate(templateId: string): Promise<Assignment[]> {
    if (!templateId || templateId.trim().length === 0) {
      throw new TemplateServiceError('Template ID is required');
    }

    const template = await this.assignmentRepository.findById(templateId);
    if (!template) {
      throw new TemplateServiceError(`Template with id ${templateId} not found`);
    }

    const assignments = await this.assignmentRepository.findByCourseId(template.courseId);
    return assignments.filter((a) => a.templateRepositoryUrl === template.repositoryUrl);
  }

  /**
   * Generate a unique template ID
   */
  private generateTemplateId(): string {
    return randomBytes(16).toString('hex');
  }
}
