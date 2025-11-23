"use strict";
/**
 * Type definitions and schemas for Rule Fetch API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFetchJobSchema = exports.FetchJobStatsSchema = exports.FetchJobListSchema = exports.FetchJobResultSchema = void 0;
exports.FetchJobResultSchema = {
    type: 'object',
    properties: {
        jobId: { type: 'number', description: 'Fetch job ID' },
        sourceId: { type: 'number', description: 'Rule source ID' },
        status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'success', 'failed', 'partial_success'],
            description: 'Job status',
        },
        rulesImported: { type: 'number', description: 'Number of rules imported' },
        rulesFailed: { type: 'number', description: 'Number of rules that failed to parse' },
        rulesSkipped: { type: 'number', description: 'Number of rules skipped (duplicates, older versions)' },
        totalRules: { type: 'number', description: 'Total rules in downloaded file' },
        errorMessage: { type: ['string', 'null'], description: 'Error message if failed' },
        startedAt: { type: 'string', format: 'date-time', description: 'Job start time' },
        completedAt: { type: 'string', format: 'date-time', description: 'Job completion time' },
        downloadedAt: {
            type: ['string', 'null'],
            format: 'date-time',
            description: 'When file was downloaded',
        },
    },
    required: [
        'jobId',
        'sourceId',
        'status',
        'rulesImported',
        'rulesFailed',
        'rulesSkipped',
        'totalRules',
        'startedAt',
        'completedAt',
    ],
};
exports.FetchJobListSchema = {
    type: 'object',
    properties: {
        jobs: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    sourceId: { type: 'number' },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'success', 'failed', 'partial_success'],
                    },
                    rulesImported: { type: 'number' },
                    rulesFailed: { type: 'number' },
                    rulesSkipped: { type: 'number' },
                    errorMessage: { type: ['string', 'null'] },
                    startedAt: { type: ['string', 'null'], format: 'date-time' },
                    completedAt: { type: ['string', 'null'], format: 'date-time' },
                    lastAttempt: { type: 'string', format: 'date-time' },
                    attemptCount: { type: 'number' },
                    nextRetryAt: { type: ['string', 'null'], format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
                required: [
                    'id',
                    'sourceId',
                    'status',
                    'rulesImported',
                    'rulesFailed',
                    'rulesSkipped',
                    'lastAttempt',
                    'attemptCount',
                    'createdAt',
                ],
            },
        },
        total: { type: 'number', description: 'Total number of jobs' },
        limit: { type: 'number', description: 'Limit parameter' },
        offset: { type: 'number', description: 'Offset parameter' },
    },
    required: ['jobs', 'total', 'limit', 'offset'],
};
exports.FetchJobStatsSchema = {
    type: 'object',
    properties: {
        totalJobs: { type: 'number', description: 'Total fetch jobs' },
        successfulJobs: { type: 'number', description: 'Jobs with status=success' },
        failedJobs: { type: 'number', description: 'Jobs with status=failed' },
        partialSuccessJobs: { type: 'number', description: 'Jobs with status=partial_success' },
        pendingJobs: { type: 'number', description: 'Jobs with status=pending' },
        inProgressJobs: { type: 'number', description: 'Jobs with status=in_progress' },
        totalRulesImported: { type: 'number', description: 'Sum of all imported rules' },
        totalRulesFailed: { type: 'number', description: 'Sum of all failed rules' },
        successRate: {
            type: 'number',
            description: 'Success rate as percentage (0-100)',
        },
    },
    required: [
        'totalJobs',
        'successfulJobs',
        'failedJobs',
        'partialSuccessJobs',
        'pendingJobs',
        'inProgressJobs',
        'totalRulesImported',
        'totalRulesFailed',
        'successRate',
    ],
};
exports.CreateFetchJobSchema = {
    type: 'object',
    properties: {
        sourceId: { type: 'number', description: 'Rule source ID' },
    },
    required: ['sourceId'],
};
