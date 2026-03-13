# Implementation Plan: GitHub Classroom Support

## Overview

This implementation plan breaks down the GitHub Classroom support feature into discrete coding tasks. The system enables instructors to create courses using GitHub Organizations, with students forking assignment repositories. The implementation uses TypeScript and follows a layered architecture with integration, application, and data layers.

## Tasks

- [x] 1. Set up project structure and core data models
  - Create directory structure for services, repositories, and types
  - Define TypeScript interfaces for all data models (Course, Assignment, Fork, User, Submission, Notification, AuthToken, DevcontainerConfig)
  - Set up database schema and migrations
  - Configure TypeScript compiler and linting
  - _Requirements: 1.1, 1.2, 2.1, 3.2, 7.2, 10.1, 11.1, 12.1, 15.1_

- [x] 1.1 Write property test for data model persistence
  - **Property 7: Assignment Configuration Persistence**
  - **Validates: Requirements 5.1, 5.3**

- [~] 2. Implement GitHub Client integration layer
  - [x] 2.1 Create GitHubClient class with organization operations
    - Implement createOrganization, getOrganization, deleteOrganization methods
    - Add error handling for GitHub API rate limits and authentication failures
    - _Requirements: 1.1, 1.4, 7.1, 7.3_
  
  - [x] 2.2 Implement repository operations in GitHubClient
    - Add createRepository, forkRepository, getRepository, syncFork methods
    - Implement pull request operations (createPullRequest)
    - Handle repository visibility settings (public/private)
    - _Requirements: 2.1, 2.4, 3.1, 3.2, 10.1, 13.3_
  
  - [x] 2.3 Add GitHub OAuth authentication methods
    - Implement authenticateWithOAuth and validateToken methods
    - Add token refresh logic with exponential backoff
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 2.4 Write unit tests for GitHubClient
    - Test organization CRUD operations with mocked GitHub API
    - Test repository operations and error scenarios
    - Test OAuth flow and token management
    - _Requirements: 1.1, 2.1, 3.2, 7.1_

- [~] 3. Implement Authentication Service
  - [x] 3.1 Create AuthService with GitHub OAuth flow
    - Implement initiateGitHubAuth and completeGitHubAuth methods
    - Add secure token storage with encryption
    - Implement session management (createSession, validateSession, destroySession)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 3.2 Add Google Workspace OAuth integration
    - Implement initiateGoogleAuth and completeGoogleAuth methods
    - Add fallback logic when Google Workspace is unavailable
    - Support dual authentication (GitHub + Google)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [x] 3.3 Implement token management operations
    - Add getGitHubToken, refreshGitHubToken, revokeTokens methods
    - Implement automatic token refresh on expiration
    - _Requirements: 7.2, 7.3_
  
  - [x] 3.4 Write property test for authentication token security
    - **Property 13: Authentication Token Security**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 3.5 Write property test for dual authentication support
    - **Property 14: Dual Authentication Support**
    - **Validates: Requirements 8.3**
  
  - [x] 3.6 Write unit tests for AuthService
    - Test GitHub OAuth flow with mocked responses
    - Test Google Workspace OAuth with fallback scenarios
    - Test token encryption and refresh logic
    - _Requirements: 7.1, 7.2, 8.1, 8.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 5. Implement Course Management Service
  - [-] 5.1 Create CourseManagementService with CRUD operations
    - Implement createCourse, getCourse, updateCourse, deleteCourse methods
    - Add listCoursesByInstructor method
    - Implement associateGitHubOrg method with validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 5.2 Add course deletion with organization cleanup
    - Implement confirmation prompt for organization deletion
    - Add cascade logic for archiving course content
    - _Requirements: 1.4, 15.4_
  
  - [ ] 5.3 Write property test for course-organization association
    - **Property 1: Course-Organization One-to-One Association**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  
  - [ ] 5.4 Write property test for course archival
    - **Property 29: Course Archival Content Preservation**
    - **Validates: Requirements 15.4**
  
  - [ ] 5.5 Write unit tests for CourseManagementService
    - Test course creation with valid and invalid data
    - Test organization association and deletion confirmation
    - Test course listing and retrieval
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [~] 6. Implement Assignment Service
  - [ ] 6.1 Create AssignmentService with assignment operations
    - Implement createAssignment, getAssignment, updateAssignment, deleteAssignment methods
    - Add listAssignmentsByCourse method
    - Integrate with GitHubClient for repository creation
    - _Requirements: 2.1, 2.2, 2.4, 6.1_
  
  - [ ] 6.2 Implement template repository support
    - Add logic to use template repositories during assignment creation
    - Preserve template commit history when creating assignments
    - _Requirements: 2.2, 2.3, 14.1, 14.2_
  
  - [ ] 6.3 Add student fork management
    - Implement forkAssignment and getStudentFork methods
    - Track fork relationships and status
    - _Requirements: 3.1, 3.2, 3.3, 6.2, 6.3_
  
  - [ ] 6.4 Implement assignment configuration management
    - Add support for deadline configuration
    - Implement late submission tracking
    - Add configuration update notifications
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 6.5 Write property test for assignment repository creation
    - **Property 2: Assignment Repository Creation with Configuration**
    - **Validates: Requirements 2.1, 2.2, 2.4**
  
  - [ ] 6.6 Write property test for template commit history preservation
    - **Property 3: Template Commit History Preservation**
    - **Validates: Requirements 2.3**
  
  - [ ] 6.7 Write property test for student fork creation
    - **Property 4: Student Fork Creation with Branch Preservation**
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ] 6.8 Write property test for assignment list completeness
    - **Property 10: Assignment List Completeness**
    - **Validates: Requirements 6.1**
  
  - [ ] 6.9 Write property test for fork count accuracy
    - **Property 11: Fork Count Accuracy**
    - **Validates: Requirements 6.2**
  
  - [ ] 6.10 Write unit tests for AssignmentService
    - Test assignment creation with templates and starter code
    - Test fork operations and status tracking
    - Test configuration updates and notifications
    - _Requirements: 2.1, 2.2, 3.1, 5.1, 6.1_

