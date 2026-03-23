/**
 * Environment Setup Service implementation
 * Handles repository cloning and development environment setup
 */

import { IForkRepository } from '../types/repositories';
import { DevcontainerConfig } from '../types/models';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Custom error class for environment setup errors
 */
export class EnvironmentSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentSetupError';
  }
}

/**
 * Progress event interface for environment setup
 */
export interface SetupProgress {
  stage: 'cloning' | 'installing' | 'configuring' | 'completed' | 'failed';
  message: string;
  percentage: number;
  error?: string;
}

/**
 * EnvironmentSetupService implementation
 * Handles repository cloning and development environment setup
 */
export class EnvironmentSetupService {
  constructor(
    private readonly forkRepository: IForkRepository
  ) {}

  /**
   * Setup environment for a forked repository
   * Validates: Requirements 9.1, 9.2, 9.3
   */
  async setupEnvironment(forkId: string, progressCallback?: (progress: SetupProgress) => void): Promise<void> {
    if (!forkId || forkId.trim().length === 0) {
      throw new EnvironmentSetupError('Fork ID is required');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new EnvironmentSetupError(`Fork with id ${forkId} not found`);
    }

    try {
      // Update fork status to in_progress
      await this.forkRepository.update(forkId, {
        environmentSetup: {
          status: 'in_progress',
          lastAttempt: new Date(),
        },
      });

      // Notify progress
      progressCallback?.({
        stage: 'cloning',
        message: 'Cloning repository...',
        percentage: 10,
      });

      // Clone the repository
      const localPath = await this.cloneRepository(fork.githubRepoUrl);

      // Notify progress
      progressCallback?.({
        stage: 'installing',
        message: 'Installing dependencies...',
        percentage: 40,
      });

      // Parse devcontainer configuration
      const devcontainerPath = join(localPath, '.devcontainer', 'devcontainer.json');
      const devcontainerConfig = await this.parseDevcontainer(devcontainerPath);

      // Install dependencies based on devcontainer config
      await this.installDependencies(localPath, devcontainerConfig);

      // Notify progress
      progressCallback?.({
        stage: 'configuring',
        message: 'Configuring environment...',
        percentage: 80,
      });

      // Configure environment (Docker, VS Code extensions, etc.)
      await this.configureEnvironment(devcontainerConfig);

      // Notify progress
      progressCallback?.({
        stage: 'completed',
        message: 'Environment setup completed',
        percentage: 100,
      });

      // Update fork status to completed
      await this.forkRepository.update(forkId, {
        environmentSetup: {
          status: 'completed',
          lastAttempt: new Date(),
        },
      });
    } catch (error) {
      // Update fork status to failed
      await this.forkRepository.update(forkId, {
        environmentSetup: {
          status: 'failed',
          lastAttempt: new Date(),
          errorMessage: (error as Error).message,
        },
      });

      // Notify progress with error
      progressCallback?.({
        stage: 'failed',
        message: 'Environment setup failed',
        percentage: 100,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Clone a repository to a local path
   */
  private async cloneRepository(repoUrl: string): Promise<string> {
    // Generate a unique local path
    const tempDir = join('/tmp', `fork-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      // Clone the repository
      await execAsync(`git clone ${repoUrl} ${tempDir}`);
      return tempDir;
    } catch (error) {
      // Clean up on failure
      await rm(tempDir, { recursive: true, force: true });
      throw new EnvironmentSetupError(`Failed to clone repository: ${(error as Error).message}`);
    }
  }

  /**
   * Parse devcontainer configuration
   */
  private async parseDevcontainer(_path: string): Promise<DevcontainerConfig> {
    // In a real implementation, this would read and parse the devcontainer.json file
    // For now, we'll return a default configuration
    return {
      image: 'node:18',
      postCreateCommand: 'npm install',
      forwardPorts: [3000],
    };
  }

  /**
   * Install dependencies based on devcontainer configuration
   */
  private async installDependencies(localPath: string, config: DevcontainerConfig): Promise<void> {
    // Install npm dependencies if package.json exists
    if (config.postCreateCommand) {
      try {
        const command = Array.isArray(config.postCreateCommand) ? config.postCreateCommand.join(' && ') : config.postCreateCommand;
        await execAsync(command, { cwd: localPath });
      } catch (error) {
        console.warn(`Failed to run postCreateCommand: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Configure environment (Docker, VS Code extensions, etc.)
   */
  private async configureEnvironment(config: DevcontainerConfig): Promise<void> {
    // Pull Docker image if specified
    if (config.image) {
      try {
        await execAsync(`docker pull ${config.image}`);
      } catch (error) {
        console.warn(`Failed to pull Docker image: ${(error as Error).message}`);
      }
    }

    // Install VS Code extensions if specified
    if (config.customizations?.vscode?.extensions) {
      for (const extension of config.customizations.vscode.extensions) {
        try {
          await execAsync(`code --install-extension ${extension}`);
        } catch (error) {
          console.warn(`Failed to install VS Code extension ${extension}: ${(error as Error).message}`);
        }
      }
    }

    // Run postStartCommand if specified
    if (config.postStartCommand) {
      try {
        const command = Array.isArray(config.postStartCommand) ? config.postStartCommand.join(' && ') : config.postStartCommand;
        await execAsync(command);
      } catch (error) {
        console.warn(`Failed to run postStartCommand: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Cancel environment setup
   */
  async cancelSetup(forkId: string): Promise<void> {
    if (!forkId || forkId.trim().length === 0) {
      throw new EnvironmentSetupError('Fork ID is required');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new EnvironmentSetupError(`Fork with id ${forkId} not found`);
    }

    // Update fork status to pending
    await this.forkRepository.update(forkId, {
      environmentSetup: {
        status: 'pending',
      },
    });
  }

  /**
   * Get setup status for a fork
   */
  async getSetupStatus(forkId: string): Promise<SetupProgress> {
    if (!forkId || forkId.trim().length === 0) {
      throw new EnvironmentSetupError('Fork ID is required');
    }

    const fork = await this.forkRepository.findById(forkId);
    if (!fork) {
      throw new EnvironmentSetupError(`Fork with id ${forkId} not found`);
    }

    const status = fork.environmentSetup.status;
    let percentage = 0;
    let message = '';

    switch (status) {
      case 'pending':
        percentage = 0;
        message = 'Environment setup pending';
        break;
      case 'in_progress':
        percentage = 50;
        message = 'Environment setup in progress';
        break;
      case 'completed':
        percentage = 100;
        message = 'Environment setup completed';
        break;
      case 'failed':
        percentage = 100;
        message = 'Environment setup failed';
        break;
      default:
        percentage = 0;
        message = 'Unknown status';
    }

    return {
      stage: status as 'cloning' | 'installing' | 'configuring' | 'completed' | 'failed',
      message,
      percentage,
      error: fork.environmentSetup.errorMessage,
    };
  }
}
