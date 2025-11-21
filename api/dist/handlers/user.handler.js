"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersHandler = getUsersHandler;
exports.createUserHandler = createUserHandler;
const user_service_1 = require("../services/user.service");
const console_1 = require("console");
async function getUsersHandler(request, reply) {
    try {
        reply.send(await (0, user_service_1.getAllUserNames)());
    }
    catch (error) {
        reply.status(500).send({ error: 'An error occurred' });
    }
}
async function createUserHandler(request, reply) {
    try {
        const { name, email, password } = request.body;
        const user = await (0, user_service_1.createUser)(name, email, password);
        reply.status(201).send(user);
    }
    catch (error) {
        if (error instanceof user_service_1.UserExistsError) {
            reply.conflict(error.message);
            return;
        }
        (0, console_1.log)(error);
        reply.status(500).send({ error: 'An error occurred' });
    }
}
