# Design Document: GitHub Classroom Support

## Overview

This design document specifies the architecture and implementation approach for GitHub Classroom support in inQspace. The system enables instructors to create and manage courses using GitHub Organizations, with students forking assignment repositories similar to GitHub Classroom workflows. The design integrates GitHub's repository management with Google Workspace authentication while maintaining devcontainer compatibility for consistent development environments.

### Key Design Goals

1. **GitHub Organization per Course**: Each course maps to a single GitHub Organization containing all assignment repositories
2. **Fork-based Workflow**: Students fork assignment repositories to their personal GitHub accounts
3. **Devcontainer Compatibility**: Full support for devcontainer.json specifications matching GitHub Codespaces
4. **Dual Authentication**: Support both GitHub OAuth and Google Workspace SSO
5. **Assignment Lifecycle Management**: Complete workflow from creation through submission and grading

### System Boundaries

The system integrates with:
- GitHub API (Organizations, Repositories, OAuth)
- Google Workspace API (Authentication, User Management)
- Devcontainer specification (Environment Configuration)

The system does NOT:
- Host git repositories (delegated to GitHub)
- Provide custom IDE features beyond devcontainer support
- Implement custom version control (uses GitHub's git infrastructure)

## Architecture

### High-Level Architecture

The system follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Student    │  │  Instructor  │  │    Admin     │      │
│  │  Dashboard   │  │   Console    │  │   Portal     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Course     │  │  Assignment  │  │   Grading    │      │
│  │  Management  │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Auth      │  │ Notification │  │   Sync       │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   GitHub     │  │   Google     │  │ Devcontainer │      │
│  │   Client     │  │  Workspace   │  │   Parser     │      │
│  │              │  │   Client     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Course     │  │  Assignment  │  │    User      │      │
│  │  Repository  │  │  Repository  │  │  Repository  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

#### Assignment Creation Flow
```
Instructor → Course Management → GitHub Client → GitHub API
                                      ↓
                              Create Repository
                                      ↓
                              Apply Template
                                      ↓
                         Store Assignment Metadata
```

#### Student Fork Flow
```
Student → Assignment Service → GitHub Client → GitHub API
                                    ↓
                              Fork Repository
                                    ↓
                         Record Fork Relationship
                                    ↓
                         Trigger Environment Setup
```

## Components and Interfaces

### 1. Course Management Service

**Responsibility**: Manages course lifecycle, GitHub Organization association, and instructor permissions.

**Interface**:
```typescript
interface CourseManagementService {
  createCourse(instructorId: string, courseName: string, orgName: string): Promise<Course>
  getCourse(courseId: string): Promise<Course>
  updateCourse(courseId: string, updates: Partial<Course>): Promise<Course>
  deleteCourse(courseId: string, confirmOrgDeletion: boolean): Promise<void>
  listCoursesByInstructor(instructorId: string): Promise<Course[]>
  associateGitHubOrg(courseId: string, orgName: string): Promise<void>
}
```

**Dependencies**:
- GitHub Client (for Organization operations)
- Course Repository (for persistence)
- Auth Service (for permission validation)

### 2. Assignment Service

**Responsibility**: Handles assignment creation, configuration, and student fork management.

**Interface**:
```typescript
interface AssignmentService {
  createAssignment(courseId: string, config: AssignmentConfig): Promise<Assignment>
  getAssignment(assignmentId: string): Promise<Assignment>
  updateAssignment(assignmentId: string, updates: Partial<AssignmentConfig>): Promise<Assignment>
  deleteAssignment(assignmentId: string): Promise<void>
  forkAssignment(assignmentId: string, studentId: string): Promise<Fork>
  listAssignmentsByCourse(courseId: string): Promise<Assignment[]>
  getStudentFork(assignmentId: string, studentId: string): Promise<Fork | null>
}
```

**Dependencies**:
- GitHub Client (for repository operations)
- Assignment Repository (for persistence)
- Devcontainer Parser (for configuration validation)
- Notification Service (for student alerts)

### 3. GitHub Client

**Responsibility**: Abstracts GitHub API interactions for organizations, repositories, and authentication.

**Interface**:
```typescript
interface GitHubClient {
  // Organization operations
  createOrganization(name: string, adminToken: string): Promise<Organization>
  getOrganization(name: string): Promise<Organization>
  deleteOrganization(name: string, adminToken: string): Promise<void>
  
  // Repository operations
  createRepository(orgName: string, repoName: string, config: RepoConfig): Promise<Repository>
  forkRepository(owner: string, repo: string, targetOwner: string): Promise<Repository>
  getRepository(owner: string, repo: string): Promise<Repository>
  syncFork(owner: string, repo: string, upstreamOwner: string, upstreamRepo: string): Promise<SyncResult>
  
  // Pull request operations
  createPullRequest(owner: string, repo: string, pr: PullRequestConfig): Promise<PullRequest>
  
  // Authentication
  authenticateWithOAuth(code: string): Promise<AuthToken>
  validateToken(token: string): Promise<boolean>
}
```

**Dependencies**:
- GitHub REST API v3
- GitHub OAuth App credentials

### 4. Auth Service

**Responsibility**: Manages dual authentication (GitHub OAuth and Google Workspace SSO).

**Interface**:
```typescript
interface AuthService {
  // GitHub authentication
  initiateGitHubAuth(): Promise<string> // Returns OAuth URL
  completeGitHubAuth(code: string): Promise<User>
  
  // Google Workspace authentication
  initiateGoogleAuth(): Promise<string> // Returns OAuth URL
  completeGoogleAuth(code: string): Promise<User>
  
  // Token management
  getGitHubToken(userId: string): Promise<string>
  refreshGitHubToken(userId: string): Promise<string>
  revokeTokens(userId: string): Promise<void>
  
  // Session management
  validateSession(sessionId: string): Promise<User>
  createSession(userId: string): Promise<string>
  destroySession(sessionId: string): Promise<void>
}
```

**Dependencies**:
- GitHub OAuth
- Google Workspace OAuth
- User Repository
- Token storage (encrypted)

### 5. Grading Service

**Responsibility**: Manages assignment submissions, grading, and feedback.

**Interface**:
```typescript
interface GradingService {
  submitAssignment(forkId: string, studentId: string): Promise<Submission>
  getSubmission(submissionId: string): Promise<Submission>
  gradeSubmission(submissionId: string, grade: Grade): Promise<void>
  addFeedback(submissionId: string, feedback: Feedback): Promise<void>
  listSubmissionsByAssignment(assignmentId: string): Promise<Submission[]>
  getStudentSubmissions(studentId: string, courseId: string): Promise<Submission[]>
}
```

**Dependencies**:
- GitHub Client (for pull request creation)
- Assignment Repository
- Notification Service

### 6. Devcontainer Parser

**Responsibility**: Parses and validates devcontainer.json configurations.

**Interface**:
```typescript
interface DevcontainerParser {
  parse(content: string): Promise<DevcontainerConfig>
  validate(config: DevcontainerConfig): Promise<ValidationResult>
  extractDependencies(config: DevcontainerConfig): string[]
  getImage(config: DevcontainerConfig): string
  getFeatures(config: DevcontainerConfig): Feature[]
}
```

**Dependencies**:
- JSON schema validator
- Devcontainer specification (compatible with GitHub Codespaces)

### 7. Notification Service

**Responsibility**: Manages in-app notifications for assignment events.

**Interface**:
```typescript
interface NotificationService {
  sendNotification(userId: string, notification: Notification): Promise<void>
  getNotifications(userId: string, unreadOnly: boolean): Promise<Notification[]>
  markAsRead(notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>
}
```

**Dependencies**:
- User Repository
- Notification Repository

### 8. Sync Service

**Responsibility**: Handles repository synchronization between forks and upstream assignments.

**Interface**:
```typescript
interface SyncService {
  checkForUpdates(forkId: string): Promise<UpdateStatus>
  syncFork(forkId: string): Promise<SyncResult>
  notifyStudentsOfUpdates(assignmentId: string): Promise<void>
  resolveMergeConflicts(forkId: string, resolution: ConflictResolution): Promise<void>
}
```

**Dependencies**:
- GitHub Client
- Notification Service
- Assignment Repository

## Data Models

### Course
```typescript
interface Course {
  id: string                    // UUID
  name: string                  // Course name
  instructorId: string          // Reference to User
  githubOrgName: string         // GitHub Organization name
  githubOrgId: string           // GitHub Organization ID
  createdAt: Date
  updatedAt: Date
  archived: boolean
  metadata: {
    semester?: string
    year?: number
    description?: string
  }
}
```

### Assignment
```typescript
interface Assignment {
  id: string                    // UUID
  courseId: string              // Reference to Course
  name: string                  // Assignment name
  repositoryName: string        // GitHub repository name
  repositoryUrl: string         // Full GitHub URL
  templateRepositoryUrl?: string // Optional template source
  deadline?: Date
  allowLateSubmissions: boolean
  devcontainerPath: string      // Path to devcontainer.json
  visibility: 'public' | 'private'
  createdAt: Date
  updatedAt: Date
  configuration: AssignmentConfig
}

interface AssignmentConfig {
  autoGrading: boolean
  maxAttempts?: number
  requiredFiles: string[]
  starterCode: boolean
}
```

### Fork
```typescript
interface Fork {
  id: string                    // UUID
  assignmentId: string          // Reference to Assignment
  studentId: string             // Reference to User
  githubRepoUrl: string         // Student's forked repository URL
  githubRepoId: string          // GitHub repository ID
  forkedAt: Date
  lastSyncedAt?: Date
  status: 'active' | 'submitted' | 'graded'
  environmentSetup: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    lastAttempt?: Date
    errorMessage?: string
  }
}
```

### User
```typescript
interface User {
  id: string                    // UUID
  email: string
  name: string
  role: 'student' | 'instructor' | 'admin'
  githubUsername?: string
  githubId?: string
  googleId?: string
  createdAt: Date
  lastLoginAt: Date
  enrollments: Enrollment[]
}

interface Enrollment {
  courseId: string
  role: 'student' | 'instructor'
  enrolledAt: Date
}
```

### Submission
```typescript
interface Submission {
  id: string                    // UUID
  forkId: string                // Reference to Fork
  studentId: string             // Reference to User
  assignmentId: string          // Reference to Assignment
  submittedAt: Date
  pullRequestUrl: string        // GitHub PR URL
  pullRequestNumber: number
  status: 'pending' | 'graded' | 'returned'
  grade?: Grade
  feedback: Feedback[]
}

interface Grade {
  score: number
  maxScore: number
  gradedBy: string              // Reference to User (instructor)
  gradedAt: Date
  comments?: string
}

interface Feedback {
  id: string
  authorId: string              // Reference to User
  content: string
  lineNumber?: number           // For inline code comments
  filePath?: string
  createdAt: Date
}
```

### Notification
```typescript
interface Notification {
  id: string                    // UUID
  userId: string                // Reference to User
  type: 'deadline_approaching' | 'late_submission' | 'assignment_updated' | 'graded' | 'feedback_added'
  title: string
  message: string
  relatedEntityId?: string      // Assignment, Submission, etc.
  relatedEntityType?: string
  read: boolean
  createdAt: Date
  readAt?: Date
}
```

### DevcontainerConfig
```typescript
interface DevcontainerConfig {
  image?: string
  dockerFile?: string
  build?: {
    dockerfile?: string
    context?: string
    args?: Record<string, string>
  }
  features?: Record<string, any>
  customizations?: {
    vscode?: {
      extensions?: string[]
      settings?: Record<string, any>
    }
  }
  forwardPorts?: number[]
  postCreateCommand?: string | string[]
  postStartCommand?: string | string[]
  remoteUser?: string
}
```

### AuthToken
```typescript
interface AuthToken {
  userId: string
  provider: 'github' | 'google'
  accessToken: string           // Encrypted at rest
  refreshToken?: string         // Encrypted at rest
  expiresAt: Date
  scope: string[]
  createdAt: Date
}
```

## API Specifications

### REST API Endpoints

#### Course Management

```
POST   /api/courses
GET    /api/courses/:courseId
PUT    /api/courses/:courseId
DELETE /api/courses/:courseId
GET    /api/courses/instructor/:instructorId
POST   /api/courses/:courseId/github-org
```

#### Assignment Management

```
POST   /api/courses/:courseId/assignments
GET    /api/assignments/:assignmentId
PUT    /api/assignments/:assignmentId
DELETE /api/assignments/:assignmentId
GET    /api/courses/:courseId/assignments
POST   /api/assignments/:assignmentId/fork
GET    /api/assignments/:assignmentId/forks
GET    /api/assignments/:assignmentId/students/:studentId/fork
```

#### Submission and Grading

```
POST   /api/forks/:forkId/submit
GET    /api/submissions/:submissionId
POST   /api/submissions/:submissionId/grade
POST   /api/submissions/:submissionId/feedback
GET    /api/assignments/:assignmentId/submissions
GET    /api/students/:studentId/courses/:courseId/submissions
```

#### Authentication

```
GET    /api/auth/github/initiate
GET    /api/auth/github/callback
GET    /api/auth/google/initiate
GET    /api/auth/google/callback
POST   /api/auth/logout
GET    /api/auth/session
```

#### Synchronization

```
GET    /api/forks/:forkId/updates
POST   /api/forks/:forkId/sync
POST   /api/assignments/:assignmentId/notify-updates
```

#### Notifications

```
GET    /api/notifications
GET    /api/notifications/unread
PUT    /api/notifications/:notificationId/read
PUT    /api/notifications/read-all
```

### Request/Response Examples

#### Create Course
```json
POST /api/courses
{
  "name": "CS 101: Introduction to Programming",
  "githubOrgName": "cs101-fall2024",
  "metadata": {
    "semester": "Fall",
    "year": 2024,
    "description": "Introductory programming course"
  }
}

Response 201:
{
  "id": "course-uuid",
  "name": "CS 101: Introduction to Programming",
  "instructorId": "instructor-uuid",
  "githubOrgName": "cs101-fall2024",
  "githubOrgId": "12345",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "archived": false,
  "metadata": {
    "semester": "Fall",
    "year": 2024,
    "description": "Introductory programming course"
  }
}
```

#### Create Assignment
```json
POST /api/courses/course-uuid/assignments
{
  "name": "Assignment 1: Hello World",
  "repositoryName": "assignment-1-hello-world",
  "templateRepositoryUrl": "https://github.com/templates/hello-world",
  "deadline": "2024-02-01T23:59:59Z",
  "allowLateSubmissions": true,
  "visibility": "private",
  "configuration": {
    "autoGrading": false,
    "requiredFiles": ["main.py", "README.md"],
    "starterCode": true
  }
}

Response 201:
{
  "id": "assignment-uuid",
  "courseId": "course-uuid",
  "name": "Assignment 1: Hello World",
  "repositoryName": "assignment-1-hello-world",
  "repositoryUrl": "https://github.com/cs101-fall2024/assignment-1-hello-world",
  "templateRepositoryUrl": "https://github.com/templates/hello-world",
  "deadline": "2024-02-01T23:59:59Z",
  "allowLateSubmissions": true,
  "devcontainerPath": ".devcontainer/devcontainer.json",
  "visibility": "private",
  "createdAt": "2024-01-16T10:00:00Z",
  "updatedAt": "2024-01-16T10:00:00Z",
  "configuration": {
    "autoGrading": false,
    "requiredFiles": ["main.py", "README.md"],
    "starterCode": true
  }
}
```

#### Fork Assignment
```json
POST /api/assignments/assignment-uuid/fork
{
  "studentId": "student-uuid"
}

Response 201:
{
  "id": "fork-uuid",
  "assignmentId": "assignment-uuid",
  "studentId": "student-uuid",
  "githubRepoUrl": "https://github.com/student-username/assignment-1-hello-world",
  "githubRepoId": "67890",
  "forkedAt": "2024-01-17T10:00:00Z",
  "status": "active",
  "environmentSetup": {
    "status": "pending"
  }
}
```

## Integration Points

### GitHub Integration

**Authentication Flow**:
1. User initiates GitHub OAuth via `/api/auth/github/initiate`
2. System redirects to GitHub OAuth authorization page
3. GitHub redirects back to `/api/auth/github/callback` with authorization code
4. System exchanges code for access token
5. System stores encrypted token and creates user session

**Organization Management**:
- Use GitHub REST API v3 for organization operations
- Requires admin-level OAuth scope: `admin:org`
- Organization creation requires authenticated instructor token
- Organization deletion requires confirmation and cascades to course archival

**Repository Operations**:
- Template repositories use GitHub's template feature
- Fork operations use GitHub's fork API endpoint
- Preserve commit history and branch structure during forks
- Repository visibility controlled via API (public/private)

**Pull Request Workflow**:
- Student submissions create PR from fork to original repository
- PR title format: `[Submission] {Student Name} - {Assignment Name}`
- PR body includes submission timestamp and metadata
- Instructors review and comment via GitHub's PR interface

### Google Workspace Integration

**Authentication Flow**:
1. User initiates Google OAuth via `/api/auth/google/initiate`
2. System redirects to Google OAuth consent screen
3. Google redirects back to `/api/auth/google/callback` with authorization code
4. System exchanges code for access token
5. System links Google account to user profile

**User Management**:
- Google Workspace email used as primary identifier
- Support for Google Workspace domain restrictions
- Automatic user provisioning for domain users
- Role mapping based on Google Workspace groups (optional)

**Fallback Behavior**:
- If Google Workspace unavailable, fall back to GitHub authentication
- Users can link both accounts for flexibility
- Session management independent of authentication provider

### Devcontainer Integration

**Configuration Loading**:
1. System clones repository to temporary location
2. Reads `.devcontainer/devcontainer.json` or `.devcontainer.json`
3. Parses JSON and validates against devcontainer schema
4. Extracts image, features, and customizations

**Environment Setup**:
1. Pull Docker image specified in devcontainer config
2. Install VS Code extensions listed in customizations
3. Run `postCreateCommand` if specified
4. Forward ports as configured
5. Set remote user and permissions

**Error Handling**:
- Log parsing errors with line numbers
- Display user-friendly error messages for common issues
- Provide fallback to default environment if config invalid
- Allow instructors to test devcontainer before assignment release

**Compatibility**:
- Support same devcontainer.json format as GitHub Codespaces
- Compatible with VS Code Remote - Containers extension
- Support for Docker Compose configurations
- Feature parity with GitHub Codespaces devcontainer features



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Course-Organization One-to-One Association

*For any* course created by an instructor, the system should create exactly one GitHub Organization, associate it with the course, and retrieving the course should return the correct organization information.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Assignment Repository Creation with Configuration

*For any* assignment created with specified name, visibility, and optional template, the system should create a repository in the course's GitHub Organization with the exact configuration specified.

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 3: Template Commit History Preservation

*For any* assignment created from a template repository, the created repository should contain all commits from the template's history.

**Validates: Requirements 2.3**

### Property 4: Student Fork Creation with Branch Preservation

*For any* student forking an assignment repository, the system should create a fork in the student's GitHub account that preserves all branches from the original repository.

**Validates: Requirements 3.2, 3.3**

### Property 5: Devcontainer Configuration Processing

*For any* valid devcontainer.json file in an assignment repository, the system should parse the configuration and apply it during environment setup, using the specified image, features, and commands.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Devcontainer Error Logging

*For any* devcontainer configuration that fails to parse or apply, the system should log warnings or errors with descriptive messages.

**Validates: Requirements 4.4**

### Property 7: Assignment Configuration Persistence

*For any* assignment configuration update (including deadlines and settings), the system should persist the changes and return the updated configuration on subsequent retrievals.

**Validates: Requirements 5.1, 5.3**

### Property 8: Late Submission Timestamp Recording

*For any* submission made after the assignment deadline when late submissions are enabled, the system should record the exact submission timestamp.

**Validates: Requirements 5.2**

### Property 9: Configuration Change Notifications

*For any* configuration change that affects existing student repositories, the system should create a notification for the instructor.

**Validates: Requirements 5.4**

### Property 10: Assignment List Completeness

*For any* course with assignments, retrieving the course should return all assignments associated with that course.

**Validates: Requirements 6.1**

### Property 11: Fork Count Accuracy

*For any* assignment, the displayed fork count should equal the actual number of students who have forked the repository.

**Validates: Requirements 6.2**

### Property 12: Student Submission Status Accuracy

*For any* student and assignment combination, the system should accurately report whether the student has forked the assignment and the current submission status.

**Validates: Requirements 6.3, 6.4**

### Property 13: Authentication Token Security

*For any* user authentication (GitHub or Google), the system should store the authentication token in encrypted form and use it for subsequent API requests.

**Validates: Requirements 7.2, 7.3**

### Property 14: Dual Authentication Support

*For any* user, the system should support authentication with both GitHub and Google Workspace simultaneously, maintaining separate tokens for each provider.

**Validates: Requirements 8.3**

### Property 15: Environment Setup with Dependencies

*For any* student opening an assignment, the system should clone the forked repository and install all dependencies specified in the devcontainer configuration.

**Validates: Requirements 9.1, 9.2**

### Property 16: Environment Setup Progress Tracking

*For any* environment setup operation, the system should emit progress events indicating the current setup stage.

**Validates: Requirements 9.3**

### Property 17: Submission Pull Request Creation

*For any* student submitting an assignment, the system should create a pull request to the original repository and record the submission timestamp.

**Validates: Requirements 10.1, 10.2**

### Property 18: Pre-Submission Validation

*For any* submission attempt, the system should validate that the repository is in a submittable state before creating the pull request.

**Validates: Requirements 10.3**

### Property 19: Grading Data Completeness

*For any* submission viewed by an instructor, the system should return the code, submission metadata, commit history, and any existing grades or feedback.

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 20: Deadline Notification Generation

*For any* assignment with an approaching deadline, the system should generate notifications for all enrolled students who have not yet submitted.

**Validates: Requirements 12.1**

### Property 21: Late Submission Instructor Notification

*For any* submission made after the deadline when late submissions are enabled, the system should create a notification for the course instructor.

**Validates: Requirements 12.2**

### Property 22: Notification Read Status Management

*For any* notification, users should be able to mark it as read, and the system should update and persist the read status.

**Validates: Requirements 12.3, 12.4**

### Property 23: Assignment Update Student Notification

*For any* update to an original assignment repository, the system should create notifications for all students who have forked that assignment.

**Validates: Requirements 13.1**

### Property 24: Fork Synchronization with Upstream

*For any* fork synchronization operation, the system should merge all changes from the original repository into the student's fork.

**Validates: Requirements 13.3**

### Property 25: Template Creation and Persistence

*For any* repository designated as a template, the system should store it as a template and make it available for selection during assignment creation.

**Validates: Requirements 14.1, 14.2**

### Property 26: Template Deletion Protection

*For any* template repository, deletion attempts should be blocked or require special confirmation to prevent accidental loss.

**Validates: Requirements 14.3**

### Property 27: Template Modification Propagation

*For any* template modification, all future assignments created from that template should use the updated version.

**Validates: Requirements 14.4**

### Property 28: Multi-Course Enrollment and Isolation

*For any* student enrolled in multiple courses, the system should maintain separate repositories and configurations for each course, and retrieving the student's dashboard should return all enrolled courses.

**Validates: Requirements 15.1, 15.2, 15.3**

### Property 29: Course Archival Content Preservation

*For any* course marked as completed, the system should archive it while preserving all repositories, assignments, and submissions for future access.

**Validates: Requirements 15.4**

### Property 30: VS Code IDE Embedding and Scripting

*For any* codespace running with the devcontainer configuration, the system should start both the VS Code server and MCP control server, make the VS Code UI accessible via iframe, and execute editor actions when receiving MCP commands from an authorized lecture page.

**Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10**

## Error Handling

### Error Categories

The system handles errors across multiple integration points and user interactions. Errors are categorized by severity and source:

#### 1. GitHub API Errors

**Rate Limiting**:
- Detection: Monitor GitHub API response headers for rate limit status
- Handling: Implement exponential backoff with jitter
- User Feedback: Display estimated wait time and retry option
- Logging: Record rate limit hits for capacity planning

**Authentication Failures**:
- Detection: 401/403 responses from GitHub API
- Handling: Attempt token refresh; if refresh fails, prompt re-authentication
- User Feedback: Clear message indicating authentication issue with re-auth link
- Logging: Log authentication failures with user ID and timestamp

**Repository Operation Failures**:
- Detection: 4xx/5xx responses from repository operations
- Handling: Retry transient errors (502, 503, 504) up to 3 times
- User Feedback: Specific error messages based on failure type (permissions, not found, etc.)
- Logging: Full error context including operation, repository, and user

**Organization Quota Exceeded**:
- Detection: GitHub API error indicating organization limits reached
- Handling: Prevent new repository creation; notify instructor
- User Feedback: Display quota status and upgrade options
- Logging: Track quota usage patterns

#### 2. Google Workspace Integration Errors

**OAuth Failures**:
- Detection: Error responses during OAuth flow
- Handling: Fall back to GitHub authentication
- User Feedback: Inform user of fallback and suggest retry
- Logging: Log OAuth errors with error codes

**Token Expiration**:
- Detection: 401 responses from Google APIs
- Handling: Automatic token refresh using refresh token
- User Feedback: Transparent to user if refresh succeeds
- Logging: Log refresh attempts and outcomes

**Domain Restrictions**:
- Detection: User email domain not in allowed list
- Handling: Reject authentication with clear message
- User Feedback: Display allowed domains and contact information
- Logging: Log unauthorized domain access attempts

#### 3. Devcontainer Configuration Errors

**Parse Errors**:
- Detection: JSON syntax errors or schema validation failures
- Handling: Use default devcontainer configuration
- User Feedback: Display parse error with line number and fallback notice
- Logging: Log full parse error and file content

**Image Pull Failures**:
- Detection: Docker image not found or pull timeout
- Handling: Retry with exponential backoff; fall back to default image
- User Feedback: Display progress and fallback information
- Logging: Log image name, registry, and error details

**Feature Installation Failures**:
- Detection: Non-zero exit codes from feature installation scripts
- Handling: Continue setup with remaining features; mark failed features
- User Feedback: Display which features failed with error details
- Logging: Log feature name, script output, and exit code

**Post-Command Failures**:
- Detection: Non-zero exit codes from postCreateCommand or postStartCommand
- Handling: Mark environment as partially ready; allow user to proceed
- User Feedback: Display command output and allow manual retry
- Logging: Log command, output, and exit code

#### 4. Repository Synchronization Errors

**Merge Conflicts**:
- Detection: Git merge operation returns conflicts
- Handling: Preserve both versions; mark files with conflicts
- User Feedback: Display conflict markers and resolution UI
- Logging: Log conflicting files and conflict markers

**Diverged History**:
- Detection: Fork and upstream have incompatible histories
- Handling: Offer force sync or manual resolution options
- User Feedback: Explain divergence and present options
- Logging: Log commit graphs and divergence point

**Network Failures During Sync**:
- Detection: Timeout or connection errors during git operations
- Handling: Retry with exponential backoff up to 3 times
- User Feedback: Display retry progress and allow cancellation
- Logging: Log network error details and retry attempts

#### 5. Submission Errors

**Validation Failures**:
- Detection: Required files missing or repository in invalid state
- Handling: Block submission and display validation errors
- User Feedback: List specific validation failures with remediation steps
- Logging: Log validation failures and repository state

**Pull Request Creation Failures**:
- Detection: GitHub API errors during PR creation
- Handling: Retry up to 3 times; preserve submission intent
- User Feedback: Display error and allow retry
- Logging: Log PR creation parameters and error response

**Deadline Enforcement**:
- Detection: Submission timestamp after deadline with late submissions disabled
- Handling: Block submission and display deadline information
- User Feedback: Show deadline, current time, and late submission policy
- Logging: Log late submission attempts

#### 6. Data Persistence Errors

**Database Connection Failures**:
- Detection: Connection timeouts or errors
- Handling: Retry with exponential backoff; use circuit breaker pattern
- User Feedback: Display "service temporarily unavailable" message
- Logging: Log connection errors and retry attempts

**Constraint Violations**:
- Detection: Unique constraint or foreign key violations
- Handling: Return specific error based on constraint type
- User Feedback: User-friendly message explaining the conflict
- Logging: Log constraint violation details

**Transaction Failures**:
- Detection: Transaction rollback or commit failures
- Handling: Retry transaction up to 3 times
- User Feedback: Display error and allow retry
- Logging: Log transaction details and failure reason

### Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": {
      "field": "specific field if applicable",
      "reason": "technical reason for developers"
    },
    "requestId": "unique-request-id",
    "timestamp": "2024-01-15T10:00:00Z",
    "retryable": true
  }
}
```

### Error Recovery Strategies

**Automatic Recovery**:
- Token refresh for expired authentication
- Retry with exponential backoff for transient errors
- Fallback to default configurations for invalid devcontainer configs
- Circuit breaker pattern for external service failures

**User-Initiated Recovery**:
- Manual retry buttons for failed operations
- Re-authentication flows for auth failures
- Conflict resolution UI for merge conflicts
- Manual sync options for diverged repositories

**Graceful Degradation**:
- Fall back to GitHub auth if Google Workspace unavailable
- Use default devcontainer if custom config fails
- Continue with partial feature set if some features fail
- Display cached data if real-time data unavailable

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, error conditions, and integration points between components. Unit tests verify concrete scenarios and ensure individual components work correctly in isolation.

**Property Tests**: Verify universal properties across all inputs through randomized testing. Property tests ensure that correctness properties hold for a wide range of inputs, catching edge cases that might not be covered by example-based unit tests.

Both approaches are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs and verify specific behaviors, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library Selection**:
- **TypeScript/JavaScript**: Use `fast-check` for property-based testing
- **Python**: Use `hypothesis` for property-based testing
- **Go**: Use `gopter` for property-based testing

**Test Configuration**:
- Each property test MUST run a minimum of 100 iterations to ensure adequate randomization coverage
- Each property test MUST include a comment tag referencing the design document property
- Tag format: `// Feature: github-classroom-support, Property {number}: {property_text}`

