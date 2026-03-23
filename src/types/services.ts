/**
 * Service interfaces for GitHub Classroom Support
 */

import {
  Course,
  Assignment,
  AssignmentConfig,
  Fork,
  User,
  Submission,
  Grade,
  Feedback,
  Notification,
  DevcontainerConfig,
  AuthToken,
  Codespace,
  CodespaceConfig,
  IdeHealthCheck,
  McpCommand,
  McpResponse,
  VsCodeIdeConfig,
  VsCodeAction,
  JupyterBookEffectiveConfig,
  JupyterBookProjectMeta,
  CourseJupyterBookIntegration,
  JupyterBookPathConfig,
} from './models';

// Re-export types for convenience
export {
  DevcontainerConfig,
  Codespace,
  CodespaceConfig,
  IdeHealthCheck,
  McpCommand,
  McpResponse,
  VsCodeIdeConfig,
} from './models';

export type { XapiDomainEvent } from '../xapi/xapiEvents';
export type { IXapiEventSink } from '../xapi/xapiSinkTypes';

/**
 * Course Management Service Interface
 */
export interface ICourseManagementService {
  createCourse(instructorId: string, courseName: string, orgName: string): Promise<Course>;
  getCourse(courseId: string): Promise<Course>;
  updateCourse(courseId: string, updates: Partial<Course>): Promise<Course>;
  deleteCourse(courseId: string, confirmOrgDeletion: boolean): Promise<void>;
  listCoursesByInstructor(instructorId: string): Promise<Course[]>;
  associateGitHubOrg(courseId: string, orgName: string): Promise<void>;
}

/**
 * Assignment Service Interface
 */
export interface IAssignmentService {
  createAssignment(
    courseId: string,
    config: AssignmentConfig,
    templateRepositoryUrl?: string
  ): Promise<Assignment>;
  getAssignment(assignmentId: string): Promise<Assignment>;
  updateAssignment(assignmentId: string, updates: Partial<AssignmentConfig>): Promise<Assignment>;
  deleteAssignment(assignmentId: string): Promise<void>;
  forkAssignment(assignmentId: string, studentId: string): Promise<Fork>;
  listAssignmentsByCourse(courseId: string): Promise<Assignment[]>;
  getStudentFork(assignmentId: string, studentId: string): Promise<Fork | null>;
}

/**
 * GitHub Client Interface
 */
export interface IGitHubClient {
  // Organization operations
  createOrganization(name: string, adminToken: string): Promise<GitHubOrganization>;
  getOrganization(name: string): Promise<GitHubOrganization>;
  deleteOrganization(name: string, adminToken: string): Promise<void>;

  // Repository operations
  createRepository(
    orgName: string,
    repoName: string,
    config: RepositoryConfig
  ): Promise<GitHubRepository>;
  forkRepository(owner: string, repo: string, targetOwner: string): Promise<GitHubRepository>;
  getRepository(owner: string, repo: string): Promise<GitHubRepository>;
  syncFork(
    owner: string,
    repo: string,
    upstreamOwner: string,
    upstreamRepo: string
  ): Promise<SyncResult>;

  // Pull request operations
  createPullRequest(owner: string, repo: string, pr: PullRequestConfig): Promise<GitHubPullRequest>;

  // Authentication
  authenticateWithOAuth(code: string, clientId?: string, clientSecret?: string): Promise<AuthToken>;
  refreshToken(refreshToken: string, clientId?: string, clientSecret?: string): Promise<AuthToken>;
  validateToken(token: string): Promise<boolean>;
}

export interface GitHubOrganization {
  id: string;
  name: string;
  login: string;
  url: string;
}

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  visibility: 'public' | 'private';
}

export interface RepositoryConfig {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  templateRepository?: string;
  autoInit?: boolean;
}

export interface SyncResult {
  success: boolean;
  conflicts: string[];
  message: string;
}

export interface PullRequestConfig {
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  url: string;
  title: string;
  state: 'open' | 'closed' | 'merged';
}

/**
 * Auth Service Interface
 */
export interface IAuthService {
  // GitHub authentication
  initiateGitHubAuth(): Promise<string>; // Returns OAuth URL
  completeGitHubAuth(code: string): Promise<User>;

  // Google Workspace authentication
  initiateGoogleAuth(): Promise<string>; // Returns OAuth URL
  completeGoogleAuth(code: string): Promise<User>;

  // Token management
  getGitHubToken(userId: string): Promise<string>;
  refreshGitHubToken(userId: string): Promise<string>;
  revokeTokens(userId: string): Promise<void>;

