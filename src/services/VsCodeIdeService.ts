/**
 * VS Code IDE Service implementation
 * Manages VS Code IDE embedding and scripting via MCP
 */

import { IVsCodeIdeService, Codespace, CodespaceConfig, IdeHealthCheck, McpCommand, McpResponse, VsCodeIdeConfig } from '../types/services';
import { IGitHubClient } from '../types/services';
import { randomBytes } from 'crypto';

/**
 * Custom error class for VS Code IDE service errors
 */
export class VsCodeIdeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VsCodeIdeServiceError';
  }
}

/**
 * VS Code IDE Service implementation
 * Manages VS Code IDE embedding and scripting via MCP
 */
export class VsCodeIdeService implements IVsCodeIdeService {
  constructor(_githubClient: IGitHubClient) {
    void _githubClient;
  }

  /**
   * Create a new codespace
   */
  async createCodespace(repoId: string, ref: string, config?: CodespaceConfig): Promise<Codespace> {
    if (!repoId || repoId.trim().length === 0) {
      throw new VsCodeIdeServiceError('Repository ID is required');
    }
    if (!ref || ref.trim().length === 0) {
      throw new VsCodeIdeServiceError('Branch/commit reference is required');
    }

    // Use GitHub API to create codespace
    // This would call: POST /user/codespaces
    const codespaceName = this.generateCodespaceName();

    return {
      id: codespaceName,
      name: codespaceName,
      environmentName: codespaceName,
      state: 'Starting',
      createdAt: new Date(),
      gitStatus: {
        ref,
        sha: '',
        ahead: 0,
        behind: 0,
      },
      ports: config?.ports ? config.ports.map(port => ({ port, visibility: 'private' })) : [],
    };
  }

  /**
   * Start a codespace
   */
  async startCodespace(codespaceName: string): Promise<Codespace> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    // Use GitHub API to start codespace
    // This would call: POST /user/codespaces/{name}/start
    return {
      id: codespaceName,
      name: codespaceName,
      environmentName: codespaceName,
      state: 'Available',
      createdAt: new Date(),
      gitStatus: {
        ref: 'main',
        sha: '',
        ahead: 0,
        behind: 0,
      },
      ports: [],
    };
  }

  /**
   * Stop a codespace
   */
  async stopCodespace(codespaceName: string): Promise<void> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    // Use GitHub API to stop codespace
    // This would call: POST /user/codespaces/{name}/stop
  }

  /**
   * Delete a codespace
   */
  async deleteCodespace(codespaceName: string): Promise<void> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    // Use GitHub API to delete codespace
    // This would call: DELETE /user/codespaces/{name}
  }

  /**
   * Get codespace details
   */
  async getCodespace(codespaceName: string): Promise<Codespace> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    // Use GitHub API to get codespace
    // This would call: GET /user/codespaces/{name}
    return {
      id: codespaceName,
      name: codespaceName,
      environmentName: codespaceName,
      state: 'Available',
      createdAt: new Date(),
      gitStatus: {
        ref: 'main',
        sha: '',
        ahead: 0,
        behind: 0,
      },
      ports: [],
    };
  }

  /**
   * List all codespaces
   */
  async listCodespaces(): Promise<Codespace[]> {
    // Use GitHub API to list codespaces
    // This would call: GET /user/codespaces
    return [];
  }

  /**
   * Perform health check on codespace VS Code IDE
   */
  async healthCheck(codespaceName: string): Promise<IdeHealthCheck> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    try {
      const codespace = await this.getCodespace(codespaceName);

      // Check if codespace is available
      if (codespace.state !== 'Available') {
        return {
          healthy: false,
          codespaceState: codespace.state,
          mcpServer: false,
          codeServer: false,
          lastCheck: new Date(),
          errorMessage: `Codespace is not available. Current state: ${codespace.state}`,
        };
      }

      // Check MCP server connectivity
      const mcpEndpoint = this.getMcpEndpointUrl(codespaceName);
      const mcpServer = await this.checkMcpServer(mcpEndpoint);

      // Check code-server availability
      const codeServerUrl = this.getCodeServerUrl(codespaceName);
      const codeServer = await this.checkCodeServer(codeServerUrl);

      return {
        healthy: mcpServer && codeServer,
        codespaceState: codespace.state,
        mcpServer,
        codeServer,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        codespaceState: 'Error',
        mcpServer: false,
        codeServer: false,
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Configure VS Code IDE for a codespace
   */
  async configureVsCodeIde(codespaceName: string, config: VsCodeIdeConfig): Promise<void> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }
    if (!config) {
      throw new VsCodeIdeServiceError('Configuration is required');
    }

    // Store configuration for use in devcontainer.json generation
    // This would update the devcontainer configuration for the codespace
  }

  /**
   * Get VS Code IDE configuration for a codespace
   */
  async getVsCodeIdeConfig(codespaceName: string): Promise<VsCodeIdeConfig> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }

    return {
      enabled: true,
      serverType: 'code-server',
      port: 8080,
      mcpPort: 8765,
      auth: 'none',
      disableTelemetry: true,
      disableWorkspaceTrust: true,
    };
  }

  /**
   * Send MCP command to codespace
   */
  async sendMcpCommand(codespaceName: string, command: McpCommand): Promise<McpResponse> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }
    if (!command || !command.method) {
      throw new VsCodeIdeServiceError('Command is required');
    }

    const mcpEndpoint = this.getMcpEndpointUrl(codespaceName);

    try {
      const response = await fetch(mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new VsCodeIdeServiceError(`MCP command failed: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as McpResponse;
      return result;
    } catch (error) {
      throw new VsCodeIdeServiceError(`Failed to send MCP command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a VS Code action via MCP
   */
  async executeVsCodeAction(codespaceName: string, action: string, params: any): Promise<any> {
    if (!codespaceName || codespaceName.trim().length === 0) {
      throw new VsCodeIdeServiceError('Codespace name is required');
    }
    if (!action || action.trim().length === 0) {
      throw new VsCodeIdeServiceError('Action is required');
    }

    const command: McpCommand = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: action,
        arguments: params,
      },
    };

    const response = await this.sendMcpCommand(codespaceName, command);
    return response.result;
  }

  /**
   * Get the URL for a forwarded port
   */
  getPortUrl(codespaceName: string, port: number): string {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    return `https://${codespaceName}-${port}.${domain}`;
  }

  /**
   * Get the MCP endpoint URL for a codespace
   */
  getMcpEndpointUrl(codespaceName: string): string {
    return `${this.getPortUrl(codespaceName, 8765)}/mcp`;
  }

  /**
   * Get the code-server URL for a codespace
   */
  getCodeServerUrl(codespaceName: string): string {
    return this.getPortUrl(codespaceName, 8080);
  }

  /**
   * Check if MCP server is responding
   */
  private async checkMcpServer(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'health-check',
          method: 'tools/call',
          params: {
            name: 'ping',
            arguments: {},
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if code-server is responding
   */
  private async checkCodeServer(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a unique codespace name
   */
  private generateCodespaceName(): string {
    return `codespace-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${randomBytes(8).toString('hex')}`;
  }
}
