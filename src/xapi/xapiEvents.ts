/**
 * Internal domain events mapped to xAPI statements.
 */

export type XapiDomainEvent =
  | {
      type: 'assignment_forked';
      occurredAt: Date;
      courseId: string;
      assignmentId: string;
      studentId: string;
      forkId: string;
      repositoryUrl?: string;
    }
  | {
      type: 'assignment_submitted';
      occurredAt: Date;
      courseId: string;
      assignmentId: string;
      studentId: string;
      forkId: string;
      submissionId: string;
      pullRequestUrl: string;
      pullRequestNumber: number;
    }
  | {
      type: 'submission_graded';
      occurredAt: Date;
      courseId: string;
      assignmentId: string;
      studentId: string;
      submissionId: string;
      gradedByUserId: string;
      score: number;
      maxScore: number;
    }
  | {
      type: 'feedback_added';
      occurredAt: Date;
      courseId: string;
      assignmentId: string;
      studentId: string;
      submissionId: string;
      authorId: string;
    };
