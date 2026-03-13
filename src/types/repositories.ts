/**
 * Repository interfaces for data persistence
 */

import { Course, Assignment, Fork, User, Submission, Notification, AuthToken } from './models';

/**
 * Course Repository Interface
 */
export interface ICourseRepository {
  create(course: Course): Promise<Course>;
  findById(id: string): Promise<Course | null>;
  findByInstructorId(instructorId: string): Promise<Course[]>;
  update(id: string, updates: Partial<Course>): Promise<Course>;
  delete(id: string): Promise<void>;
  findByGitHubOrgName(orgName: string): Promise<Course | null>;
  listAll(): Promise<Course[]>;
}

/**
 * Assignment Repository Interface
 */
export interface IAssignmentRepository {
  create(assignment: Assignment): Promise<Assignment>;
  findById(id: string): Promise<Assignment | null>;
  findByCourseId(courseId: string): Promise<Assignment[]>;
  update(id: string, updates: Partial<Assignment>): Promise<Assignment>;
  delete(id: string): Promise<void>;
}

/**
 * Fork Repository Interface
 */
export interface IForkRepository {
  create(fork: Fork): Promise<Fork>;
  findById(id: string): Promise<Fork | null>;
  findByAssignmentId(assignmentId: string): Promise<Fork[]>;
  findByStudentId(studentId: string): Promise<Fork[]>;
  findByAssignmentAndStudent(assignmentId: string, studentId: string): Promise<Fork | null>;
  update(id: string, updates: Partial<Fork>): Promise<Fork>;
  delete(id: string): Promise<void>;
}

/**
 * User Repository Interface
 */
export interface IUserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGitHubId(githubId: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  update(id: string, updates: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

/**
 * Submission Repository Interface
 */
export interface ISubmissionRepository {
  create(submission: Submission): Promise<Submission>;
  findById(id: string): Promise<Submission | null>;
  findByForkId(forkId: string): Promise<Submission[]>;
  findByAssignmentId(assignmentId: string): Promise<Submission[]>;
  findByStudentAndCourse(studentId: string, courseId: string): Promise<Submission[]>;
  update(id: string, updates: Partial<Submission>): Promise<Submission>;
  delete(id: string): Promise<void>;
}

/**
 * Notification Repository Interface
 */
export interface INotificationRepository {
  create(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(userId: string, unreadOnly: boolean): Promise<Notification[]>;
  update(id: string, updates: Partial<Notification>): Promise<Notification>;
  markAsRead(id: string): Promise<void>;
  markAllAsReadForUser(userId: string): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Auth Token Repository Interface
 */
export interface IAuthTokenRepository {
  create(token: AuthToken): Promise<AuthToken>;
  findByUserId(userId: string, provider: 'github' | 'google'): Promise<AuthToken | null>;
  update(
    userId: string,
    provider: 'github' | 'google',
    updates: Partial<AuthToken>
  ): Promise<AuthToken>;
  delete(userId: string, provider: 'github' | 'google'): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
