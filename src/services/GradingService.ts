/**
 * Grading Service implementation
 * Handles assignment submissions, grading, and feedback
 */

import { Submission, Grade, Feedback, Fork, Assignment } from '../types/models';
import { IGradingService, IGitHubClient } from '../types/services';
import type { IXapiEventSink } from '../xapi/xapiSinkTypes';
import { IAssignmentRepository, IForkRepository, ISubmissionRepository } from '../types/repositories';
import { randomBytes } from 'crypto';
import { noopXapiSink } from '../xapi/noopXapiSink';

/**
 * Custom error class for grading service errors
 */
export class GradingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GradingServiceError';
  }
}

/**
 * GradingService implementation
 * Handles assignment submissions, grading, and feedback
 */
export class GradingService implements IGradingService {
  constructor(
    private readonly githubClient: IGitHubClient,
    private readonly assignmentRepository: IAssignmentRepository,
    private readonly forkRepository: IForkRepository,
    private readonly submissionRepository: ISubmissionRepository,
    private readonly xapiSink: IXapiEventSink = noopXapiSink
  ) {}

  /**
   * Submit an assignment by creating a pull request
   * Validates: Requirements 10.1, 10.2
   */
  async submitAssignment(forkId: string, studentId: string): Promise<Submission> {
    if (!forkId || forkId.trim().length === 0) {
      throw new GradingServiceError('Fork ID is required');
    }
    if (!studentId || studentId.trim().length === 0) {
      throw new GradingServiceError('Student ID is required');
    }

    // Get fork and assignment information
    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new GradingServiceError(`Fork with id ${forkId} not found`);
    }

    const assignment = await this.assignmentRepository.findById(fork.assignmentId);
    if (!assignment) {
      throw new GradingServiceError(`Assignment with id ${fork.assignmentId} not found`);
    }

    // Validate submission state
    await this.validatePreSubmission(fork, assignment);

