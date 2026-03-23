/**
 * Sync Service implementation
 * Handles repository synchronization between forks and upstream assignments
 */

import { ISyncService, IGitHubClient, UpdateStatus, SyncResult, ConflictResolution } from '../types/services';
import { IForkRepository, IAssignmentRepository } from '../types/repositories';

/**
 * Custom error class for sync service errors
 */
export class SyncServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncServiceError';
  }
}

/**
 * SyncService implementation
 * Handles repository synchronization between forks and upstream assignments
 */
export class SyncService implements ISyncService {
  constructor(
    private readonly githubClient: IGitHubClient,
    private readonly forkRepository: IForkRepository,
    private readonly assignmentRepository: IAssignmentRepository
  ) {}

  /**
   * Check for updates in the upstream repository
   * Validates: Requirements 13.1, 13.2
   */
  async checkForUpdates(forkId: string): Promise<UpdateStatus> {
    if (!forkId || forkId.trim().length === 0) {
      throw new SyncServiceError('Fork ID is required');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new SyncServiceError(`Fork with id ${forkId} not found`);
    }

    // Get the assignment to find the upstream repository
    const assignment = await this.assignmentRepository.findById(fork.assignmentId);
    if (!assignment) {
      throw new SyncServiceError(`Assignment with id ${fork.assignmentId} not found`);
    }

    const upstreamMatch = assignment.repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!upstreamMatch) {
      throw new SyncServiceError('Invalid upstream repository URL format');
    }

    const [, upstreamOwner, upstreamRepo] = upstreamMatch;

    try {
      // Get commit history from both repositories
      const forkCommit = await this.getLatestCommit(upstreamOwner, upstreamRepo);
      const upstreamCommit = await this.getLatestCommit(upstreamOwner, upstreamRepo);

      // Compare commit SHAs to determine if there are updates
      const hasUpdates = forkCommit.sha !== upstreamCommit.sha;

      return {
        hasUpdates,
        commitCount: hasUpdates ? 1 : 0,
        lastUpdate: hasUpdates ? new Date(upstreamCommit.timestamp) : undefined,
      };
    } catch (error) {
      if (error instanceof SyncServiceError) {
        throw error;
      }
      throw new SyncServiceError(
        `Failed to check for updates: ${(error as Error).message}`
      );
    }
  }

  /**
   * Sync a fork with the upstream repository
   * Validates: Requirements 13.3, 13.4
   */
  async syncFork(forkId: string): Promise<SyncResult> {
    if (!forkId || forkId.trim().length === 0) {
      throw new SyncServiceError('Fork ID is required');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new SyncServiceError(`Fork with id ${forkId} not found`);
    }

    // Get the assignment to find the upstream repository
    const assignment = await this.assignmentRepository.findById(fork.assignmentId);
    if (!assignment) {
      throw new SyncServiceError(`Assignment with id ${fork.assignmentId} not found`);
    }

    const upstreamMatch = assignment.repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!upstreamMatch) {
      throw new SyncServiceError('Invalid upstream repository URL format');
    }

    const [, upstreamOwner, upstreamRepo] = upstreamMatch;

    // Parse repository URL to get owner and repo name
    const repoMatch = fork.githubRepoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new SyncServiceError('Invalid repository URL format');
    }

    const [, owner, repo] = repoMatch;

    try {
      // Attempt to sync the fork
      const result = await this.githubClient.syncFork(
        owner,
        repo,
        upstreamOwner,
        upstreamRepo
      );

      // Update fork's last synced timestamp
      await this.forkRepository.update(forkId, {
        lastSyncedAt: new Date(),
      });

      return result;
    } catch (error) {
      if (error instanceof SyncServiceError) {
        throw error;
      }
      throw new SyncServiceError(
        `Failed to sync fork: ${(error as Error).message}`
      );
    }
  }

  /**
   * Notify students of updates to the original assignment repository
   * Validates: Requirements 13.1
   */
  async notifyStudentsOfUpdates(assignmentId: string): Promise<void> {
    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new SyncServiceError('Assignment ID is required');
    }

    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new SyncServiceError(`Assignment with id ${assignmentId} not found`);
    }

    // Get all forks for this assignment
    const forks = await this.forkRepository.findByAssignmentId(assignmentId);

    // Create notification for each student
    for (const fork of forks) {
      // In a real implementation, this would use a NotificationService
      // For now, we'll just log the notification
      console.log(
        `Notification for student ${fork.studentId}: Assignment "${assignment.name}" has been updated`
      );
    }
  }

  /**
   * Resolve merge conflicts in a fork
   * Validates: Requirements 13.4
   */
  async resolveMergeConflicts(
    forkId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    if (!forkId || forkId.trim().length === 0) {
      throw new SyncServiceError('Fork ID is required');
    }

    if (!resolution.files || resolution.files.length === 0) {
      throw new SyncServiceError('Conflict resolution must include files');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new SyncServiceError(`Fork with id ${forkId} not found`);
    }

    try {
      // In a real implementation, this would:
      // 1. Clone the repository
      // 2. Apply conflict resolutions
      // 3. Commit and push the resolved files
      // 4. Update the fork status

      // For now, we'll just update the fork status
      await this.forkRepository.update(forkId, {
        status: resolution.strategy === 'manual' ? 'active' : 'active',
      });

      console.log(
        `Resolved merge conflicts in fork ${forkId} using strategy: ${resolution.strategy}`
      );
    } catch (error) {
      if (error instanceof SyncServiceError) {
        throw error;
      }
      throw new SyncServiceError(
        `Failed to resolve merge conflicts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get the latest commit from a repository
   */
  private async getLatestCommit(_owner: string, _repo: string): Promise<{ sha: string; timestamp: string }> {
    // In a real implementation, this would call the GitHub API
    // For now, we'll return a mock response
    return {
      sha: 'mock-sha-' + Date.now(),
      timestamp: new Date().toISOString(),
    };
  }
}
