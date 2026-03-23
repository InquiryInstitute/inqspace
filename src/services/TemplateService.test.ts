/**
 * Unit tests for TemplateService
 */

import { TemplateService, TemplateServiceError } from './TemplateService';
import { IAssignmentRepository } from '../types/repositories';
import { Assignment } from '../types/models';

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

describe('TemplateService', () => {
  let service: TemplateService;
  let mockAssignmentRepository: MockAssignmentRepository;

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

  beforeEach(() => {
    mockAssignmentRepository = new MockAssignmentRepository();
    service = new TemplateService(mockAssignmentRepository);
  });

  describe('createTemplate', () => {
    beforeEach(() => {
      mockAssignmentRepository.setAssignments([mockAssignment]);
    });

    it('should create a new template from assignment', async () => {
      const template = await service.createTemplate('assignment-123', 'Template 1');

      expect(template).toBeDefined();
      expect(template.name).toBe('Template 1');
      expect(template.templateRepositoryUrl).toBe('https://github.com/test-org/assignment-1');
      expect(template.id).toBeDefined();
    });

    it('should mark original assignment as template', async () => {
      await service.createTemplate('assignment-123', 'Template 1');

      const updatedAssignment = await mockAssignmentRepository.findById('assignment-123');
      expect(updatedAssignment?.templateRepositoryUrl).toBe('https://github.com/test-org/assignment-1');
    });

    it('should throw error if assignment ID is empty', async () => {
      await expect(service.createTemplate('', 'Template 1')).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if template name is empty', async () => {
      await expect(service.createTemplate('assignment-123', '')).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if assignment not found', async () => {
      await expect(service.createTemplate('non-existent-assignment', 'Template 1')).rejects.toThrow(
        TemplateServiceError
      );
    });
  });

  describe('getTemplate', () => {
    beforeEach(() => {
      const template: Assignment = {
        ...mockAssignment,
        id: 'template-123',
        name: 'Template 1',
        templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
      };
      mockAssignmentRepository.setAssignments([template]);
    });

    it('should return template by ID', async () => {
      const template = await service.getTemplate('template-123');

      expect(template).toBeDefined();
      expect(template.name).toBe('Template 1');
    });

    it('should throw error if template ID is empty', async () => {
      await expect(service.getTemplate('')).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if template not found', async () => {
      await expect(service.getTemplate('non-existent-template')).rejects.toThrow(
        TemplateServiceError
      );
    });
  });

  describe('listTemplatesByCourse', () => {
    const assignment1: Assignment = {
      ...mockAssignment,
      id: 'assignment-1',
      courseId: 'course-123',
      name: 'Assignment 1',
      templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
    };

    const assignment2: Assignment = {
      ...mockAssignment,
      id: 'assignment-2',
      courseId: 'course-123',
      name: 'Assignment 2',
      templateRepositoryUrl: 'https://github.com/test-org/assignment-2',
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

    it('should return templates for course', async () => {
      const templates = await service.listTemplatesByCourse('course-123');

      expect(templates).toHaveLength(2);
      expect(templates.map((a) => a.id)).toContain('assignment-1');
      expect(templates.map((a) => a.id)).toContain('assignment-2');
    });

    it('should return empty array if course has no templates', async () => {
      const templates = await service.listTemplatesByCourse('course-456');

      expect(templates).toHaveLength(0);
    });

    it('should throw error if course ID is empty', async () => {
      await expect(service.listTemplatesByCourse('')).rejects.toThrow(TemplateServiceError);
    });
  });

  describe('deleteTemplate', () => {
    beforeEach(() => {
      const template: Assignment = {
        ...mockAssignment,
        id: 'template-123',
        name: 'Template 1',
        templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
        courseId: 'course-123',
      };
      mockAssignmentRepository.setAssignments([template]);
    });

    it('should delete template with confirmation', async () => {
      await service.deleteTemplate('template-123', true);

      await expect(service.getTemplate('template-123')).rejects.toThrow(TemplateServiceError);
    });

    it('should prevent deletion if template is used by assignments', async () => {
      const assignment: Assignment = {
        ...mockAssignment,
        id: 'assignment-456',
        courseId: 'course-123',
        name: 'Assignment 1',
        templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
      };
      mockAssignmentRepository.setAssignments([assignment]);

      await expect(service.deleteTemplate('template-123', false)).rejects.toThrow(
        TemplateServiceError
      );
    });

    it('should throw error if template ID is empty', async () => {
      await expect(service.deleteTemplate('', false)).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if template not found', async () => {
      await expect(service.deleteTemplate('non-existent-template', false)).rejects.toThrow(
        TemplateServiceError
      );
    });
  });

  describe('updateTemplate', () => {
    beforeEach(() => {
      const template: Assignment = {
        ...mockAssignment,
        id: 'template-123',
        name: 'Template 1',
        templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
      };
      mockAssignmentRepository.setAssignments([template]);
    });

    it('should update template', async () => {
      const updatedTemplate = await service.updateTemplate('template-123', {
        name: 'Updated Template',
      });

      expect(updatedTemplate.name).toBe('Updated Template');
    });

    it('should throw error if template ID is empty', async () => {
      await expect(service.updateTemplate('', {})).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if template not found', async () => {
      await expect(service.updateTemplate('non-existent-template', {})).rejects.toThrow(
        TemplateServiceError
      );
    });
  });

  describe('getAssignmentsUsingTemplate', () => {
    const template: Assignment = {
      ...mockAssignment,
      id: 'template-123',
      name: 'Template 1',
      templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
      courseId: 'course-123',
    };

    const assignment1: Assignment = {
      ...mockAssignment,
      id: 'assignment-1',
      courseId: 'course-123',
      name: 'Assignment 1',
      templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
    };

    const assignment2: Assignment = {
      ...mockAssignment,
      id: 'assignment-2',
      courseId: 'course-123',
      name: 'Assignment 2',
      templateRepositoryUrl: 'https://github.com/test-org/assignment-1',
    };

    const assignment3: Assignment = {
      ...mockAssignment,
      id: 'assignment-3',
      courseId: 'course-456',
      name: 'Assignment 3',
    };

    beforeEach(() => {
      mockAssignmentRepository.setAssignments([template, assignment1, assignment2, assignment3]);
    });

    it('should return assignments using template', async () => {
      const assignments = await service.getAssignmentsUsingTemplate('template-123');

      expect(assignments).toHaveLength(3);
      expect(assignments.map((a) => a.id)).toContain('template-123');
      expect(assignments.map((a) => a.id)).toContain('assignment-1');
      expect(assignments.map((a) => a.id)).toContain('assignment-2');
    });

    it('should throw error if template ID is empty', async () => {
      await expect(service.getAssignmentsUsingTemplate('')).rejects.toThrow(TemplateServiceError);
    });

    it('should throw error if template not found', async () => {
      await expect(service.getAssignmentsUsingTemplate('non-existent-template')).rejects.toThrow(
        TemplateServiceError
      );
    });
  });
});
