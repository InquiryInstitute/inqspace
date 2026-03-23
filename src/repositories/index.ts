/**
 * In-memory Repository implementations for testing
 */

export { InMemoryCourseRepository } from './AssignmentRepository';
export { InMemoryAssignmentRepository } from './AssignmentRepository';

/**
 * In-memory Fork Repository implementation for testing
 */

import { Fork } from '../types/models';
import { IForkRepository } from '../types/repositories';

export class InMemoryForkRepository implements IForkRepository {
  private forks: Map<string, Fork> = new Map();

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

  async findByAssignmentAndStudent(
    assignmentId: string,
    studentId: string
  ): Promise<Fork | null> {
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

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.forks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.forks.delete(id);
  }

  clear(): void {
    this.forks.clear();
  }
}

/**
 * In-memory User Repository implementation for testing
 */

import { User } from '../types/models';
import { IUserRepository } from '../types/repositories';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async create(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    return user ? { ...user } : null;
  }

  async findByGitHubId(githubId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (u) => u.githubId === githubId
    );
    return user ? { ...user } : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (u) => u.googleId === googleId
    );
    return user ? { ...user } : null;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.users.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  clear(): void {
    this.users.clear();
  }
}

/**
 * In-memory Submission Repository implementation for testing
 */

import { Submission } from '../types/models';
import { ISubmissionRepository, IAssignmentRepository } from '../types/repositories';

export class InMemorySubmissionRepository implements ISubmissionRepository {
  private submissions: Map<string, Submission> = new Map();
  private assignmentRepository: IAssignmentRepository;

  constructor(assignmentRepository: IAssignmentRepository) {
    this.assignmentRepository = assignmentRepository;
  }

  async create(submission: Submission): Promise<Submission> {
    this.submissions.set(submission.id, { ...submission });
    return { ...submission };
  }

  async findById(id: string): Promise<Submission | null> {
    const submission = this.submissions.get(id);
    return submission ? { ...submission } : null;
  }

  async findByForkId(forkId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.forkId === forkId)
      .map((s) => ({ ...s }));
  }

  async findByAssignmentId(assignmentId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.assignmentId === assignmentId)
      .map((s) => ({ ...s }));
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string
  ): Promise<Submission[]> {
    // Get all assignments for the course
    const assignments = await this.assignmentRepository.findByCourseId(courseId);
    
    // Get all submissions for the student across all assignments
    const allSubmissions: Submission[] = [];
    for (const assignment of assignments) {
      const submissions = await this.findByAssignmentId(assignment.id);
      const studentSubmissions = submissions.filter((s) => s.studentId === studentId);
      allSubmissions.push(...studentSubmissions);
    }

    return allSubmissions;
  }

  async update(id: string, updates: Partial<Submission>): Promise<Submission> {
    const existing = this.submissions.get(id);
    if (!existing) {
      throw new Error(`Submission with id ${id} not found`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.submissions.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.submissions.delete(id);
  }

  clear(): void {
    this.submissions.clear();
  }
}

/**
 * In-memory Notification Repository implementation for testing
 */

import { Notification } from '../types/models';
import { INotificationRepository } from '../types/repositories';

export class InMemoryNotificationRepository implements INotificationRepository {
  private notifications: Map<string, Notification> = new Map();

  async create(notification: Notification): Promise<Notification> {
    this.notifications.set(notification.id, { ...notification });
    return { ...notification };
  }

  async findById(id: string): Promise<Notification | null> {
    const notification = this.notifications.get(id);
    return notification ? { ...notification } : null;
  }

  async findByUserId(userId: string, unreadOnly: boolean): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values()).filter(
      (n) => n.userId === userId
    );

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    return notifications.map((n) => ({ ...n }));
  }

  async update(id: string, updates: Partial<Notification>): Promise<Notification> {
    const existing = this.notifications.get(id);
    if (!existing) {
      throw new Error(`Notification with id ${id} not found`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.notifications.set(id, updated);
    return { ...updated };
  }

  async markAsRead(id: string): Promise<void> {
    await this.update(id, { read: true, readAt: new Date() });
  }

  async markAllAsReadForUser(userId: string): Promise<void> {
    const notifications = await this.findByUserId(userId, false);
    for (const notification of notifications) {
      if (!notification.read) {
        await this.update(notification.id, { read: true, readAt: new Date() });
      }
    }
  }

  async delete(id: string): Promise<void> {
    this.notifications.delete(id);
  }

  clear(): void {
    this.notifications.clear();
  }
}

/**
 * In-memory Auth Token Repository implementation for testing
 */

import { AuthToken } from '../types/models';
import { IAuthTokenRepository } from '../types/repositories';

export class InMemoryAuthTokenRepository implements IAuthTokenRepository {
  private tokens: Map<string, AuthToken> = new Map();

  async create(token: AuthToken): Promise<AuthToken> {
    const key = `${token.userId}:${token.provider}`;
    this.tokens.set(key, { ...token });
    return { ...token };
  }

  async findByUserId(userId: string, provider: 'github' | 'google'): Promise<AuthToken | null> {
    const key = `${userId}:${provider}`;
    const token = this.tokens.get(key);
    return token ? { ...token } : null;
  }

  async update(
    userId: string,
    provider: 'github' | 'google',
    updates: Partial<AuthToken>
  ): Promise<AuthToken> {
    const key = `${userId}:${provider}`;
    const existing = this.tokens.get(key);
    if (!existing) {
      throw new Error(`Token not found for user ${userId} and provider ${provider}`);
    }

    const updatedAt = updates.updatedAt !== undefined ? updates.updatedAt : new Date();

    const updated = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.tokens.set(key, updated);
    return { ...updated };
  }

  async delete(userId: string, provider: 'github' | 'google'): Promise<void> {
    const key = `${userId}:${provider}`;
    this.tokens.delete(key);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const key of this.tokens.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.tokens.delete(key);
      }
    }
  }

  clear(): void {
    this.tokens.clear();
  }
}
