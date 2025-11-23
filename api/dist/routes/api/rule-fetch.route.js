"use strict";
/**
 * Rule Fetch API Routes - Manual fetch triggers and status monitoring
 * Endpoints for managing rule fetching jobs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ruleFetchRoutes;
const rule_fetcher_job_service_1 = require("../../services/rule-fetcher-job.service");
const rule_fetch_types_1 = require("../../types/rule-fetch.types");
async function ruleFetchRoutes(fastify) {
    /**
     * POST /api/rule-fetch/:sourceId
     * Manually trigger a fetch job for a rule source
     */
    fastify.post('/rule-fetch/:sourceId', {
        schema: {
            params: {
                type: 'object',
                required: ['sourceId'],
                properties: {
                    sourceId: {
                        type: 'string',
                        description: 'Rule source ID',
                    },
                },
            },
            response: {
                201: rule_fetch_types_1.FetchJobResultSchema,
            },
        },
    }, async (request, reply) => {
        const { sourceId } = request.params;
        const sourceIdNum = parseInt(sourceId);
        if (isNaN(sourceIdNum)) {
            return reply.code(400).send({ message: 'Invalid source ID' });
        }
        try {
            // Create fetch job
            const jobId = await (0, rule_fetcher_job_service_1.createFetchJob)(sourceIdNum);
            // Execute immediately
            const result = await (0, rule_fetcher_job_service_1.executeFetchJob)(jobId);
            return reply.code(201).send({
                jobId: result.jobId,
                sourceId: result.sourceId,
                status: result.status,
                rulesImported: result.rulesImported,
                rulesFailed: result.rulesFailed,
                rulesSkipped: result.rulesSkipped,
                totalRules: result.totalRules,
                errorMessage: result.errorMessage,
                startedAt: result.startedAt.toISOString(),
                completedAt: result.completedAt.toISOString(),
                downloadedAt: result.downloadedAt?.toISOString(),
            });
        }
        catch (error) {
            fastify.log.error(error, 'Failed to execute fetch job');
            const message = error instanceof Error ? error.message : 'Failed to fetch rules';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/rule-fetch/:sourceId
     * List fetch jobs for a source
     */
    fastify.get('/rule-fetch/:sourceId', {
        schema: {
            params: {
                type: 'object',
                required: ['sourceId'],
                properties: {
                    sourceId: {
                        type: 'string',
                        description: 'Rule source ID',
                    },
                },
            },
            querystring: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'string',
                        description: 'Number of jobs to return (default: 50)',
                    },
                    offset: {
                        type: 'string',
                        description: 'Number of jobs to skip (default: 0)',
                    },
                },
            },
            response: {
                200: rule_fetch_types_1.FetchJobListSchema,
            },
        },
    }, async (request, reply) => {
        const { sourceId } = request.params;
        const sourceIdNum = parseInt(sourceId);
        if (isNaN(sourceIdNum)) {
            return reply.code(400).send({ message: 'Invalid source ID' });
        }
        const limit = parseInt(request.query.limit || '50');
        const offset = parseInt(request.query.offset || '0');
        try {
            const { jobs, total } = await (0, rule_fetcher_job_service_1.listFetchJobs)(sourceIdNum, limit, offset);
            return reply.code(200).send({
                jobs: jobs.map(job => ({
                    id: job.id,
                    sourceId: job.sourceId,
                    status: job.status,
                    rulesImported: job.rulesImported,
                    rulesFailed: job.rulesFailed,
                    rulesSkipped: job.rulesSkipped,
                    errorMessage: job.errorMessage,
                    startedAt: job.startedAt?.toISOString(),
                    completedAt: job.completedAt?.toISOString(),
                    lastAttempt: job.lastAttempt.toISOString(),
                    attemptCount: job.attemptCount,
                    nextRetryAt: job.nextRetryAt?.toISOString(),
                    createdAt: job.createdAt.toISOString(),
                })),
                total,
                limit,
                offset,
            });
        }
        catch (error) {
            fastify.log.error(error, 'Failed to list fetch jobs');
            const message = error instanceof Error ? error.message : 'Failed to list fetch jobs';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/rule-fetch/:sourceId/:jobId
     * Get details of a specific fetch job
     */
    fastify.get('/rule-fetch/:sourceId/:jobId', {
        schema: {
            params: {
                type: 'object',
                required: ['sourceId', 'jobId'],
                properties: {
                    sourceId: {
                        type: 'string',
                        description: 'Rule source ID',
                    },
                    jobId: {
                        type: 'string',
                        description: 'Fetch job ID',
                    },
                },
            },
            response: {
                200: rule_fetch_types_1.FetchJobResultSchema,
            },
        },
    }, async (request, reply) => {
        const { jobId } = request.params;
        const jobIdNum = parseInt(jobId);
        if (isNaN(jobIdNum)) {
            return reply.code(400).send({ message: 'Invalid job ID' });
        }
        try {
            const job = await (0, rule_fetcher_job_service_1.getFetchJob)(jobIdNum);
            return reply.code(200).send({
                jobId: job.id,
                sourceId: job.sourceId,
                status: job.status,
                rulesImported: job.rulesImported,
                rulesFailed: job.rulesFailed,
                rulesSkipped: job.rulesSkipped,
                errorMessage: job.errorMessage,
                startedAt: job.startedAt?.toISOString(),
                completedAt: job.completedAt?.toISOString(),
                lastAttempt: job.lastAttempt.toISOString(),
                attemptCount: job.attemptCount,
                nextRetryAt: job.nextRetryAt?.toISOString(),
                createdAt: job.createdAt.toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return reply.code(404).send({ message: 'Fetch job not found' });
            }
            fastify.log.error(error, 'Failed to get fetch job');
            const message = error instanceof Error ? error.message : 'Failed to get fetch job';
            return reply.code(500).send({ message });
        }
    });
    /**
     * DELETE /api/rule-fetch/:jobId
     * Cancel a pending or in-progress fetch job
     */
    fastify.delete('/rule-fetch/:jobId', {
        schema: {
            params: {
                type: 'object',
                required: ['jobId'],
                properties: {
                    jobId: {
                        type: 'string',
                        description: 'Fetch job ID',
                    },
                },
            },
            response: {
                204: {
                    description: 'Job cancelled successfully',
                },
            },
        },
    }, async (request, reply) => {
        const { jobId } = request.params;
        const jobIdNum = parseInt(jobId);
        if (isNaN(jobIdNum)) {
            return reply.code(400).send({ message: 'Invalid job ID' });
        }
        try {
            await (0, rule_fetcher_job_service_1.cancelFetchJob)(jobIdNum);
            return reply.code(204).send();
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return reply.code(404).send({ message: 'Fetch job not found' });
            }
            if (error instanceof Error && error.message.includes('Cannot cancel')) {
                return reply.code(409).send({ message: error.message });
            }
            fastify.log.error(error, 'Failed to cancel fetch job');
            const message = error instanceof Error ? error.message : 'Failed to cancel fetch job';
            return reply.code(500).send({ message });
        }
    });
    /**
     * GET /api/rule-fetch/stats
     * Get statistics about fetch jobs
     */
    fastify.get('/rule-fetch-stats', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    sourceId: {
                        type: 'string',
                        description: 'Optional: Filter stats by rule source ID',
                    },
                },
            },
            response: {
                200: rule_fetch_types_1.FetchJobStatsSchema,
            },
        },
    }, async (request, reply) => {
        const { sourceId } = request.query;
        const sourceIdNum = sourceId ? parseInt(sourceId) : undefined;
        if (sourceId && isNaN(sourceIdNum)) {
            return reply.code(400).send({ message: 'Invalid source ID' });
        }
        try {
            const stats = await (0, rule_fetcher_job_service_1.getFetchJobStats)(sourceIdNum);
            return reply.code(200).send({
                totalJobs: stats.totalJobs,
                successfulJobs: stats.successfulJobs,
                failedJobs: stats.failedJobs,
                partialSuccessJobs: stats.partialSuccessJobs,
                pendingJobs: stats.pendingJobs,
                inProgressJobs: stats.inProgressJobs,
                totalRulesImported: stats.totalRulesImported,
                totalRulesFailed: stats.totalRulesFailed,
                successRate: parseFloat(stats.successRate.toFixed(2)),
            });
        }
        catch (error) {
            fastify.log.error(error, 'Failed to get fetch job stats');
            const message = error instanceof Error ? error.message : 'Failed to get stats';
            return reply.code(500).send({ message });
        }
    });
}
