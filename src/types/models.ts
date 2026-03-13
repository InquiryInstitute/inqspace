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

export interface CourseMetadata {
  semester?: string;
  year?: number;
  description?: string;
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
