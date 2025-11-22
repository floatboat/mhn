"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = routes;
const sensible_1 = __importDefault(require("@fastify/sensible"));
const handlers_1 = require("../handlers/handlers");
const user_route_1 = __importDefault(require("./api/user.route"));
const auth_route_1 = __importDefault(require("./api/auth.route"));
const role_route_1 = __importDefault(require("./api/role.route"));
const apikey_route_1 = __importDefault(require("./api/apikey.route"));
const sensor_route_1 = __importDefault(require("./api/sensor.route"));
const attack_route_1 = __importDefault(require("./api/attack.route"));
const errorHandler_1 = __importDefault(require("../plugins/errorHandler"));
async function routes(fastify) {
    fastify.register(sensible_1.default);
    // Root routes
    fastify.route({
        method: 'GET',
        url: '/',
        handler: async function () {
            fastify.log.info('GET / route hit');
            return { root: true };
        },
    });
    fastify.route({
        method: 'GET',
        url: '/error',
        handler: async function () {
            throw new Error('Test error');
        },
    });
    fastify.route({
        method: 'GET',
        url: '/hello',
        handler: handlers_1.helloHandler,
    });
    // API routes with error handler
    await fastify.register(async (fastify) => {
        await fastify.register(errorHandler_1.default);
        await fastify.register(user_route_1.default);
        await fastify.register(auth_route_1.default);
        await fastify.register(role_route_1.default);
        await fastify.register(apikey_route_1.default);
        await fastify.register(sensor_route_1.default);
        await fastify.register(attack_route_1.default);
    });
}
