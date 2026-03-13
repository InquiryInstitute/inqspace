/**
 * In-memory Course Repository implementation for testing
 */

import { Course } from '../types/models';
import { ICourseRepository } from '../types/repositories';

export class InMemoryCourseRepository implements ICourseRepository {
  private courses: Map<string, Course> = new Map();

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

  clear(): void {
    this.courses.clear();
  }
}

/**
 * In-memory Assignment Repository implementation for testing
 */

import { Assignment } from '../types/models';
import { IAssignmentRepository } from '../types/repositories';

/**
 * In-memory Course Repository implementation for testing
 */

import { Course } from '../types/models';
import { ICourseRepository } from '../types/repositories';

export class InMemoryAssignmentRepository implements IAssignmentRepository {
  private assignments: Map<string, Assignment> = new Map();

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

    // Only update updatedAt if it's not explicitly provided in updates
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

  clear(): void {
    this.assignments.clear();
  }
}