- [~] 7. Implement Devcontainer Parser
  - [ ] 7.1 Create DevcontainerParser with parsing logic
    - Implement parse method with JSON schema validation
    - Add validate method for devcontainer configuration
    - Implement extractDependencies, getImage, getFeatures methods
    - _Requirements: 4.1, 4.3_
  
  - [ ] 7.2 Add error handling and logging
    - Log parse errors with line numbers
    - Provide fallback to default configuration on errors
    - _Requirements: 4.4_
  
  - [ ] 7.3 Write property test for devcontainer configuration processing
    - **Property 5: Devcontainer Configuration Processing**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ] 7.4 Write property test for devcontainer error logging
    - **Property 6: Devcontainer Error Logging**
    - **Validates: Requirements 4.4**
  
  - [ ] 7.5 Write unit tests for DevcontainerParser
    - Test parsing valid devcontainer configurations
    - Test error handling for malformed JSON
    - Test fallback to default configuration
    - _Requirements: 4.1, 4.3, 4.4_

- [~] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 9. Implement Grading Service
  - [ ] 9.1 Create GradingService with submission operations
    - Implement submitAssignment, getSubmission methods
    - Add gradeSubmission and addFeedback methods
    - Implement listSubmissionsByAssignment and getStudentSubmissions methods
    - _Requirements: 10.1, 10.2, 11.1, 11.2, 11.3_
  
  - [ ] 9.2 Add pull request creation for submissions
    - Integrate with GitHubClient to create PRs
    - Format PR title and body with submission metadata
    - _Requirements: 10.1_
  
  - [ ] 9.3 Implement submission validation
    - Add pre-submission validation logic
    - Check repository state before allowing submission
    - _Requirements: 10.3_
  
  - [ ] 9.4 Add late submission handling
    - Record submission timestamps
    - Enforce deadline rules based on configuration
    - _Requirements: 5.2, 10.2_
  
  - [ ] 9.5 Write property test for submission pull request creation
    - **Property 17: Submission Pull Request Creation**
    - **Validates: Requirements 10.1, 10.2**
  
  - [ ] 9.6 Write property test for pre-submission validation
    - **Property 18: Pre-Submission Validation**
    - **Validates: Requirements 10.3**
  
  - [ ] 9.7 Write property test for grading data completeness
    - **Property 19: Grading Data Completeness**
    - **Validates: Requirements 11.1, 11.2, 11.3**
  
  - [ ] 9.8 Write property test for late submission timestamp recording
    - **Property 8: Late Submission Timestamp Recording**
    - **Validates: Requirements 5.2**
  
  - [ ] 9.9 Write unit tests for GradingService
    - Test submission creation and validation
    - Test grading and feedback operations
    - Test late submission handling
    - _Requirements: 10.1, 10.2, 10.3, 11.1_

