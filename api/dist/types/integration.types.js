"use strict";
/**
 * Integration Type Definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAlertSchema = exports.updateAlertSchema = exports.alertConfigSchema = exports.toggleIntegrationSchema = exports.configureIntegrationSchema = exports.integrationConfigSchema = void 0;
exports.integrationConfigSchema = {
    email: {
        type: 'object',
        properties: {
            provider: { type: 'string', enum: ['smtp', 'sendgrid', 'mailgun'] },
            smtpHost: { type: 'string' },
            smtpPort: { type: 'number' },
            smtpUsername: { type: 'string' },
            smtpPassword: { type: 'string' },
            sendgridApiKey: { type: 'string' },
            mailgunApiKey: { type: 'string' },
            mailgunDomain: { type: 'string' },
            fromEmail: { type: 'string', format: 'email' },
        },
    },
    splunk: {
        type: 'object',
        properties: {
            splunkHost: { type: 'string' },
            splunkPort: { type: 'number' },
            splunkToken: { type: 'string' },
            splunkIndex: { type: 'string' },
            verifySsl: { type: 'boolean' },
        },
        required: ['splunkHost', 'splunkPort', 'splunkToken'],
    },
    arcsight: {
        type: 'object',
        properties: {
            arcsightHost: { type: 'string' },
            arcsightPort: { type: 'number' },
            arcsightProtocol: { type: 'string', enum: ['udp', 'tcp'] },
        },
        required: ['arcsightHost', 'arcsightPort', 'arcsightProtocol'],
    },
    elasticsearch: {
        type: 'object',
        properties: {
            elasticsearchHost: { type: 'string' },
            elasticsearchPort: { type: 'number' },
            elasticsearchUsername: { type: 'string' },
            elasticsearchPassword: { type: 'string' },
            elasticsearchIndex: { type: 'string' },
            verifySslEls: { type: 'boolean' },
        },
        required: ['elasticsearchHost', 'elasticsearchPort'],
    },
    hpfeeds: {
        type: 'object',
        properties: {
            hpfeedsHost: { type: 'string' },
            hpfeedsPort: { type: 'number' },
            hpfeedsIdentifier: { type: 'string' },
            hpfeedsSecret: { type: 'string' },
            hpfeedsChannel: { type: 'string' },
        },
        required: ['hpfeedsHost', 'hpfeedsPort', 'hpfeedsIdentifier', 'hpfeedsSecret'],
    },
};
exports.configureIntegrationSchema = {
    params: {
        type: 'object',
        required: ['type'],
        properties: {
            type: {
                type: 'string',
                enum: ['email', 'splunk', 'arcsight', 'elasticsearch', 'hpfeeds'],
            },
        },
    },
    body: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            // Email config
            provider: { type: 'string', enum: ['smtp', 'sendgrid', 'mailgun'] },
            smtpHost: { type: 'string' },
            smtpPort: { type: 'number' },
            smtpUsername: { type: 'string' },
            smtpPassword: { type: 'string' },
            sendgridApiKey: { type: 'string' },
            mailgunApiKey: { type: 'string' },
            mailgunDomain: { type: 'string' },
            fromEmail: { type: 'string' },
            // Splunk config
            splunkHost: { type: 'string' },
            splunkPort: { type: 'number' },
            splunkToken: { type: 'string' },
            splunkIndex: { type: 'string' },
            verifySsl: { type: 'boolean' },
            // ArcSight config
            arcsightHost: { type: 'string' },
            arcsightPort: { type: 'number' },
            arcsightProtocol: { type: 'string' },
            // Elasticsearch config
            elasticsearchHost: { type: 'string' },
            elasticsearchPort: { type: 'number' },
            elasticsearchUsername: { type: 'string' },
            elasticsearchPassword: { type: 'string' },
            elasticsearchIndex: { type: 'string' },
            verifySslEls: { type: 'boolean' },
            // HPFeeds config
            hpfeedsHost: { type: 'string' },
            hpfeedsPort: { type: 'number' },
            hpfeedsIdentifier: { type: 'string' },
            hpfeedsSecret: { type: 'string' },
            hpfeedsChannel: { type: 'string' },
        },
    },
};
exports.toggleIntegrationSchema = {
    params: {
        type: 'object',
        required: ['type'],
        properties: {
            type: {
                type: 'string',
                enum: ['email', 'splunk', 'arcsight', 'elasticsearch', 'hpfeeds'],
            },
        },
    },
    body: {
        type: 'object',
        required: ['enabled'],
        properties: {
            enabled: { type: 'boolean' },
        },
    },
};
exports.alertConfigSchema = {
    type: 'object',
    required: ['type', 'threshold', 'timeWindow'],
    properties: {
        type: {
            type: 'string',
            enum: ['ddos', 'port_scan', 'high_severity', 'custom'],
        },
        name: { type: 'string' },
        description: { type: 'string' },
        threshold: {
            type: 'number',
            minimum: 1,
            description: 'Number of events to trigger alert',
        },
        timeWindow: {
            type: 'number',
            minimum: 1,
            description: 'Time window in seconds',
        },
        sendEmail: { type: 'boolean' },
        emailAddresses: {
            type: 'array',
            items: { type: 'string', format: 'email' },
        },
    },
};
exports.updateAlertSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string' },
        },
    },
    body: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            threshold: { type: 'number', minimum: 1 },
            timeWindow: { type: 'number', minimum: 1 },
            sendEmail: { type: 'boolean' },
            emailAddresses: {
                type: 'array',
                items: { type: 'string' },
            },
        },
    },
};
exports.toggleAlertSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string' },
        },
    },
    body: {
        type: 'object',
        required: ['enabled'],
        properties: {
            enabled: { type: 'boolean' },
        },
    },
};
