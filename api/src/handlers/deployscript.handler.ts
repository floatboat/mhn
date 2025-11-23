/**
 * Deploy Script Request Handlers
 * HTTP request handling for deploy script CRUD operations
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createDeployScript,
  getDeployScriptById,
  listDeployScripts,
  updateDeployScript,
  deleteDeployScript,
  getDeployScriptRendered,
  searchDeployScripts,
  DeployScriptError,
  DeployScriptNotFoundError,
} from '../services/deployscript.service';

/**
 * Create a new deploy script
 * POST /api/deployscript
 */
export async function createDeployScriptHandler(
  request: FastifyRequest<{
    Body: {
      name: string;
      script: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const { name, script, notes } = request.body;

  try {
    const result = await createDeployScript({
      name,
      script,
      notes,
      userId: request.user.id,
    });

    reply.code(201).send(result);
  } catch (error) {
    if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}

/**
 * List deploy scripts
 * GET /api/deployscript
 */
export async function listDeployScriptsHandler(
  request: FastifyRequest<{
    Querystring: {
      userId?: string;
      search?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const userId = request.query.userId ? parseInt(request.query.userId, 10) : undefined;
    const search = request.query.search;

    // If search query provided, use search function
    if (search) {
      const results = await searchDeployScripts(search, userId);
      reply.send(results);
      return;
    }

    // Otherwise return all scripts for user (or all if admin)
    const scripts = await listDeployScripts(userId);
    reply.send(scripts);
  } catch (error) {
    if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}

/**
 * Get single deploy script
 * GET /api/deployscript/:id
 */
export async function getDeployScriptHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const id = parseInt(request.params.id, 10);

  if (isNaN(id)) {
    reply.code(400).send({ message: 'Invalid script ID' });
    return;
  }

  try {
    const script = await getDeployScriptById(id);
    reply.send(script);
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      reply.code(404).send({ message: error.message });
    } else if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}

/**
 * Get deploy script with rendered variables
 * GET /api/deployscript/:id/render
 */
export async function getDeployScriptRenderedHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
    Body: {
      variables?: Record<string, string>;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const id = parseInt(request.params.id, 10);

  if (isNaN(id)) {
    reply.code(400).send({ message: 'Invalid script ID' });
    return;
  }

  try {
    const variables = request.body?.variables || {};
    const rendered = await getDeployScriptRendered(id, variables);

    // Return as plain text
    reply.type('text/plain').send(rendered);
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      reply.code(404).send({ message: error.message });
    } else if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}

/**
 * Update deploy script
 * PUT /api/deployscript/:id
 */
export async function updateDeployScriptHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
    Body: {
      name?: string;
      script?: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const id = parseInt(request.params.id, 10);

  if (isNaN(id)) {
    reply.code(400).send({ message: 'Invalid script ID' });
    return;
  }

  try {
    const updated = await updateDeployScript(id, request.body);
    reply.send(updated);
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      reply.code(404).send({ message: error.message });
    } else if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}

/**
 * Delete deploy script
 * DELETE /api/deployscript/:id
 */
export async function deleteDeployScriptHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const id = parseInt(request.params.id, 10);

  if (isNaN(id)) {
    reply.code(400).send({ message: 'Invalid script ID' });
    return;
  }

  try {
    await deleteDeployScript(id);
    reply.code(204).send();
  } catch (error) {
    if (error instanceof DeployScriptNotFoundError) {
      reply.code(404).send({ message: error.message });
    } else if (error instanceof DeployScriptError) {
      reply.code(error.statusCode).send({ message: error.message });
    } else {
      reply.code(500).send({ message: 'Internal server error' });
    }
  }
}
