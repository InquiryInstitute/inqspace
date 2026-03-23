/**
 * Core data models for GitHub Classroom Support
 */

/**
 * Course entity representing an academic offering
 * Associated with exactly one GitHub Organization
 */
export interface Course {
  id: string; // UUID
  name: string; // Course name
  instructorId: string; // Reference to User
  githubOrgName: string; // GitHub Organization name
  githubOrgId: string; // GitHub Organization ID
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  metadata: CourseMetadata;
}

/** LRS / xAPI integration (per course). Password field is opaque: encrypt at rest in production. */
export interface CourseXapiIntegration {
  enabled: boolean;
  lrsBaseUrl: string;
  lrsBasicUsername: string;
  lrsBasicPasswordSecret: string;
  activityBaseIri?: string;
}

/** iframe embed policy for guided lectures (per course). */
export interface CourseEmbedIntegration {
  enabled: boolean;
  /** HTTPS origins allowed to frame inQspace, e.g. https://canvas.school.edu */
  allowedFrameAncestors: string[];
}

export interface CourseMetadata {
  semester?: string;
  year?: number;
  description?: string;
  xapi?: CourseXapiIntegration;
  embed?: CourseEmbedIntegration;
}

/**
 * Assignment entity representing a coursework task
 */
export interface Assignment {
  id: string; // UUID
  courseId: string; // Reference to Course
  name: string; // Assignment name
  repositoryName: string; // GitHub repository name
  repositoryUrl: string; // Full GitHub URL
  templateRepositoryUrl?: string; // Optional template source
  deadline?: Date;
  allowLateSubmissions: boolean;
  devcontainerPath: string; // Path to devcontainer.json
  visibility: 'public' | 'private';
  createdAt: Date;
  updatedAt: Date;
  configuration: AssignmentConfig;
}

export interface AssignmentConfig {
  autoGrading: boolean;
  maxAttempts?: number;
  requiredFiles: string[];
  starterCode: boolean;
}

/**
 * Fork entity representing a student's copy of an assignment
 */
export interface Fork {
  id: string; // UUID
  assignmentId: string; // Reference to Assignment
  studentId: string; // Reference to User
  githubRepoUrl: string; // Student's forked repository URL
  githubRepoId: string; // GitHub repository ID
  forkedAt: Date;
  lastSyncedAt?: Date;
  status: 'active' | 'submitted' | 'graded';
  environmentSetup: EnvironmentSetup;
  updatedAt?: Date;
}

export interface EnvironmentSetup {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  lastAttempt?: Date;
  errorMessage?: string;
}

/**
 * User entity representing students, instructors, and admins
 */
export interface User {
  id: string; // UUID
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  githubUsername?: string;
  githubId?: string;
  googleId?: string;
  createdAt: Date;
  lastLoginAt: Date;
  enrollments: Enrollment[];
  updatedAt?: Date;
}

export interface Enrollment {
  courseId: string;
  role: 'student' | 'instructor';
  enrolledAt: Date;
}

/**
 * Submission entity representing a student's assignment submission
 */
export interface Submission {
  id: string; // UUID
  forkId: string; // Reference to Fork
  studentId: string; // Reference to User
  assignmentId: string; // Reference to Assignment
  submittedAt: Date;
  pullRequestUrl: string; // GitHub PR URL
  pullRequestNumber: number;
  status: 'pending' | 'graded' | 'returned';
  grade?: Grade;
  feedback: Feedback[];
  updatedAt?: Date;
}

export interface Grade {
  score: number;
  maxScore: number;
  gradedBy: string; // Reference to User (instructor)
  gradedAt: Date;
  comments?: string;
}

export interface Feedback {
  id: string;
  authorId: string; // Reference to User
  content: string;
  lineNumber?: number; // For inline code comments
  filePath?: string;
  createdAt: Date;
}

/**
 * Notification entity for system events
 */
export interface Notification {
  id: string; // UUID
  userId: string; // Reference to User
  type:
    | 'deadline_approaching'
    | 'late_submission'
    | 'assignment_updated'
    | 'graded'
    | 'feedback_added';
  title: string;
  message: string;
  relatedEntityId?: string; // Assignment, Submission, etc.
  relatedEntityType?: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
  updatedAt?: Date;
}

