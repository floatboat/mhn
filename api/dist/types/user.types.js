"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSchema = void 0;
exports.createUserSchema = {
    body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
            name: {
                type: 'string',
                minLength: 3,
                pattern: '^[a-zA-Z0-9_]+$', // Only alphanumeric and underscore
            },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
        },
    },
};
