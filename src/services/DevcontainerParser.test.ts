/**
 * Unit tests for DevcontainerParser
 */

import { DevcontainerParser, DevcontainerParseError } from './DevcontainerParser';

describe('DevcontainerParser', () => {
  let parser: DevcontainerParser;

  beforeEach(() => {
    parser = new DevcontainerParser();
  });

  describe('parse', () => {
    it('should parse valid devcontainer.json', async () => {
      const content = JSON.stringify({
        image: 'node:18',
        features: {
          'ghcr.io/devcontainers/features/node:1': {
            version: '18'
          }
        },
        customizations: {
          vscode: {
            extensions: ['ms-vscode.vscode-typescript']
          }
        }
      });

      const result = await parser.parse(content);

      expect(result.image).toBe('node:18');
      expect(result.features).toBeDefined();
      expect(result.customizations).toBeDefined();
    });

    it('should parse devcontainer.json with dockerFile', async () => {
      const content = JSON.stringify({
        dockerFile: 'Dockerfile',
        build: {
          context: '.',
          args: {
            NODE_VERSION: '18'
          }
        }
      });

      const result = await parser.parse(content);

      expect(result.dockerFile).toBe('Dockerfile');
      expect(result.build).toBeDefined();
    });

    it('should parse devcontainer.json with postCreateCommand', async () => {
      const content = JSON.stringify({
        image: 'node:18',
        postCreateCommand: 'npm install && npm run build'
      });

      const result = await parser.parse(content);

      expect(result.postCreateCommand).toBe('npm install && npm run build');
    });

    it('should parse devcontainer.json with array postCreateCommand', async () => {
      const content = JSON.stringify({
        image: 'node:18',
        postCreateCommand: ['npm install', 'npm run build']
      });

      const result = await parser.parse(content);

      expect(Array.isArray(result.postCreateCommand)).toBe(true);
    });

    it('should reject empty content', async () => {
      await expect(parser.parse('')).rejects.toThrow(DevcontainerParseError);
      await expect(parser.parse('   ')).rejects.toThrow(DevcontainerParseError);
    });

    it('should reject invalid JSON', async () => {
      await expect(parser.parse('{ invalid json')).rejects.toThrow(DevcontainerParseError);
    });

    it('should extract line number from parse error', async () => {
      const content = '{ "image": "node:18", }'; // Invalid JSON with trailing comma

      await expect(parser.parse(content)).rejects.toThrow(DevcontainerParseError);
    });
  });

  describe('validate', () => {
    it('should validate valid devcontainer configuration', async () => {
      const config = {
        image: 'node:18',
        customizations: {
          vscode: {
            extensions: ['ms-vscode.vscode-typescript']
          }
        }
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate devcontainer with dockerFile', async () => {
      const config = {
        dockerFile: 'Dockerfile',
        build: {
          context: '.',
          dockerfile: 'Dockerfile'
        }
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(true);
    });

    it('should reject empty configuration', async () => {
      const config: any = {};

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid image', async () => {
      const config = {
        image: ''
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'image')).toBe(true);
    });

    it('should reject invalid dockerFile', async () => {
      const config = {
        dockerFile: ''
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'dockerFile')).toBe(true);
    });

    it('should reject invalid build context', async () => {
      const config = {
        build: {
          context: ''
        }
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'build.context')).toBe(true);
    });

    it('should reject invalid VS Code extensions', async () => {
      const config = {
        customizations: {
          vscode: {
            extensions: 'not-an-array' as any
          }
        }
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'customizations.vscode.extensions')).toBe(true);
    });

    it('should reject invalid port numbers', async () => {
      const config = {
        forwardPorts: [0, 70000, -1]
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid remoteUser', async () => {
      const config = {
        remoteUser: ''
      };

      const result = await parser.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'remoteUser')).toBe(true);
    });
  });

  describe('extractDependencies', () => {
    it('should extract npm dependencies from postCreateCommand', async () => {
      const config = {
        postCreateCommand: 'npm install express typescript'
      };

      const deps = parser.extractDependencies(config);

      expect(deps).toContain('express');
      expect(deps).toContain('typescript');
    });

    it('should extract pip dependencies from postCreateCommand', async () => {
      const config = {
        postCreateCommand: 'pip install flask django'
      };

      const deps = parser.extractDependencies(config);

      expect(deps).toContain('flask');
      expect(deps).toContain('django');
    });

    it('should extract apt dependencies from postCreateCommand', async () => {
      const config = {
        postCreateCommand: 'apt-get install git curl'
      };

      const deps = parser.extractDependencies(config);

      expect(deps).toContain('git');
      expect(deps).toContain('curl');
    });

    it('should extract dependencies from features', async () => {
      const config = {
        features: {
          'ghcr.io/devcontainers/features/node': {
            version: '18',
            packages: ['typescript', 'eslint']
          }
        }
      };

      const deps = parser.extractDependencies(config);

      expect(deps).toContain('ghcr.io/devcontainers/features/node:typescript');
      expect(deps).toContain('ghcr.io/devcontainers/features/node:eslint');
    });

    it('should return empty array for no dependencies', async () => {
      const config = {
        image: 'node:18'
      };

      const deps = parser.extractDependencies(config);

      expect(deps).toEqual([]);
    });
  });

  describe('getImage', () => {
    it('should return image when specified', async () => {
      const config = {
        image: 'node:18'
      };

      expect(parser.getImage(config)).toBe('node:18');
    });

    it('should return custom-dockerfile when dockerFile is specified', async () => {
      const config = {
        dockerFile: 'Dockerfile'
      };

      expect(parser.getImage(config)).toBe('custom-dockerfile');
    });

    it('should return custom-build when build.dockerfile is specified', async () => {
      const config = {
        build: {
          dockerfile: 'Dockerfile'
        }
      };

      expect(parser.getImage(config)).toBe('custom-build');
    });

    it('should return default when no image or dockerFile', async () => {
      const config: any = {};

      expect(parser.getImage(config)).toBe('default');
    });
  });

  describe('getFeatures', () => {
    it('should extract features from configuration', async () => {
      const config = {
        features: {
          'ghcr.io/devcontainers/features/node': {
            version: '18'
          },
          'ghcr.io/devcontainers/features/github-cli': {}
        }
      };

      const features = parser.getFeatures(config);

      expect(features.length).toBe(2);
      expect(features[0].name).toBe('ghcr.io/devcontainers/features/node');
      expect(features[0].options).toBeDefined();
      expect(features[1].name).toBe('ghcr.io/devcontainers/features/github-cli');
      expect(features[1].options).toBeUndefined();
    });

    it('should return empty array when no features', async () => {
      const config: any = {};

      const features = parser.getFeatures(config);

      expect(features).toEqual([]);
    });
  });
});