/**
 * AuthToken entity for storing authentication credentials
 */
export interface AuthToken {
  userId: string;
  provider: 'github' | 'google';
  accessToken: string; // Encrypted at rest
  refreshToken?: string; // Encrypted at rest
  expiresAt: Date;
  scope: string[];
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * DevcontainerConfig entity representing development environment configuration
 */
export interface DevcontainerConfig {
  image?: string;
  dockerFile?: string;
  build?: DevcontainerBuild;
  features?: Record<string, any>;
  customizations?: DevcontainerCustomizations;
  forwardPorts?: number[];
  postCreateCommand?: string | string[];
  postStartCommand?: string | string[];
  remoteUser?: string;
}

export interface DevcontainerBuild {
  dockerfile?: string;
  context?: string;
  args?: Record<string, string>;
}

export interface DevcontainerCustomizations {
  vscode?: VsCodeCustomizations;
}

export interface VsCodeCustomizations {
  extensions?: string[];
  settings?: Record<string, any>;
}

/**
 * Codespace entity representing a GitHub Codespace instance
 */
export interface Codespace {
  id: string;
  name: string;
  environmentName: string;
  state: 'Starting' | 'Available' | 'Stopping' | 'Stopped' | 'Error';
  createdAt: Date;
  lastUsedAt?: Date;
  idleTimeout?: string;
  retentionPeriod?: string;
  gitStatus?: GitStatus;
  ports?: CodespacePort[];
}

export interface GitStatus {
  ref: string;
  sha: string;
  ahead: number;
  behind: number;
}

export interface CodespacePort {
  port: number;
  visibility: 'public' | 'private' | 'org';
  url?: string;
}

/**
 * VS Code IDE Configuration for codespaces
 */
export interface VsCodeIdeConfig {
  enabled: boolean;
  serverType: 'code-server' | 'openvscode-server';
  port: number;
  mcpPort: number;
  auth: 'none' | 'password' | 'token';
  password?: string;
  trustedOrigins?: string[];
  disableTelemetry?: boolean;
  disableWorkspaceTrust?: boolean;
}

/**
 * MCP (Model Context Protocol) Command for VS Code IDE
 */
export interface McpCommand {
  jsonrpc: string;
  id: string | number;
  method: string;
  params: McpCommandParams;
}

export interface McpCommandParams {
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP Response from VS Code IDE
 */
export interface McpResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: McpError;
}

export interface McpError {
  code: number;
  message: string;
  data?: any;
}

/**
 * VS Code IDE Action types for MCP commands
 */
export type VsCodeAction =
  | 'openFile'
  | 'revealLine'
  | 'focusTerminal'
  | 'runTask'
  | 'highlightText'
  | 'createTerminal'
  | 'sendToTerminal'
  | 'executeCommand'
  | 'showMessage';

/**
 * VS Code IDE Action Parameters
 */
export interface VsCodeActionParams {
  path?: string;
  line?: number;
  column?: number;
  command?: string;
  args?: any[];
  message?: string;
  type?: 'info' | 'warning' | 'error';
  terminalName?: string;
  text?: string;
}

/**
 * Health Check Result for VS Code IDE
 */
export interface IdeHealthCheck {
  healthy: boolean;
  codespaceState: 'Starting' | 'Available' | 'Stopping' | 'Stopped' | 'Error';
  mcpServer: boolean;
  codeServer: boolean;
  lastCheck: Date;
  errorMessage?: string;
}

/**
 * Codespace Lifecycle Management
 */
export interface ICodespaceLifecycleService {
  createCodespace(repoId: string, ref: string, config?: CodespaceConfig): Promise<Codespace>;
  startCodespace(codespaceName: string): Promise<Codespace>;
  stopCodespace(codespaceName: string): Promise<void>;
  deleteCodespace(codespaceName: string): Promise<void>;
  getCodespace(codespaceName: string): Promise<Codespace>;
  listCodespaces(): Promise<Codespace[]>;
  healthCheck(codespaceName: string): Promise<IdeHealthCheck>;
}

export interface CodespaceConfig {
  machine?: string;
  idleTimeout?: string;
  retentionPeriod?: string;
  gitClone?: boolean;
  devcontainerPath?: string;
  ports?: number[];
}
