/**
 * Dependency Injection Container for GitHub Classroom Support
 * Centralized service wiring and configuration
 */

import { GitHubClient } from '../integration/GitHubClient';
import {
  CourseManagementService,
  AssignmentService,
  GradingService,
  NotificationService,
  SyncService,
  AuthService,
  DevcontainerParser,
  VsCodeIdeService,
  JupyterBookParser,
  JupyterBookService,
} from '../services';
import { XapiPipeline } from '../xapi/xapiPipeline';
import {
  ICourseRepository,
  IAssignmentRepository,
  IForkRepository,
  ISubmissionRepository,
  INotificationRepository,
  IUserRepository,
  IAuthTokenRepository,
} from '../types/repositories';
import {
  ICourseManagementService,
  IAssignmentService,
  IGradingService,
  INotificationService,
  ISyncService,
  IAuthService,
  IDevcontainerParser,
  IVsCodeIdeService,
  IGitHubClient,
  IJupyterBookService,
} from '../types/services';

/**
 * Repository interfaces (to be implemented by data layer)
 */
export interface Repositories {
  courseRepository: ICourseRepository;
  assignmentRepository: IAssignmentRepository;
  forkRepository: IForkRepository;
  submissionRepository: ISubmissionRepository;
  notificationRepository: INotificationRepository;
  userRepository: IUserRepository;
  authTokenRepository: IAuthTokenRepository;
}

/**
 * Service instances container
 */
export interface Services {
  githubClient: IGitHubClient;
  courseManagementService: ICourseManagementService;
  assignmentService: IAssignmentService;
  gradingService: IGradingService;
  notificationService: INotificationService;
  syncService: ISyncService;
  authService: IAuthService;
  devcontainerParser: IDevcontainerParser;
  vsCodeIdeService: IVsCodeIdeService;
  jupyterBookService: IJupyterBookService;
}

/**
 * Configuration for the DI container
 */
export interface DIContainerConfig {
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  encryptionSecret?: string;
  defaultGitHubToken?: string;
}

/**
 * Dependency Injection Container
 * Creates and wires all services together
 */
export class DIContainer {
  private services: Services | null = null;

  /**
   * Create services with dependency injection
   */
  public createServices(
    repositories: Repositories,
    config: DIContainerConfig = {}
  ): Services {
    if (this.services) {
      return this.services;
    }

    // Create GitHub Client
    const githubClient = new GitHubClient(config.defaultGitHubToken);

    // Create Devcontainer Parser
    const devcontainerParser = new DevcontainerParser();

    const jupyterBookParser = new JupyterBookParser();
    const jupyterBookService = new JupyterBookService(
      repositories.courseRepository,
      repositories.assignmentRepository,
      jupyterBookParser
    );

    // Create Auth Service
    const authService = new AuthService(
      githubClient,
      config.githubClientId,
      config.githubClientSecret,
      config.encryptionSecret,
      config.googleClientId,
      config.googleClientSecret
    );

    // Create Course Management Service
    const courseManagementService = new CourseManagementService(
      githubClient,
      repositories.courseRepository
    );

    const xapiPipeline = new XapiPipeline(repositories.courseRepository, repositories.userRepository);

    // Create Assignment Service
    const assignmentService = new AssignmentService(
      githubClient,
      repositories.assignmentRepository,
      repositories.forkRepository,
      xapiPipeline
    );

    // Create Grading Service
    const gradingService = new GradingService(
      githubClient,
      repositories.assignmentRepository,
      repositories.forkRepository,
      repositories.submissionRepository,
      xapiPipeline
    );

    // Create Notification Service
    const notificationService = new NotificationService(
      repositories.notificationRepository,
      repositories.assignmentRepository,
      repositories.forkRepository,
      repositories.submissionRepository,
      repositories.courseRepository
    );

    // Create Sync Service
    const syncService = new SyncService(
      githubClient,
      repositories.forkRepository,
      repositories.assignmentRepository
    );

    // Create VS Code IDE Service
    const vsCodeIdeService = new VsCodeIdeService(githubClient);

    this.services = {
      githubClient,
      courseManagementService,
      assignmentService,
      gradingService,
      notificationService,
      syncService,
      authService,
      devcontainerParser,
      vsCodeIdeService,
      jupyterBookService,
    };

    return this.services;
  }

  /**
   * Get the services container
   */
  public getServices(): Services {
    if (!this.services) {
      throw new Error('Services not initialized. Call createServices() first.');
    }
    return this.services;
  }

  /**
   * Reset the container (useful for testing)
   */
  public reset(): void {
    this.services = null;
  }
}

/**
 * Default container instance
 */
export const defaultContainer = new DIContainer();