- [~] 10. Implement Notification Service
  - [ ] 10.1 Create NotificationService with notification operations
    - Implement sendNotification, getNotifications methods
    - Add markAsRead and markAllAsRead methods
    - Support different notification types (deadline, late submission, updates, grading)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ] 10.2 Add deadline notification generation
    - Implement logic to notify students of approaching deadlines
    - Filter notifications for students who haven't submitted
    - _Requirements: 12.1_
  
  - [ ] 10.3 Add late submission notifications for instructors
    - Generate notifications when students submit after deadline
    - _Requirements: 12.2_
  
  - [ ] 10.4 Add assignment update notifications
    - Notify students when original assignment repository is updated
    - _Requirements: 13.1_
  
  - [ ] 10.5 Write property test for deadline notification generation
    - **Property 20: Deadline Notification Generation**
    - **Validates: Requirements 12.1**
  
  - [ ] 10.6 Write property test for late submission instructor notification
    - **Property 21: Late Submission Instructor Notification**
    - **Validates: Requirements 12.2**
  
  - [ ] 10.7 Write property test for notification read status management
    - **Property 22: Notification Read Status Management**
    - **Validates: Requirements 12.3, 12.4**
  
  - [ ] 10.8 Write property test for assignment update student notification
    - **Property 23: Assignment Update Student Notification**
    - **Validates: Requirements 13.1**
  
  - [ ] 10.9 Write unit tests for NotificationService
    - Test notification creation and retrieval
    - Test read status management
    - Test notification filtering by type
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [~] 11. Implement Sync Service
  - [ ] 11.1 Create SyncService with synchronization operations
    - Implement checkForUpdates and syncFork methods
    - Add notifyStudentsOfUpdates method
    - Implement resolveMergeConflicts method
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ] 11.2 Add merge conflict handling
    - Detect and mark conflicting files
    - Provide conflict resolution UI data
    - _Requirements: 13.4_
  
  - [ ] 11.3 Write property test for fork synchronization
    - **Property 24: Fork Synchronization with Upstream**
    - **Validates: Requirements 13.3**
  
  - [ ] 11.4 Write unit tests for SyncService
    - Test update detection and synchronization
    - Test merge conflict handling
    - Test student notification on updates
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [~] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 13. Implement REST API endpoints
  - [ ] 13.1 Create course management endpoints
    - Implement POST /api/courses, GET /api/courses/:courseId
    - Add PUT /api/courses/:courseId, DELETE /api/courses/:courseId
    - Implement GET /api/courses/instructor/:instructorId
    - Add POST /api/courses/:courseId/github-org
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 13.2 Create assignment management endpoints
    - Implement POST /api/courses/:courseId/assignments
    - Add GET /api/assignments/:assignmentId, PUT /api/assignments/:assignmentId
    - Implement DELETE /api/assignments/:assignmentId
    - Add GET /api/courses/:courseId/assignments
    - Implement POST /api/assignments/:assignmentId/fork
    - Add GET /api/assignments/:assignmentId/forks
    - _Requirements: 2.1, 2.4, 3.1, 6.1, 6.2_
  
  - [ ] 13.3 Create submission and grading endpoints
    - Implement POST /api/forks/:forkId/submit
    - Add GET /api/submissions/:submissionId
    - Implement POST /api/submissions/:submissionId/grade
    - Add POST /api/submissions/:submissionId/feedback
    - Implement GET /api/assignments/:assignmentId/submissions
    - _Requirements: 10.1, 10.2, 11.1, 11.2_
  
  - [ ] 13.4 Create authentication endpoints
    - Implement GET /api/auth/github/initiate, GET /api/auth/github/callback
    - Add GET /api/auth/google/initiate, GET /api/auth/google/callback
    - Implement POST /api/auth/logout, GET /api/auth/session
    - _Requirements: 7.1, 8.1, 8.2_
  
  - [ ] 13.5 Create synchronization endpoints
    - Implement GET /api/forks/:forkId/updates
    - Add POST /api/forks/:forkId/sync
    - Implement POST /api/assignments/:assignmentId/notify-updates
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ] 13.6 Create notification endpoints
    - Implement GET /api/notifications, GET /api/notifications/unread
    - Add PUT /api/notifications/:notificationId/read
    - Implement PUT /api/notifications/read-all
    - _Requirements: 12.3, 12.4_
  
  - [ ] 13.7 Write integration tests for API endpoints
    - Test all endpoints with valid and invalid inputs
    - Test authentication and authorization
    - Test error responses and status codes
    - _Requirements: All API-related requirements_

