/**
 * Devcontainer Parser implementation
 * Parses and validates devcontainer.json configurations
 */

import { IDevcontainerParser, DevcontainerConfig, ValidationResult, ValidationError, Feature } from '../types/services';

/**
 * Custom error class for devcontainer parsing errors
 */
export class DevcontainerParseError extends Error {
  constructor(message: string, public line?: number) {
    super(message);
    this.name = 'DevcontainerParseError';
  }
}

/**
 * DevcontainerParser implementation
 * Parses and validates devcontainer.json configurations
 */
export class DevcontainerParser implements IDevcontainerParser {
  /**
   * Parse devcontainer.json content
   * Validates JSON syntax and extracts configuration
   */
  async parse(content: string): Promise<DevcontainerConfig> {
    if (!content || content.trim().length === 0) {
      throw new DevcontainerParseError('Devcontainer content cannot be empty');
    }

    try {
      const config: DevcontainerConfig = JSON.parse(content);
      return config;
    } catch (error) {
      const parseError = error as Error;
      const line = this.extractLineNumber(parseError.message);
      throw new DevcontainerParseError(`Failed to parse devcontainer.json: ${parseError.message}`, line);
    }
  }

  /**
   * Validate devcontainer configuration
   * Checks for required fields and valid values
   */
  async validate(config: DevcontainerConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!config || (!config.image && !config.dockerFile && !config.build)) {
      errors.push({
        field: 'root',
        message: 'Devcontainer configuration must specify an image, dockerFile, or build configuration',
      });
    }

    // Validate image if present (including empty string)
    if ('image' in config) {
      if (typeof config.image !== 'string' || config.image.trim().length === 0) {
        errors.push({
          field: 'image',
          message: 'Image must be a non-empty string',
        });
      }
    }

    // Validate dockerFile if present (including empty string)
    if ('dockerFile' in config) {
      if (typeof config.dockerFile !== 'string' || config.dockerFile.trim().length === 0) {
        errors.push({
          field: 'dockerFile',
          message: 'Dockerfile path must be a non-empty string',
        });
      }
    }

    // Validate build configuration if present
    if (config.build) {
      if ('dockerfile' in config.build) {
        if (typeof config.build.dockerfile !== 'string' || config.build.dockerfile.trim().length === 0) {
          errors.push({
            field: 'build.dockerfile',
            message: 'Build dockerfile path must be a non-empty string',
          });
        }
      }

      if ('context' in config.build) {
        if (typeof config.build.context !== 'string' || config.build.context.trim().length === 0) {
          errors.push({
            field: 'build.context',
            message: 'Build context must be a non-empty string',
          });
        }
      }
    }

    // Validate features if present
    if (config.features) {
      if (typeof config.features !== 'object' || Array.isArray(config.features)) {
        errors.push({
          field: 'features',
          message: 'Features must be an object',
        });
      }
    }

    // Validate customizations if present
    if (config.customizations) {
      if (typeof config.customizations !== 'object' || Array.isArray(config.customizations)) {
        errors.push({
          field: 'customizations',
          message: 'Customizations must be an object',
        });
      }

      // Validate VS Code customizations
      if (config.customizations.vscode) {
        if (config.customizations.vscode.extensions) {
          if (!Array.isArray(config.customizations.vscode.extensions)) {
            errors.push({
              field: 'customizations.vscode.extensions',
              message: 'VS Code extensions must be an array',
            });
          }
        }

        if (config.customizations.vscode.settings) {
          if (typeof config.customizations.vscode.settings !== 'object' || Array.isArray(config.customizations.vscode.settings)) {
            errors.push({
              field: 'customizations.vscode.settings',
              message: 'VS Code settings must be an object',
            });
          }
        }
      }
    }

    // Validate forwardPorts if present
    if (config.forwardPorts) {
      if (!Array.isArray(config.forwardPorts)) {
        errors.push({
          field: 'forwardPorts',
          message: 'Forward ports must be an array',
        });
      } else {
        for (let i = 0; i < config.forwardPorts.length; i++) {
          const port = config.forwardPorts[i];
          if (typeof port !== 'number' || port < 1 || port > 65535) {
            errors.push({
              field: `forwardPorts[${i}]`,
              message: 'Port must be a number between 1 and 65535',
            });
          }
        }
      }
    }

    // Validate remoteUser if present (including empty string)
    if ('remoteUser' in config) {
      if (typeof config.remoteUser !== 'string' || config.remoteUser.trim().length === 0) {
        errors.push({
          field: 'remoteUser',
          message: 'Remote user must be a non-empty string',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract dependencies from devcontainer configuration
   * Returns array of package manager dependencies (npm, pip, apt, etc.)
   */
  extractDependencies(config: DevcontainerConfig): string[] {
    const dependencies: string[] = [];

    // Check for postCreateCommand that might install dependencies
    if (config.postCreateCommand) {
      const commands = Array.isArray(config.postCreateCommand) ? config.postCreateCommand : [config.postCreateCommand];

      for (const command of commands) {
        // Extract npm packages (handles multiple packages like "npm install express typescript")
        const npmMatches = command.match(/npm install (.+)/);
        if (npmMatches && npmMatches[1]) {
          const packages = npmMatches[1].split(/\s+/);
          dependencies.push(...packages);
        }

        // Extract pip packages (handles multiple packages like "pip install flask django")
        const pipMatches = command.match(/pip install (.+)/);
        if (pipMatches && pipMatches[1]) {
          const packages = pipMatches[1].split(/\s+/);
          dependencies.push(...packages);
        }

        // Extract apt packages (handles multiple packages like "apt-get install git curl")
        const aptMatches = command.match(/apt-get install (.+)/);
        if (aptMatches && aptMatches[1]) {
          const packages = aptMatches[1].split(/\s+/);
          dependencies.push(...packages);
        }
      }
    }

    // Check for features that might specify dependencies
    if (config.features) {
      for (const [featureName, featureConfig] of Object.entries(config.features)) {
        if (typeof featureConfig === 'object' && featureConfig !== null) {
          // Some features specify packages
          if ('packages' in featureConfig && Array.isArray(featureConfig.packages)) {
            for (const pkg of featureConfig.packages) {
              if (typeof pkg === 'string') {
                dependencies.push(`${featureName}:${pkg}`);
              }
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract Docker image from devcontainer configuration
   */
  getImage(config: DevcontainerConfig): string {
    if (config.image) {
      return config.image;
    }

    if (config.dockerFile) {
      return 'custom-dockerfile';
    }

    if (config.build?.dockerfile) {
      return 'custom-build';
    }

    return 'default';
  }

  /**
   * Extract features from devcontainer configuration
   */
  getFeatures(config: DevcontainerConfig): Feature[] {
    if (!config.features) {
      return [];
    }

    return Object.entries(config.features).map(([name, options]) => ({
      name,
      options: typeof options === 'object' && options !== null && Object.keys(options).length > 0 ? options : undefined,
    }));
  }

  /**
   * Extract line number from error message
   */
  private extractLineNumber(message: string): number | undefined {
    const lineMatch = message.match(/line (\d+)/i);
    if (lineMatch) {
      return parseInt(lineMatch[1], 10);
    }

    const positionMatch = message.match(/position (\d+)/i);
    if (positionMatch) {
      // Position to line conversion (simplified)
      return 1;
    }

    return undefined;
  }
}