  // Session management
  validateSession(sessionId: string): Promise<User>;
  createSession(userId: string): Promise<string>;
  destroySession(sessionId: string): Promise<void>;
}

/**
 * Grading Service Interface
 */
export interface IGradingService {
  submitAssignment(forkId: string, studentId: string): Promise<Submission>;
  getSubmission(submissionId: string): Promise<Submission>;
  gradeSubmission(submissionId: string, grade: Grade): Promise<void>;
  addFeedback(submissionId: string, feedback: Feedback): Promise<void>;
  listSubmissionsByAssignment(assignmentId: string): Promise<Submission[]>;
  getStudentSubmissions(studentId: string, courseId: string): Promise<Submission[]>;
}

/**
 * Devcontainer Parser Interface
 */
export interface IDevcontainerParser {
  parse(content: string): Promise<DevcontainerConfig>;
  validate(config: DevcontainerConfig): Promise<ValidationResult>;
  extractDependencies(config: DevcontainerConfig): string[];
  getImage(config: DevcontainerConfig): string;
  getFeatures(config: DevcontainerConfig): Feature[];
}

/** Parse `_config.yml` / `_toc.yml` for Jupyter Book projects. */
export interface IJupyterBookParser {
  parseProjectConfig(yamlContent: string): { meta: JupyterBookProjectMeta; error?: string };
  parseTocStructure(yamlContent: string): { rootEntries: number; error?: string };
}

export interface JupyterBookParseBundle {
  config?: JupyterBookProjectMeta;
  tocRootEntries?: number;
  errors: string[];
}

/**
 * Jupyter Book as a first-class course/assignment surface (paths, Pages URLs, YAML helpers).
 */
export interface IJupyterBookService {
  getEffectiveForAssignment(assignmentId: string): Promise<JupyterBookEffectiveConfig>;
  getCourseIntegration(courseId: string): Promise<CourseJupyterBookIntegration | null>;
  mergePaths(course: Course, assignment: Assignment): JupyterBookPathConfig;
  parseYamlBundle(configYaml: string, tocYaml?: string): JupyterBookParseBundle;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  line?: number;
}

export interface Feature {
  name: string;
  options?: Record<string, any>;
}

/**
 * Notification Service Interface
 */
export interface INotificationService {
  sendNotification(userId: string, notification: Notification): Promise<void>;
  getNotifications(userId: string, unreadOnly: boolean): Promise<Notification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
}

/**
 * Sync Service Interface
 */
export interface ISyncService {
  checkForUpdates(forkId: string): Promise<UpdateStatus>;
  syncFork(forkId: string): Promise<SyncResult>;
  notifyStudentsOfUpdates(assignmentId: string): Promise<void>;
  resolveMergeConflicts(forkId: string, resolution: ConflictResolution): Promise<void>;
}

export interface UpdateStatus {
  hasUpdates: boolean;
  commitCount: number;
  lastUpdate?: Date;
}

export interface ConflictResolution {
  files: ConflictFile[];
  strategy: 'ours' | 'theirs' | 'manual';
}

export interface ConflictFile {
  path: string;
  resolution: string;
}

/**
 * VS Code IDE Service Interface
 * Manages VS Code IDE embedding and scripting via MCP
 */
export interface IVsCodeIdeService {
  // Codespace lifecycle management
  createCodespace(repoId: string, ref: string, config?: CodespaceConfig): Promise<Codespace>;
  startCodespace(codespaceName: string): Promise<Codespace>;
  stopCodespace(codespaceName: string): Promise<void>;
  deleteCodespace(codespaceName: string): Promise<void>;
  getCodespace(codespaceName: string): Promise<Codespace>;
  listCodespaces(): Promise<Codespace[]>;
  healthCheck(codespaceName: string): Promise<IdeHealthCheck>;

  // VS Code IDE configuration
  configureVsCodeIde(codespaceName: string, config: VsCodeIdeConfig): Promise<void>;
  getVsCodeIdeConfig(codespaceName: string): Promise<VsCodeIdeConfig>;

  // MCP command execution
  sendMcpCommand(codespaceName: string, command: McpCommand): Promise<McpResponse>;
  executeVsCodeAction(codespaceName: string, action: VsCodeAction, params: any): Promise<any>;

  // Port management
  getPortUrl(codespaceName: string, port: number): string;
  getMcpEndpointUrl(codespaceName: string): string;
  getCodeServerUrl(codespaceName: string): string;
}
