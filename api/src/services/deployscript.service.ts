/**
 * Deploy Script Service - Deployment automation and sensor bootstrap scripts
 * Handles CRUD operations, script template variable substitution, and default script loading
 */

import { prisma } from '../lib/prisma';
import { globalLogger } from '../lib/logger';

export interface CreateDeployScriptInput {
  name: string;
  script: string;
  notes?: string;
  userId: number;
}

export interface UpdateDeployScriptInput {
  name?: string;
  script?: string;
  notes?: string;
}

export interface DeployScriptResponse {
  id: number;
  name: string;
  script: string;
  notes: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Custom error for deploy script operations
 */
export class DeployScriptError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DeployScriptError';
  }
}

/**
 * Custom error for not found
 */
export class DeployScriptNotFoundError extends Error {
  statusCode = 404;

  constructor(id: number) {
    super(`Deploy script with ID ${id} not found`);
    this.name = 'DeployScriptNotFoundError';
  }
}

/**
 * Create a new deploy script
 */
export async function createDeployScript(
  input: CreateDeployScriptInput
): Promise<DeployScriptResponse> {
  try {
    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new DeployScriptError(`User with ID ${input.userId} not found`);
    }

    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new DeployScriptError('Script name is required');
    }

    if (!input.script || input.script.trim().length === 0) {
      throw new DeployScriptError('Script content is required');
    }

    const script = await prisma.deployScript.create({
      data: {
        name: input.name,
        script: input.script,
        notes: input.notes || '',
        userId: input.userId,
      },
    });

    globalLogger.info(
      { scriptId: script.id, userId: input.userId, name: input.name },
      'Deploy script created'
    );

    return formatDeployScript(script);
  } catch (error) {
    if (error instanceof DeployScriptError) {
      throw error;
    }
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to create deploy script'
    );
    throw new DeployScriptError(
      `Failed to create deploy script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get deploy script by ID
 */
export async function getDeployScriptById(id: number): Promise<DeployScriptResponse> {
  try {
    const script = await prisma.deployScript.findUnique({
      where: { id },
    });

    if (!script) {
      throw new DeployScriptNotFoundError(id);
    }

    return formatDeployScript(script);
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      throw error;
    }
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), id },
      'Failed to get deploy script'
    );
    throw new DeployScriptError(
      `Failed to get deploy script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * List deploy scripts with optional filtering by user
 */
export async function listDeployScripts(userId?: number): Promise<DeployScriptResponse[]> {
  try {
    const scripts = await prisma.deployScript.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return scripts.map(formatDeployScript);
  } catch (error) {
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to list deploy scripts'
    );
    throw new DeployScriptError(
      `Failed to list deploy scripts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Update deploy script
 */
export async function updateDeployScript(
  id: number,
  input: UpdateDeployScriptInput
): Promise<DeployScriptResponse> {
  try {
    // Check if script exists
    const existing = await prisma.deployScript.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new DeployScriptNotFoundError(id);
    }

    // Validate input
    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new DeployScriptError('Script name cannot be empty');
    }

    if (input.script !== undefined && input.script.trim().length === 0) {
      throw new DeployScriptError('Script content cannot be empty');
    }

    const script = await prisma.deployScript.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.script && { script: input.script }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    globalLogger.info({ scriptId: id }, 'Deploy script updated');

    return formatDeployScript(script);
  } catch (error) {
    if (error instanceof DeployScriptError || error instanceof DeployScriptNotFoundError) {
      throw error;
    }
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), id },
      'Failed to update deploy script'
    );
    throw new DeployScriptError(
      `Failed to update deploy script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete deploy script
 */
export async function deleteDeployScript(id: number): Promise<void> {
  try {
    const existing = await prisma.deployScript.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new DeployScriptNotFoundError(id);
    }

    await prisma.deployScript.delete({
      where: { id },
    });

    globalLogger.info({ scriptId: id }, 'Deploy script deleted');
  } catch (error) {
    if (error instanceof DeployScriptError || error instanceof DeployScriptNotFoundError) {
      throw error;
    }
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), id },
      'Failed to delete deploy script'
    );
    throw new DeployScriptError(
      `Failed to delete deploy script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get deploy script with template variables substituted
 * Replaces template variables like {server_url}, {deploy_key}, {sensor_uuid}
 */
export async function getDeployScriptRendered(
  id: number,
  variables: Record<string, string>
): Promise<string> {
  try {
    const script = await getDeployScriptById(id);

    let rendered = script.script;

    // Replace all template variables in the format {variable_name}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    });

    return rendered;
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      throw error;
    }
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), id },
      'Failed to render deploy script'
    );
    throw new DeployScriptError(
      `Failed to render deploy script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Count deploy scripts by user
 */
export async function countDeployScriptsByUser(userId: number): Promise<number> {
  try {
    return await prisma.deployScript.count({
      where: { userId },
    });
  } catch (error) {
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      'Failed to count deploy scripts'
    );
    throw new DeployScriptError(
      `Failed to count deploy scripts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Search deploy scripts by name
 */
export async function searchDeployScripts(query: string, userId?: number): Promise<DeployScriptResponse[]> {
  try {
    const scripts = await prisma.deployScript.findMany({
      where: {
        AND: [
          userId ? { userId } : {},
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { notes: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return scripts.map(formatDeployScript);
  } catch (error) {
    globalLogger.error(
      { error: error instanceof Error ? error.message : String(error), query },
      'Failed to search deploy scripts'
    );
    throw new DeployScriptError(
      `Failed to search deploy scripts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Format deploy script for API response
 */
function formatDeployScript(script: any): DeployScriptResponse {
  return {
    id: script.id,
    name: script.name,
    script: script.script,
    notes: script.notes,
    userId: script.userId,
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
  };
}