    // Parse repository URL to get owner and repo name
    const repoMatch = assignment.repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new GradingServiceError('Invalid assignment repository URL format');
    }

    const [, owner, repo] = repoMatch;

    // Parse forked repository URL to get student's branch
    const forkMatch = fork.githubRepoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!forkMatch) {
      throw new GradingServiceError('Invalid fork repository URL format');
    }

    const [, _forkOwner, _forkRepo] = forkMatch;

    try {
      // Create pull request to original repository
      const prConfig = {
        title: `[Submission] ${studentId.substring(0, 8)} - ${assignment.name}`,
        body: `Student submission for ${assignment.name}\n\nFork: ${fork.githubRepoUrl}\nSubmitted at: ${new Date().toISOString()}`,
        head: 'main', // Student's main branch in fork
        base: 'main', // Original repository's main branch
      };

      const pr = await this.githubClient.createPullRequest(owner, repo, prConfig);

      // Create submission record
      const submission: Submission = {
        id: this.generateSubmissionId(),
        forkId,
        studentId,
        assignmentId: fork.assignmentId,
        submittedAt: new Date(),
        pullRequestUrl: pr.url,
        pullRequestNumber: pr.number,
        status: 'pending',
        grade: undefined,
        feedback: [],
      };

      // Update fork status
      fork.status = 'submitted';
      await this.forkRepository.update(forkId, { status: 'submitted' });

      // Save submission to repository
      const savedSubmission = await this.submissionRepository.create(submission);

      this.xapiSink.emit({
        type: 'assignment_submitted',
        occurredAt: savedSubmission.submittedAt,
        courseId: assignment.courseId,
        assignmentId: fork.assignmentId,
        studentId,
        forkId,
        submissionId: savedSubmission.id,
        pullRequestUrl: savedSubmission.pullRequestUrl,
        pullRequestNumber: savedSubmission.pullRequestNumber,
      });

      return savedSubmission;
    } catch (error) {
      if (error instanceof GradingServiceError) {
        throw error;
      }
      throw new GradingServiceError(
        `Failed to submit assignment: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get a submission by ID
   * Validates: Requirements 10.1, 11.1
   */
  async getSubmission(submissionId: string): Promise<Submission> {
    if (!submissionId || submissionId.trim().length === 0) {
      throw new GradingServiceError('Submission ID is required');
    }

    const submission = await this.submissionRepository.findById(submissionId);

    if (!submission) {
      throw new GradingServiceError(`Submission with id ${submissionId} not found`);
    }

    return submission;
  }

  /**
   * Grade a submission
   * Validates: Requirements 11.1, 11.2
   */
  async gradeSubmission(submissionId: string, grade: Grade): Promise<void> {
    if (!submissionId || submissionId.trim().length === 0) {
      throw new GradingServiceError('Submission ID is required');
    }

    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw new GradingServiceError(`Submission with id ${submissionId} not found`);
    }

    // Update submission with grade
    await this.submissionRepository.update(submissionId, {
      grade,
      status: 'graded',
      updatedAt: new Date(),
    });

    // Update fork status to 'graded'
    await this.forkRepository.update(submission.forkId, { status: 'graded' });

    const assignment = await this.assignmentRepository.findById(submission.assignmentId);
    if (assignment) {
      this.xapiSink.emit({
        type: 'submission_graded',
        occurredAt: grade.gradedAt,
        courseId: assignment.courseId,
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        submissionId,
        gradedByUserId: grade.gradedBy,
        score: grade.score,
        maxScore: grade.maxScore,
      });
    }
  }

  /**
   * Add feedback to a submission
   * Validates: Requirements 11.2
   */
  async addFeedback(submissionId: string, feedback: Feedback): Promise<void> {
    if (!submissionId || submissionId.trim().length === 0) {
      throw new GradingServiceError('Submission ID is required');
    }
    if (!feedback.authorId || feedback.authorId.trim().length === 0) {
      throw new GradingServiceError('Feedback author ID is required');
    }
    if (!feedback.content || feedback.content.trim().length === 0) {
      throw new GradingServiceError('Feedback content is required');
    }

    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw new GradingServiceError(`Submission with id ${submissionId} not found`);
    }

    // Add feedback to submission
    const updatedFeedback = [...submission.feedback, { ...feedback, id: this.generateFeedbackId() }];
    await this.submissionRepository.update(submissionId, {
      feedback: updatedFeedback,
    });

    // If submission was pending, mark it as returned
    if (submission.status === 'pending') {
      await this.submissionRepository.update(submissionId, {
        status: 'returned',
      });
    }

    const assignment = await this.assignmentRepository.findById(submission.assignmentId);
    if (assignment) {
      this.xapiSink.emit({
        type: 'feedback_added',
        occurredAt: new Date(),
        courseId: assignment.courseId,
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        submissionId,
        authorId: feedback.authorId,
      });
    }
  }

  /**
   * List submissions by assignment ID
   * Validates: Requirements 11.1
   */
  async listSubmissionsByAssignment(assignmentId: string): Promise<Submission[]> {
    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new GradingServiceError('Assignment ID is required');
    }

    return await this.submissionRepository.findByAssignmentId(assignmentId);
  }

  /**
   * Get student's submissions for a course
   * Validates: Requirements 11.1
   */
  async getStudentSubmissions(studentId: string, courseId: string): Promise<Submission[]> {
    if (!studentId || studentId.trim().length === 0) {
      throw new GradingServiceError('Student ID is required');
    }
    if (!courseId || courseId.trim().length === 0) {
      throw new GradingServiceError('Course ID is required');
    }

    // Get all assignments for the course
    const assignments = await this.assignmentRepository.findByCourseId(courseId);

    // Get all submissions for the student across all assignments
    const allSubmissions: Submission[] = [];
    for (const assignment of assignments) {
      const submissions = await this.submissionRepository.findByAssignmentId(assignment.id);
      const studentSubmissions = submissions.filter(s => s.studentId === studentId);
      allSubmissions.push(...studentSubmissions);
    }

    return allSubmissions;
  }

  /**
   * Validate pre-submission state
   * Validates: Requirements 10.3
   */
  private async validatePreSubmission(fork: Fork, assignment: Assignment): Promise<void> {
    // Check if fork exists and is active
    if (fork.status !== 'active') {
      throw new GradingServiceError('Fork is not in active state for submission');
    }

    // Check if assignment allows submission
    if (assignment.deadline) {
      const now = new Date();
      const deadline = new Date(assignment.deadline);

      // Check if late submissions are allowed
      if (!assignment.allowLateSubmissions && now > deadline) {
        throw new GradingServiceError('Submission deadline has passed and late submissions are not allowed');
      }
    }

    // Check if fork has been submitted before
    const existingSubmissions = await this.submissionRepository.findByForkId(fork.id);
    if (existingSubmissions.length > 0) {
      // Check if last submission was graded
      const lastSubmission = existingSubmissions[existingSubmissions.length - 1];
      if (lastSubmission.status === 'graded') {
        throw new GradingServiceError('Assignment has already been graded');
      }
    }
  }

  /**
   * Generate a unique submission ID
   */
  private generateSubmissionId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate a unique feedback ID
   */
  private generateFeedbackId(): string {
    return randomBytes(16).toString('hex');
  }
}