- [~] 14. Implement environment setup functionality
  - [ ] 14.1 Create environment setup service
    - Implement repository cloning logic
    - Add dependency installation based on devcontainer config
    - Display progress information during setup
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 14.2 Add Docker image and feature handling
    - Pull Docker images specified in devcontainer
    - Install VS Code extensions from customizations
    - Run postCreateCommand and postStartCommand
    - _Requirements: 4.2, 9.2_
  
  - [ ] 14.3 Add error handling and recovery
    - Handle image pull failures with fallback
    - Handle feature installation failures gracefully
    - Provide error details and recovery options
    - _Requirements: 9.3_
  
  - [ ] 14.4 Write property test for environment setup with dependencies
    - **Property 15: Environment Setup with Dependencies**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ] 14.5 Write property test for environment setup progress tracking
    - **Property 16: Environment Setup Progress Tracking**
    - **Validates: Requirements 9.3**
  
  - [ ] 14.6 Write unit tests for environment setup
    - Test repository cloning and dependency installation
    - Test Docker image handling
    - Test error scenarios and recovery
    - _Requirements: 9.1, 9.2, 9.3_

- [~] 15. Implement template management functionality
  - [ ] 15.1 Add template creation and storage
    - Implement logic to designate repositories as templates
    - Store template metadata and make available for selection
    - _Requirements: 14.1, 14.2_
  
  - [ ] 15.2 Add template deletion protection
    - Implement confirmation prompts for template deletion
    - Prevent accidental template loss
    - _Requirements: 14.3_
  
  - [ ] 15.3 Add template modification tracking
    - Track template versions and modifications
    - Ensure future assignments use updated templates
    - _Requirements: 14.4_
  
  - [ ] 15.4 Write property test for template creation and persistence
    - **Property 25: Template Creation and Persistence**
    - **Validates: Requirements 14.1, 14.2**
  
  - [ ] 15.5 Write property test for template deletion protection
    - **Property 26: Template Deletion Protection**
    - **Validates: Requirements 14.3**
  
  - [ ] 15.6 Write property test for template modification propagation
    - **Property 27: Template Modification Propagation**
    - **Validates: Requirements 14.4**
  
  - [ ] 15.7 Write unit tests for template management
    - Test template creation and selection
    - Test deletion protection
    - Test modification tracking
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [~] 16. Implement multi-course support
  - [ ] 16.1 Add student enrollment management
    - Implement logic for students to enroll in multiple courses
    - Maintain separate repositories per course
    - _Requirements: 15.1, 15.3_
  
  - [ ] 16.2 Create student dashboard with course listing
    - Display all enrolled courses on dashboard
    - Show course-specific assignments and status
    - _Requirements: 15.2_
  
  - [ ] 16.3 Write property test for multi-course enrollment
    - **Property 28: Multi-Course Enrollment and Isolation**
    - **Validates: Requirements 15.1, 15.2, 15.3**
  
  - [ ] 16.4 Write property test for student submission status accuracy
    - **Property 12: Student Submission Status Accuracy**
    - **Validates: Requirements 6.3, 6.4**
  
  - [ ] 16.5 Write unit tests for multi-course support
    - Test enrollment in multiple courses
    - Test course isolation
    - Test dashboard display
    - _Requirements: 15.1, 15.2, 15.3_

- [~] 17. Implement configuration change notifications
  - [ ] 17.1 Add notification logic for configuration changes
    - Detect configuration changes affecting student repositories
    - Generate instructor notifications for impactful changes
    - _Requirements: 5.4_
  
  - [ ] 17.2 Write property test for configuration change notifications
    - **Property 9: Configuration Change Notifications**
    - **Validates: Requirements 5.4**
  
  - [ ] 17.3 Write unit tests for configuration change notifications
    - Test notification generation on configuration updates
    - Test notification content and targeting
    - _Requirements: 5.4_

- [~] 18. Final integration and wiring
  - [ ] 18.1 Wire all services together
    - Connect API endpoints to services
    - Configure dependency injection
    - Set up middleware for authentication and error handling
    - _Requirements: All requirements_
  
  - [ ] 18.2 Add comprehensive error handling
    - Implement consistent error response format
    - Add retry logic with exponential backoff
    - Implement circuit breaker for external services
    - _Requirements: 7.4, 10.4_
  
  - [ ] 18.3 Configure logging and monitoring
    - Set up structured logging for all operations
    - Add request/response logging
    - Configure error tracking
    - _Requirements: 4.4_
  
  - [ ] 18.4 Write end-to-end integration tests
    - Test complete workflows (course creation → assignment → fork → submit → grade)
    - Test error scenarios across service boundaries
    - Test authentication flows end-to-end
    - _Requirements: All requirements_

- [~] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests should run with minimum 100 iterations using fast-check library
- TypeScript is the implementation language as specified in the design document
- Integration tests should use mocked GitHub API responses for deterministic behavior
