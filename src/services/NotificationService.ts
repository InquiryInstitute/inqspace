/**
 * Notification Service implementation
 * Handles in-app notifications for assignment events
 */

import { Notification, Submission, Grade, Feedback } from '../types/models';
import { INotificationService } from '../types/services';
import {
  INotificationRepository,
  IAssignmentRepository,
  IForkRepository,
  ISubmissionRepository,
  ICourseRepository,
} from '../types/repositories';
import { randomBytes } from 'crypto';

/**
 * Custom error class for notification service errors
 */
export class NotificationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

/**
 * NotificationService implementation
 * Handles in-app notifications for assignment events
 */
export class NotificationService implements INotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly assignmentRepository: IAssignmentRepository,
    private readonly forkRepository: IForkRepository,
    private readonly submissionRepository: ISubmissionRepository,
    private readonly courseRepository: ICourseRepository
  ) {}

  /**
   * Send a notification to a user
   */
  async sendNotification(userId: string, notification: Notification): Promise<void> {
    if (!userId || userId.trim().length === 0) {
      throw new NotificationServiceError('User ID is required');
    }
    if (!notification.title || notification.title.trim().length === 0) {
      throw new NotificationServiceError('Notification title is required');
    }
    if (!notification.message || notification.message.trim().length === 0) {
      throw new NotificationServiceError('Notification message is required');
    }

    const newNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      userId,
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepository.create(newNotification);
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, unreadOnly: boolean): Promise<Notification[]> {
    if (!userId || userId.trim().length === 0) {
      throw new NotificationServiceError('User ID is required');
    }

    return await this.notificationRepository.findByUserId(userId, unreadOnly);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    if (!notificationId || notificationId.trim().length === 0) {
      throw new NotificationServiceError('Notification ID is required');
    }

    const notification = await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new NotificationServiceError(`Notification with id ${notificationId} not found`);
    }

    await this.notificationRepository.update(notificationId, {
      read: true,
      readAt: new Date(),
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId || userId.trim().length === 0) {
      throw new NotificationServiceError('User ID is required');
    }

    const notifications = await this.notificationRepository.findByUserId(userId, false);
    for (const notification of notifications) {
      if (!notification.read) {
        await this.notificationRepository.update(notification.id, {
          read: true,
          readAt: new Date(),
        });
      }
    }
  }

  /**
   * Generate deadline notifications for students
   * Validates: Requirements 12.1
   */
  async generateDeadlineNotifications(assignmentId: string, daysBefore: number = 3): Promise<void> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotificationServiceError(`Assignment with id ${assignmentId} not found`);
    }

    if (!assignment.deadline) {
      throw new NotificationServiceError('Assignment has no deadline set');
    }

    const deadline = new Date(assignment.deadline);
    const notificationDate = new Date(deadline);
    notificationDate.setDate(notificationDate.getDate() - daysBefore);

    // Only generate notifications if we're at the right time
    const now = new Date();
    if (now < notificationDate) {
      return; // Too early to send notifications
    }

    // Get all forks for this assignment
    const forks = await this.forkRepository.findByAssignmentId(assignmentId);

    // For each fork, check if student has submitted
    for (const fork of forks) {
      const submissions = await this.submissionRepository.findByForkId(fork.id);
      const hasSubmitted = submissions.length > 0;

      if (!hasSubmitted) {
        // Create deadline notification for student
        const notification: Notification = {
          id: this.generateNotificationId(),
          userId: fork.studentId,
          type: 'deadline_approaching',
          title: 'Assignment Deadline Approaching',
          message: `The deadline for "${assignment.name}" is on ${deadline.toLocaleDateString()}. Please submit your work before then.`,
          relatedEntityId: assignmentId,
          relatedEntityType: 'assignment',
          read: false,
          createdAt: new Date(),
        };

        await this.notificationRepository.create(notification);
      }
    }
  }

  /**
   * Generate late submission notification for instructor
   * Validates: Requirements 12.2
   */
  async generateLateSubmissionNotification(submission: Submission): Promise<void> {
    if (!submission.assignmentId) {
      throw new NotificationServiceError('Submission has no assignment ID');
    }

    const assignment = await this.assignmentRepository.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotificationServiceError(`Assignment with id ${submission.assignmentId} not found`);
    }

    // Get course information to find instructor
    const course = await this.courseRepository.findById(assignment.courseId);
    if (!course) {
      throw new NotificationServiceError(`Course with id ${assignment.courseId} not found`);
    }

    // Create notification for instructor
    const notification: Notification = {
      id: this.generateNotificationId(),
      userId: course.instructorId,
      type: 'late_submission',
      title: 'Late Submission Received',
      message: `A student has submitted "${assignment.name}" after the deadline. View the submission in the grading console.`,
      relatedEntityId: submission.id,
      relatedEntityType: 'submission',
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepository.create(notification);
  }

  /**
   * Generate assignment update notifications for students
   * Validates: Requirements 13.1
   */
  async generateAssignmentUpdateNotifications(assignmentId: string, updateMessage: string): Promise<void> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotificationServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Get all forks for this assignment
    const forks = await this.forkRepository.findByAssignmentId(assignmentId);

    // Create notification for each student
    for (const fork of forks) {
      const notification: Notification = {
        id: this.generateNotificationId(),
        userId: fork.studentId,
        type: 'assignment_updated',
        title: 'Assignment Updated',
        message: `The instructor has updated "${assignment.name}": ${updateMessage}`,
        relatedEntityId: assignmentId,
        relatedEntityType: 'assignment',
        read: false,
        createdAt: new Date(),
      };

      await this.notificationRepository.create(notification);
    }
  }

  /**
   * Generate notification for grading completion
   */
  async generateGradingNotification(submission: Submission, grade: Grade): Promise<void> {
    if (!submission.assignmentId) {
      throw new NotificationServiceError('Submission has no assignment ID');
    }

    const assignment = await this.assignmentRepository.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotificationServiceError(`Assignment with id ${submission.assignmentId} not found`);
    }

    // Create notification for student
    const notification: Notification = {
      id: this.generateNotificationId(),
      userId: submission.studentId,
      type: 'graded',
      title: 'Assignment Graded',
      message: `Your submission for "${assignment.name}" has been graded with a score of ${grade.score}/${grade.maxScore}.`,
      relatedEntityId: submission.id,
      relatedEntityType: 'submission',
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepository.create(notification);
  }

  /**
   * Generate notification for feedback added
   */
  async generateFeedbackNotification(submission: Submission, _feedback: Feedback): Promise<void> {
    if (!submission.assignmentId) {
      throw new NotificationServiceError('Submission has no assignment ID');
    }

    const assignment = await this.assignmentRepository.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotificationServiceError(`Assignment with id ${submission.assignmentId} not found`);
    }

    // Create notification for student
    const notification: Notification = {
      id: this.generateNotificationId(),
      userId: submission.studentId,
      type: 'feedback_added',
      title: 'New Feedback Added',
      message: `The instructor has added feedback to your submission for "${assignment.name}".`,
      relatedEntityId: submission.id,
      relatedEntityType: 'submission',
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepository.create(notification);
  }

  /**
   * Generate a unique notification ID
   */
  private generateNotificationId(): string {
    return randomBytes(16).toString('hex');
  }
}
