/**
 * Property-based tests for Assignment Service
 */

import * as fc from 'fast-check';
import { AssignmentService } from './AssignmentService';
import { InMemoryAssignmentRepository } from '../repositories/AssignmentRepository';
import { Assignment, AssignmentConfig } from '../types/models';

describe('AssignmentService - Property Tests', () => {
  let assignmentService: AssignmentService;
  let assignmentRepository: InMemoryAssignmentRepository;

  beforeEach(() => {
    assignmentRepository = new InMemoryAssignmentRepository();
    assignmentService = new AssignmentService(assignmentRepository);
  });

  afterEach(() => {
    assignmentRepository.clear();
  });

  // Feature: github-classroom-support, Property 7: Assignment Configuration Persistence
  // **Validates: Requirements 5.1, 5.3**
  test('Property 7: Assignment Configuration Persistence - any assignment configuration update should persist and be retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate initial assignment
        fc.record({
          id: fc.uuid(),
          courseId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          repositoryName: fc.string({ minLength: 1, maxLength: 100 }),
          repositoryUrl: fc.webUrl(),
          templateRepositoryUrl: fc.option(fc.webUrl(), { nil: undefined }),
          deadline: fc.option(fc.date(), { nil: undefined }),
          allowLateSubmissions: fc.boolean(),
          devcontainerPath: fc.constant('.devcontainer/devcontainer.json'),
          visibility: fc.constantFrom('public' as const, 'private' as const),
          createdAt: fc.date(),
          updatedAt: fc.date(),
          configuration: fc.record({
            autoGrading: fc.boolean(),
            maxAttempts: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
            requiredFiles: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
              minLength: 0,
              maxLength: 5,
            }),
            starterCode: fc.boolean(),
          }),
        }),
        // Generate configuration updates
        fc.record({
          autoGrading: fc.option(fc.boolean(), { nil: undefined }),
          maxAttempts: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
          requiredFiles: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
              minLength: 0,
              maxLength: 5,
            }),
            { nil: undefined }
          ),
          starterCode: fc.option(fc.boolean(), { nil: undefined }),
        }),
        async (initialAssignment: Assignment, configUpdates: Partial<AssignmentConfig>) => {
          // Create initial assignment in repository
          await assignmentRepository.create(initialAssignment);

          // Update assignment configuration
          const updatedAssignment = await assignmentService.updateAssignment(
            initialAssignment.id,
            configUpdates
          );

          // Verify the update was applied
          const expectedConfig = {
            ...initialAssignment.configuration,
            ...configUpdates,
          };

          expect(updatedAssignment.configuration).toEqual(expectedConfig);

          // Retrieve the assignment again to verify persistence
          const retrievedAssignment = await assignmentService.getAssignment(initialAssignment.id);

          // Verify configuration persisted correctly
          expect(retrievedAssignment.configuration).toEqual(expectedConfig);

          // Verify other fields remain unchanged
          expect(retrievedAssignment.id).toBe(initialAssignment.id);
          expect(retrievedAssignment.courseId).toBe(initialAssignment.courseId);
          expect(retrievedAssignment.name).toBe(initialAssignment.name);
          expect(retrievedAssignment.repositoryName).toBe(initialAssignment.repositoryName);
          expect(retrievedAssignment.repositoryUrl).toBe(initialAssignment.repositoryUrl);
          expect(retrievedAssignment.visibility).toBe(initialAssignment.visibility);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test for deadline updates specifically (part of configuration)
  test('Property 7: Assignment Configuration Persistence - deadline updates should persist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          courseId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          repositoryName: fc.string({ minLength: 1, maxLength: 100 }),
          repositoryUrl: fc.webUrl(),
          templateRepositoryUrl: fc.option(fc.webUrl(), { nil: undefined }),
          deadline: fc.option(fc.date(), { nil: undefined }),
          allowLateSubmissions: fc.boolean(),
          devcontainerPath: fc.constant('.devcontainer/devcontainer.json'),
          visibility: fc.constantFrom('public' as const, 'private' as const),
          createdAt: fc.date(),
          updatedAt: fc.date(),
          configuration: fc.record({
            autoGrading: fc.boolean(),
            maxAttempts: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
            requiredFiles: fc.array(fc.string({ minLength: 1, maxLength: 50 })),
            starterCode: fc.boolean(),
          }),
        }),
        fc.date(),
        fc.boolean(),
        async (
          initialAssignment: Assignment,
          newDeadline: Date,
          newAllowLateSubmissions: boolean
        ) => {
          // Create initial assignment
          await assignmentRepository.create(initialAssignment);

          // Update deadline and late submission settings
          const updatedAssignment = await assignmentRepository.update(initialAssignment.id, {
            deadline: newDeadline,
            allowLateSubmissions: newAllowLateSubmissions,
          });

          // Verify updates were applied
          expect(updatedAssignment.deadline).toEqual(newDeadline);
          expect(updatedAssignment.allowLateSubmissions).toBe(newAllowLateSubmissions);

          // Retrieve and verify persistence
          const retrievedAssignment = await assignmentService.getAssignment(initialAssignment.id);

          expect(retrievedAssignment.deadline).toEqual(newDeadline);
          expect(retrievedAssignment.allowLateSubmissions).toBe(newAllowLateSubmissions);
        }
      ),
      { numRuns: 100 }
    );
  });
});
