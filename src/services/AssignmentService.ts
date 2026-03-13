/**
 * Assignment Service implementation
 */

import { Assignment, AssignmentConfig } from '../types/models';
import { IAssignmentService } from '../types/services';
import { IAssignmentRepository } from '../types/repositories';

export class AssignmentService implements IAssignmentService {
  constructor(private assignmentRepository: IAssignmentRepository) {}

  async createAssignment(_courseId: string, _config: AssignmentConfig): Promise<Assignment> {
    throw new Error('Not implemented');
  }

  async getAssignment(assignmentId: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment with id ${assignmentId} not found`);
    }
    return assignment;
  }

  async updateAssignment(
    assignmentId: string,
    updates: Partial<AssignmentConfig>
  ): Promise<Assignment> {
    const existing = await this.assignmentRepository.findById(assignmentId);
    if (!existing) {
      throw new Error(`Assignment with id ${assignmentId} not found`);
    }

    // Merge configuration updates
    const updatedConfig = {
      ...existing.configuration,
      ...updates,
    };

    // Update the assignment with new configuration
    const updatedAssignment = await this.assignmentRepository.update(assignmentId, {
      configuration: updatedConfig,
    });

    return updatedAssignment;
  }

  async deleteAssignment(_assignmentId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async forkAssignment(_assignmentId: string, _studentId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async listAssignmentsByCourse(_courseId: string): Promise<Assignment[]> {
    throw new Error('Not implemented');
  }

  async getStudentFork(_assignmentId: string, _studentId: string): Promise<any> {
    throw new Error('Not implemented');
  }
}
