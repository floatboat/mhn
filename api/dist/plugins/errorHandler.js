"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
function customErrorMessage(error) {
    switch (error.keyword) {
        case 'required':
            return `${error.params.missingProperty} is required`;
        case 'pattern':
            return 'name must contain only letters, numbers, and underscores';
        case 'minLength':
            const propertyName = error.instancePath.split('/').pop();
            return `${propertyName} must be at least ${error.params.limit} characters`;
        case 'format':
            return 'must be a valid email address';
        default:
            return error.message;
    }
}
function errorHandler(fastify, opts, done) {
    // Log to verify plugin registration
    fastify.log.info('Registering custom error handler');
    fastify.setErrorHandler(function (error, request, reply) {
        fastify.log.error(error);
        if (error.validation) {
            return reply.status(400).send({
                error: 'Validation Error',
                details: error.validation.map((err) => ({
                    message: customErrorMessage(err),
                })),
            });
        }
        if (error.statusCode) {
            return reply.status(error.statusCode).send({ error: error.message });
        }
        return reply.status(500).send({ error: error.message });
    });
    done();
}
// Register as plugin with fastify-plugin to avoid encapsulation
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
exports.default = (0, fastify_plugin_1.default)(errorHandler);