**Property Test Structure**:
```typescript
// Feature: github-classroom-support, Property 1: Course-Organization One-to-One Association
test('course organization one-to-one association', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        instructorId: fc.uuid(),
        courseName: fc.string({ minLength: 1, maxLength: 100 }),
        orgName: fc.string({ minLength: 1, maxLength: 39 })
      }),
      async (courseData) => {
        // Create course
        const course = await courseService.createCourse(
          courseData.instructorId,
          courseData.courseName,
          courseData.orgName
        );
        
        // Verify exactly one organization
        expect(course.githubOrgName).toBe(courseData.orgName);
        
        // Retrieve course and verify organization info
        const retrieved = await courseService.getCourse(course.id);
        expect(retrieved.githubOrgName).toBe(courseData.orgName);
        expect(retrieved.githubOrgId).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Strategy

**Component-Level Tests**:
- Test each service interface method with specific examples
- Mock external dependencies (GitHub API, Google Workspace API)
- Verify error handling for known failure scenarios
- Test edge cases (empty strings, null values, boundary conditions)

**Integration Tests**:
- Test interactions between services
- Use test doubles for external APIs
- Verify data flow through multiple layers
- Test transaction boundaries and rollback scenarios

**API Endpoint Tests**:
- Test each REST endpoint with valid and invalid inputs
- Verify authentication and authorization
- Test request validation and error responses
- Verify response format and status codes

**Example Unit Tests**:

```typescript
describe('CourseManagementService', () => {
  describe('createCourse', () => {
    it('should create course with valid data', async () => {
      const course = await courseService.createCourse(
        'instructor-123',
        'CS 101',
        'cs101-fall2024'
      );
      
      expect(course.id).toBeDefined();
      expect(course.name).toBe('CS 101');
      expect(course.githubOrgName).toBe('cs101-fall2024');
    });
    
    it('should reject empty course name', async () => {
      await expect(
        courseService.createCourse('instructor-123', '', 'org-name')
      ).rejects.toThrow('Course name cannot be empty');
    });
    
    it('should reject invalid organization name', async () => {
      await expect(
        courseService.createCourse('instructor-123', 'CS 101', 'invalid org!')
      ).rejects.toThrow('Invalid organization name');
    });
  });
  
  describe('deleteCourse', () => {
    it('should require confirmation for organization deletion', async () => {
      const course = await createTestCourse();
      
      await expect(
        courseService.deleteCourse(course.id, false)
      ).rejects.toThrow('Organization deletion requires confirmation');
    });
    
    it('should delete course and organization with confirmation', async () => {
      const course = await createTestCourse();
      
      await courseService.deleteCourse(course.id, true);
      
      await expect(
        courseService.getCourse(course.id)
      ).rejects.toThrow('Course not found');
    });
  });
});
```

### Test Coverage Requirements

**Minimum Coverage Targets**:
- Line coverage: 80%
- Branch coverage: 75%
- Function coverage: 90%

**Critical Path Coverage**:
- 100% coverage for authentication flows
- 100% coverage for data persistence operations
- 100% coverage for GitHub API interactions
- 100% coverage for error handling paths

### Testing External Integrations

**GitHub API Testing**:
- Use recorded HTTP interactions (VCR pattern) for deterministic tests
- Mock GitHub API responses for unit tests
- Use GitHub's test organization for integration tests
- Implement rate limit simulation for load testing

**Google Workspace Testing**:
- Mock OAuth flows in unit tests
- Use test Google Workspace domain for integration tests
- Test fallback behavior with mocked service unavailability

**Devcontainer Testing**:
- Test with variety of valid devcontainer configurations
- Test with intentionally malformed configurations
- Verify compatibility with GitHub Codespaces examples
- Test with different base images and feature combinations

### Continuous Integration

**CI Pipeline**:
1. Run linting and code formatting checks
2. Run unit tests with coverage reporting
3. Run property-based tests (100 iterations per property)
4. Run integration tests against test GitHub organization
5. Generate coverage reports and enforce minimum thresholds
6. Run security scanning (dependency vulnerabilities, secrets detection)

**Test Execution Time**:
- Unit tests: < 2 minutes
- Property tests: < 5 minutes
- Integration tests: < 10 minutes
- Full suite: < 15 minutes

### Test Data Management

**Test Fixtures**:
- Use factory functions for creating test data
- Implement builders for complex objects
- Maintain seed data for integration tests
- Clean up test data after each test run

**Randomization**:
- Use property-based testing libraries for random data generation
- Seed random generators for reproducible failures
- Generate realistic test data (valid GitHub usernames, repository names, etc.)

### Performance Testing

**Load Testing**:
- Simulate concurrent course creation by multiple instructors
- Test fork operations under high load
- Verify system behavior under GitHub API rate limits
- Test database performance with large datasets

**Benchmarking**:
- Measure API endpoint response times
- Track devcontainer setup duration
- Monitor GitHub API call frequency
- Profile database query performance
