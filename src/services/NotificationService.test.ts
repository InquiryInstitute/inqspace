/**
 * Unit tests for NotificationService
 */

import { NotificationService, NotificationServiceError } from './NotificationService';
import {
  INotificationRepository,
  IAssignmentRepository,
  IForkRepository,
  ISubmissionRepository,
  ICourseRepository,
} from '../types/repositories';
import { Notification, Assignment, Fork, Course } from '../types/models';

// Mock NotificationRepository
class MockNotificationRepository implements Pick<INotificationRepository, 'create' | 'findById' | 'findByUserId' | 'update' | 'markAsRead' | 'markAllAsReadForUser' | 'delete'> {
  private notifications: Map<string, Notification> = new Map();

  setNotifications(notifications: Notification[]) {
    this.notifications.clear();
    for (const notification of notifications) {
      this.notifications.set(notification.id, { ...notification });
    }
  }

  async create(notification: Notification): Promise<Notification> {
    this.notifications.set(notification.id, { ...notification });
    return { ...notification };
  }

  async findById(id: string): Promise<Notification | null> {
    const notification = this.notifications.get(id);
    return notification ? { ...notification } : null;
  }

  async findByUserId(userId: string, unreadOnly: boolean): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values())
      .filter((n) => n.userId === userId);

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

    const updated = {
      ...existing,
      ...updates,
    };

    this.notifications.set(id, updated);
    return { ...updated };
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }

    this.notifications.set(id, {
      ...notification,
      read: true,
      readAt: new Date(),
    });
  }

  async markAllAsReadForUser(userId: string): Promise<void> {
    for (const notification of this.notifications.values()) {
      if (notification.userId === userId && !notification.read) {
        this.notifications.set(notification.id, {
          ...notification,
          read: true,
          readAt: new Date(),
        });
      }
    }
  }

  async delete(id: string): Promise<void> {
    this.notifications.delete(id);
  }
}

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

// Mock ForkRepository
class MockForkRepository implements Pick<IForkRepository, 'create' | 'findById' | 'findByAssignmentId' | 'findByStudentId' | 'findByAssignmentAndStudent' | 'update' | 'delete'> {
  private forks: Map<string, Fork> = new Map();

  setForks(forks: Fork[]) {
    this.forks.clear();
    for (const fork of forks) {
      this.forks.set(fork.id, { ...fork });
    }
  }

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

  async findByAssignmentAndStudent(assignmentId: string, studentId: string): Promise<Fork | null> {
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

    const updated = {
      ...existing,
      ...updates,
    };

    this.forks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.forks.delete(id);
  }
}

class MockSubmissionRepository implements Pick<ISubmissionRepository, 'findByForkId'> {
  async findByForkId(_forkId: string): Promise<never[]> {
    return [];
  }
}

class MockCourseRepository implements Pick<ICourseRepository, 'findById'> {
  async findById(id: string): Promise<Course | null> {
    return {
      id,
      name: 'Course',
      instructorId: 'inst-1',
      githubOrgName: 'org',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: {},
    };
  }
}

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockNotificationRepository: MockNotificationRepository;
  let mockAssignmentRepository: MockAssignmentRepository;
  let mockForkRepository: MockForkRepository;
  let mockSubmissionRepository: MockSubmissionRepository;
  let mockCourseRepository: MockCourseRepository;

  beforeEach(() => {
    mockNotificationRepository = new MockNotificationRepository();
    mockAssignmentRepository = new MockAssignmentRepository();
    mockForkRepository = new MockForkRepository();
    mockSubmissionRepository = new MockSubmissionRepository();
    mockCourseRepository = new MockCourseRepository();
    notificationService = new NotificationService(
      mockNotificationRepository,
      mockAssignmentRepository,
      mockForkRepository,
      mockSubmissionRepository as unknown as ISubmissionRepository,
      mockCourseRepository as unknown as ICourseRepository
    );
  });

  describe('sendNotification', () => {
    it('should send notification to user', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      await notificationService.sendNotification('user-123', notification);

      const notifications = await mockNotificationRepository.findByUserId('user-123', false);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Deadline Approaching');
    });

    it('should throw error if user ID is empty', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      await expect(notificationService.sendNotification('', notification)).rejects.toThrow(
        NotificationServiceError
      );
    });

    it('should throw error if notification title is empty', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: '',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      await expect(notificationService.sendNotification('user-123', notification)).rejects.toThrow(
        NotificationServiceError
      );
    });

    it('should throw error if notification message is empty', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: '',
        read: false,
        createdAt: new Date(),
      };

      await expect(notificationService.sendNotification('user-123', notification)).rejects.toThrow(
        NotificationServiceError
      );
    });
  });

  describe('getNotifications', () => {
    it('should return notifications for user', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      await mockNotificationRepository.create(notification);

      const notifications = await notificationService.getNotifications('user-123', false);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Deadline Approaching');
    });

    it('should return only unread notifications when requested', async () => {
      const notification1: Notification = {
        id: 'notification-1',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      const notification2: Notification = {
        id: 'notification-2',
        userId: 'user-123',
        type: 'graded',
        title: 'Assignment Graded',
        message: 'Your assignment has been graded',
        read: true,
        createdAt: new Date(),
      };

      await mockNotificationRepository.create(notification1);
      await mockNotificationRepository.create(notification2);

      const unreadNotifications = await notificationService.getNotifications('user-123', true);

      expect(unreadNotifications).toHaveLength(1);
      expect(unreadNotifications[0].id).toBe('notification-1');
    });

    it('should throw error if user ID is empty', async () => {
      await expect(notificationService.getNotifications('', false)).rejects.toThrow(
        NotificationServiceError
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification: Notification = {
        id: 'notification-123',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      await mockNotificationRepository.create(notification);

      await notificationService.markAsRead('notification-123');

      const updatedNotification = await mockNotificationRepository.findById('notification-123');
      expect(updatedNotification?.read).toBe(true);
      expect(updatedNotification?.readAt).toBeDefined();
    });

    it('should throw error if notification ID is empty', async () => {
      await expect(notificationService.markAsRead('')).rejects.toThrow(NotificationServiceError);
    });

    it('should throw error if notification not found', async () => {
      await expect(notificationService.markAsRead('non-existent-notification')).rejects.toThrow(
        NotificationServiceError
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const notification1: Notification = {
        id: 'notification-1',
        userId: 'user-123',
        type: 'deadline_approaching',
        title: 'Deadline Approaching',
        message: 'Assignment deadline is coming up',
        read: false,
        createdAt: new Date(),
      };

      const notification2: Notification = {
        id: 'notification-2',
        userId: 'user-123',
        type: 'graded',
        title: 'Assignment Graded',
        message: 'Your assignment has been graded',
        read: false,
        createdAt: new Date(),
      };

      await mockNotificationRepository.create(notification1);
      await mockNotificationRepository.create(notification2);

      await notificationService.markAllAsRead('user-123');

      const allNotifications = await mockNotificationRepository.findByUserId('user-123', false);
      expect(allNotifications.every((n) => n.read)).toBe(true);
    });

    it('should throw error if user ID is empty', async () => {
      await expect(notificationService.markAllAsRead('')).rejects.toThrow(NotificationServiceError);
    });
  });
});
