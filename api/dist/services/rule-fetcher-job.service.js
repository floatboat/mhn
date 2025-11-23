"use strict";
/**
 * Rule Fetcher Job Service - Orchestrate rule downloading, parsing, and importing
 * Manages RuleFetchJob records, retry logic, and scheduling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchJobError = void 0;
exports.createFetchJob = createFetchJob;
exports.getFetchJob = getFetchJob;
exports.listFetchJobs = listFetchJobs;
exports.getLatestFetchJob = getLatestFetchJob;
exports.shouldRetryJob = shouldRetryJob;
exports.calculateRetryDelay = calculateRetryDelay;
exports.scheduleRetry = scheduleRetry;
exports.executeFetchJob = executeFetchJob;
exports.getFetchJobStats = getFetchJobStats;
exports.getPendingRetries = getPendingRetries;
exports.processFailedRetries = processFailedRetries;
exports.cancelFetchJob = cancelFetchJob;
const prisma_1 = require("../lib/prisma");
const rule_fetcher_1 = require("../lib/rule-fetcher");
const rule_importer_service_1 = require("./rule-importer.service");
/**
 * Custom error for fetch job operations
 */
class FetchJobError extends Error {
    constructor(message, jobId) {
        super(message);
        this.jobId = jobId;
        this.statusCode = 500;
        this.name = 'FetchJobError';
    }
}
exports.FetchJobError = FetchJobError;
/**
 * Create a new fetch job for a rule source
 */
async function createFetchJob(sourceId) {
    const job = await prisma_1.prisma.ruleFetchJob.create({
        data: {
            sourceId,
            status: 'pending',
        },
    });
    return job.id;
}
/**
 * Get fetch job details
 */
async function getFetchJob(jobId) {
    const job = await prisma_1.prisma.ruleFetchJob.findUnique({
        where: { id: jobId },
        include: {
            source: true,
        },
    });
    if (!job) {
        throw new FetchJobError(`Fetch job not found: ${jobId}`, jobId);
    }
    return job;
}
/**
 * List fetch jobs for a source with filtering
 */
