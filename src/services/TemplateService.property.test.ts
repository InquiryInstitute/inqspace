/**
 * Property-based tests for TemplateService
 */

import { TemplateService, TemplateServiceError } from './TemplateService';
import { IAssignmentRepository } from '../types/repositories';
import { Assignment } from '../types/models';
import * as fc from 'fast-check';

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

// Feature: github-classroom-support, Property 25: Template Creation and Persistence
test('Property 25: Template Creation and Persistence', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        assignmentId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        templateName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        repoName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes(' ') && !s.startsWith('/')),
        visibility: fc.constantFrom<'public' | 'private'>('public', 'private'),
      }),
      async (configData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();

        const mockAssignment: Assignment = {
          id: configData.assignmentId as string,
          courseId: configData.courseId as string,
          name: 'Original Assignment',
          repositoryName: configData.repoName as string,
          repositoryUrl: `https://github.com/test-org/${configData.repoName}`,
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: configData.visibility as 'public' | 'private',
          allowLateSubmissions: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: ['main.py'],
            starterCode: true,
          },
        };

        mockAssignmentRepository.setAssignments([mockAssignment]);

        const service = new TemplateService(mockAssignmentRepository);

        // Execute
        const template = await service.createTemplate(
          configData.assignmentId as string,
          configData.templateName as string
        );

        // Verify
        expect(template).toBeDefined();
        expect(template.name).toBe(configData.templateName);
        expect(template.courseId).toBe(configData.courseId);
        expect(template.templateRepositoryUrl).toBe(`https://github.com/test-org/${configData.repoName}`);
        expect(template.id).toBeDefined();

        // Verify the original assignment was updated
        const updatedAssignment = await mockAssignmentRepository.findById(configData.assignmentId);
        expect(updatedAssignment?.templateRepositoryUrl).toBe(`https://github.com/test-org/${configData.repoName}`);

        // Verify the template can be retrieved
        const retrievedTemplate = await service.getTemplate(template.id);
        expect(retrievedTemplate).toBeDefined();
        expect(retrievedTemplate.id).toBe(template.id);
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 26: Template Deletion Protection
test('Property 26: Template Deletion Protection', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        templateId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        assignmentCount: fc.integer({ min: 1, max: 10 }),
      }),
      async (configData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();

        const template: Assignment = {
          id: configData.templateId as string,
          courseId: configData.courseId as string,
          name: 'Template',
          repositoryName: 'template-repo',
          repositoryUrl: 'https://github.com/test-org/template-repo',
          templateRepositoryUrl: 'https://github.com/test-org/template-repo',
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        const assignments: Assignment[] = [];
        for (let i = 0; i < configData.assignmentCount; i++) {
          assignments.push({
            ...template,
            id: `assignment-${i}`,
            name: `Assignment ${i}`,
            templateRepositoryUrl: 'https://github.com/test-org/template-repo',
          });
        }

        mockAssignmentRepository.setAssignments([template, ...assignments]);

        const service = new TemplateService(mockAssignmentRepository);

        // Execute - try to delete without confirmation
        await expect(service.deleteTemplate(configData.templateId as string, false)).rejects.toThrow(
          TemplateServiceError
        );

        // Verify the template still exists
        const retrievedTemplate = await mockAssignmentRepository.findById(configData.templateId);
        expect(retrievedTemplate).toBeDefined();

        // Execute - delete with confirmation
        await service.deleteTemplate(configData.templateId as string, true);

        // Verify the template was deleted
        const deletedTemplate = await mockAssignmentRepository.findById(configData.templateId);
        expect(deletedTemplate).toBeNull();
      }
    ),
    { numRuns: 100 }
  );
}, 10000);

// Feature: github-classroom-support, Property 27: Template Modification Propagation
test('Property 27: Template Modification Propagation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        templateId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        courseId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        assignmentCount: fc.integer({ min: 1, max: 10 }),
        newTemplateName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      }),
      async (configData) => {
        // Setup
        const mockAssignmentRepository = new MockAssignmentRepository();

        const template: Assignment = {
          id: configData.templateId as string,
          courseId: configData.courseId as string,
          name: 'Template',
          repositoryName: 'template-repo',
          repositoryUrl: 'https://github.com/test-org/template-repo',
          templateRepositoryUrl: 'https://github.com/test-org/template-repo',
          devcontainerPath: '.devcontainer/devcontainer.json',
          visibility: 'private',
          allowLateSubmissions: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuration: {
            autoGrading: false,
            requiredFiles: [],
            starterCode: true,
          },
        };

        const assignments: Assignment[] = [];
        for (let i = 0; i < configData.assignmentCount; i++) {
          assignments.push({
            ...template,
            id: `assignment-${i}`,
            name: `Assignment ${i}`,
            templateRepositoryUrl: 'https://github.com/test-org/template-repo',
          });
        }

        mockAssignmentRepository.setAssignments([template, ...assignments]);

        const service = new TemplateService(mockAssignmentRepository);

        // Execute - update the template
        const updatedTemplate = await service.updateTemplate(configData.templateId as string, {
          name: configData.newTemplateName as string,
        });

        // Verify the template was updated
        expect(updatedTemplate.name).toBe(configData.newTemplateName);

        // Verify all assignments using the template still reference the same repository
        const assignmentsUsingTemplate = await service.getAssignmentsUsingTemplate(configData.templateId);
        expect(assignmentsUsingTemplate).toHaveLength(configData.assignmentCount + 1);
        expect(assignmentsUsingTemplate.every((a) => a.templateRepositoryUrl === 'https://github.com/test-org/template-repo')).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
}, 10000);
