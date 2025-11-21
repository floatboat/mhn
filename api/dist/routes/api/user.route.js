"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userRoutes;
const user_handler_1 = require("../../handlers/user.handler");
const user_types_1 = require("../../types/user.types");
async function userRoutes(fastify) {
    fastify.route({
        method: 'GET',
        url: '/user',
        handler: user_handler_1.getUsersHandler,
    });
    fastify.route({
        method: 'POST',
        url: '/user',
        schema: user_types_1.createUserSchema,
        handler: user_handler_1.createUserHandler,
    });
}