async function listFetchJobs(sourceId, limit = 50, offset = 0) {
    const [jobs, total] = await Promise.all([
        prisma_1.prisma.ruleFetchJob.findMany({
            where: { sourceId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma_1.prisma.ruleFetchJob.count({
            where: { sourceId },
        }),
    ]);
    return { jobs, total };
}
/**
 * Get latest fetch job for a source
 */
async function getLatestFetchJob(sourceId) {
    return prisma_1.prisma.ruleFetchJob.findFirst({
        where: { sourceId },
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Update job status and metrics
 */
async function updateJobStatus(jobId, status, metrics = {}) {
    await prisma_1.prisma.ruleFetchJob.update({
        where: { id: jobId },
        data: {
            status,
            ...metrics,
        },
    });
}
/**
 * Determine if a fetch job should be retried
 */
function shouldRetryJob(job) {
    if (job.status === 'success' || job.status === 'partial_success') {
        return false;
    }
    const maxAttempts = 5;
    if (job.attemptCount >= maxAttempts) {
        return false;
    }
    // Don't retry if it hasn't been long enough
    if (job.nextRetryAt && job.nextRetryAt > new Date()) {
        return false;
    }
    return true;
}
/**
 * Calculate exponential backoff delay for retry
 */
function calculateRetryDelay(attemptCount, baseDelayMs = 60000) {
    // Start at 1 minute, double each time: 1min, 2min, 4min, 8min, 16min
    return baseDelayMs * Math.pow(2, Math.min(attemptCount, 4));
}
/**
 * Schedule retry for failed job
 */
async function scheduleRetry(jobId) {
    const job = await getFetchJob(jobId);
    if (!shouldRetryJob(job)) {
        return;
    }
    const delayMs = calculateRetryDelay(job.attemptCount);
    const nextRetryAt = new Date(Date.now() + delayMs);
    await prisma_1.prisma.ruleFetchJob.update({
        where: { id: jobId },
        data: {
            nextRetryAt,
            attemptCount: job.attemptCount + 1,
        },
    });
}
/**
 * Execute a complete fetch job (download + import)
 * This is the main orchestration function
 */
async function executeFetchJob(jobId) {
    const startTime = new Date();
    const job = await getFetchJob(jobId);
    try {
        // Mark as in progress
        await updateJobStatus(jobId, 'in_progress');
        // Get rule source
        const source = await prisma_1.prisma.ruleSource.findUnique({
            where: { id: job.sourceId },
        });
        if (!source) {
            throw new FetchJobError(`Rule source not found: ${job.sourceId}`);
        }
        // Build config for downloader
        const config = {
            uri: source.uri,
            timeout: 30000,
            maxRetries: 3,
            backoffMultiplierMs: 1000,
        };
        // Download rule file
        let downloadedAt;
        let content;
        try {
            const fetched = await (0, rule_fetcher_1.downloadRuleFile)(config);
            content = fetched.content;
            downloadedAt = fetched.downloadedAt;
        }
        catch (downloadError) {
            const errorMsg = downloadError instanceof Error ? downloadError.message : String(downloadError);
            await updateJobStatus(jobId, 'failed', {
                errorMessage: `Download failed: ${errorMsg}`,
                completedAt: new Date(),
            });
            // Schedule retry
            await scheduleRetry(jobId);
            throw downloadError;
        }
        // Import rules from downloaded content
        let importResult;
        try {
            importResult = await (0, rule_importer_service_1.importRulesFromText)(content, {
                sourceId: job.sourceId,
                skipIfExist: false,
                autoActivate: true,
            });
        }
        catch (importError) {
            const errorMsg = importError instanceof Error ? importError.message : String(importError);
            await updateJobStatus(jobId, 'failed', {
                rulesImported: 0,
                rulesFailed: 0,
                rulesSkipped: 0,
                errorMessage: `Import failed: ${errorMsg}`,
                completedAt: new Date(),
            });
            // Schedule retry
            await scheduleRetry(jobId);
            throw importError;
        }
        // Determine final status
        const finalStatus = importResult.failed.length === 0 ? 'success' : 'partial_success';
        // Update job with final metrics
        await updateJobStatus(jobId, finalStatus, {
            rulesImported: importResult.imported,
            rulesFailed: importResult.failed.length,
            rulesSkipped: importResult.skipped,
            completedAt: new Date(),
        });
        return {
            jobId,
            sourceId: job.sourceId,
            status: finalStatus,
            rulesImported: importResult.imported,
            rulesFailed: importResult.failed.length,
            rulesSkipped: importResult.skipped,
            totalRules: importResult.totalRules,
            downloadedAt,
            importResult,
            startedAt: startTime,
            completedAt: new Date(),
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Make sure we mark as failed if not already
        const currentJob = await getFetchJob(jobId);
        if (currentJob.status === 'in_progress') {
            await updateJobStatus(jobId, 'failed', {
                errorMessage: errorMsg,
                completedAt: new Date(),
            });
        }
        // If this is a retryable error, schedule retry
        if (error instanceof rule_fetcher_1.RuleFetchError ||
            error instanceof rule_fetcher_1.AuthenticationError ||
            error instanceof Error) {
            await scheduleRetry(jobId);
        }
        throw new FetchJobError(`Job execution failed: ${errorMsg}`, jobId);
    }
}
/**
 * Get summary statistics for fetch jobs
 */
async function getFetchJobStats(sourceId) {
    const where = sourceId ? { sourceId } : {};
    const [totalJobs, successfulJobs, failedJobs, partialSuccessJobs, pendingJobs, inProgressJobs, totalRulesImported, totalRulesFailed,] = await Promise.all([
        prisma_1.prisma.ruleFetchJob.count({ where }),
        prisma_1.prisma.ruleFetchJob.count({ where: { ...where, status: 'success' } }),
        prisma_1.prisma.ruleFetchJob.count({ where: { ...where, status: 'failed' } }),
        prisma_1.prisma.ruleFetchJob.count({ where: { ...where, status: 'partial_success' } }),
        prisma_1.prisma.ruleFetchJob.count({ where: { ...where, status: 'pending' } }),
        prisma_1.prisma.ruleFetchJob.count({ where: { ...where, status: 'in_progress' } }),
        prisma_1.prisma.ruleFetchJob.aggregate({
            where: { ...where, status: { in: ['success', 'partial_success'] } },
            _sum: { rulesImported: true },
        }),
        prisma_1.prisma.ruleFetchJob.aggregate({
            where,
            _sum: { rulesFailed: true },
        }),
    ]);
    return {
        totalJobs,
        successfulJobs,
        failedJobs,
        partialSuccessJobs,
        pendingJobs,
        inProgressJobs,
        totalRulesImported: totalRulesImported._sum.rulesImported || 0,
        totalRulesFailed: totalRulesFailed._sum.rulesFailed || 0,
        successRate: totalJobs > 0 ? ((successfulJobs + partialSuccessJobs) / totalJobs) * 100 : 0,
    };
}
/**
 * Get jobs that need to be retried
 */
async function getPendingRetries(limit = 10) {
    return prisma_1.prisma.ruleFetchJob.findMany({
        where: {
            status: 'failed',
            nextRetryAt: {
                lte: new Date(),
            },
            attemptCount: {
                lt: 5,
            },
        },
        orderBy: { nextRetryAt: 'asc' },
        take: limit,
    });
}
/**
 * Retry failed fetch jobs that are due for retry
 */
async function processFailedRetries() {
    const jobs = await getPendingRetries();
    const results = [];
    for (const job of jobs) {
        try {
            const result = await executeFetchJob(job.id);
            results.push(result);
        }
        catch (error) {
            // Continue processing other jobs even if one fails
            console.error(`Failed to retry job ${job.id}:`, error);
        }
    }
    return results;
}
/**
 * Cancel a pending or in-progress fetch job
 */
async function cancelFetchJob(jobId) {
    const job = await getFetchJob(jobId);
    if (job.status === 'success' || job.status === 'failed' || job.status === 'partial_success') {
        throw new FetchJobError(`Cannot cancel completed job: ${jobId}`);
    }
    await updateJobStatus(jobId, 'failed', {
        errorMessage: 'Job cancelled by user',
        completedAt: new Date(),
    });
}
