"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginHandler = loginHandler;
exports.logoutHandler = logoutHandler;
exports.refreshHandler = refreshHandler;
exports.getMeHandler = getMeHandler;
exports.resetRequestHandler = resetRequestHandler;
exports.resetConfirmHandler = resetConfirmHandler;
const auth_service_1 = require("../services/auth.service");
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Handles user login
 * POST /api/auth/login
 *
 * @param request - Fastify request with email and password
 * @param reply - Fastify reply
 * @returns Access token, refresh token, and user info
 */
async function loginHandler(request, reply) {
    try {
        const { email, password } = request.body;
        request.log.info({ email }, 'Login attempt');
        const loginResponse = await (0, auth_service_1.login)(email, password);
        request.log.info({ userId: loginResponse.user.id }, 'Login successful');
        return reply.status(200).send({
            accessToken: loginResponse.accessToken,
            refreshToken: loginResponse.refreshToken,
            user: {
                id: loginResponse.user.id,
                email: loginResponse.user.email,
                name: loginResponse.user.name,
                roles: [], // TODO: Add roles from user
            },
        });
    }
    catch (error) {
        if (error instanceof auth_service_1.InvalidCredentialsError) {
            request.log.warn({ email: request.body.email }, 'Invalid credentials');
            return reply.status(401).send({
                error: 'Unauthorized',
                message: error.message,
            });
        }
        if (error instanceof auth_service_1.InactiveUserError) {
            request.log.warn({ email: request.body.email }, 'Inactive user account');
            return reply.status(401).send({
                error: 'Unauthorized',
                message: error.message,
            });
        }
        request.log.error({ error }, 'Login error');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred during login',
        });
    }
}
/**
 * Handles user logout
 * POST /api/auth/logout
 *
 * @param request - Fastify request with refresh token
 * @param reply - Fastify reply
 * @returns Success message
 */
async function logoutHandler(request, reply) {
    try {
        const { refreshToken } = request.body;
        await (0, auth_service_1.logout)(refreshToken);
        request.log.info('User logged out');
        return reply.status(200).send({
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        request.log.error({ error }, 'Logout error');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred during logout',
        });
    }
}
/**
 * Handles token refresh
 * POST /api/auth/refresh
 *
 * @param request - Fastify request with refresh token
 * @param reply - Fastify reply
 * @returns New access token
 */
async function refreshHandler(request, reply) {
    try {
        const { refreshToken } = request.body;
        const accessToken = await (0, auth_service_1.refreshAccessToken)(refreshToken);
        request.log.info('Token refreshed');
        return reply.status(200).send({
            accessToken,
        });
    }
    catch (error) {
        if (error instanceof auth_service_1.TokenBlacklistedError) {
            request.log.warn('Attempted to use blacklisted token');
            return reply.status(401).send({
                error: 'Unauthorized',
                message: error.message,
            });
        }
        if (error instanceof auth_service_1.InvalidCredentialsError) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: error.message,
            });
        }
        if (error instanceof auth_service_1.InactiveUserError) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: error.message,
            });
        }
        request.log.error({ error }, 'Token refresh error');
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired refresh token',
        });
    }
}
/**
 * Gets current user information
 * GET /api/auth/me
 * Requires authentication
 *
 * @param request - Authenticated Fastify request
 * @param reply - Fastify reply
 * @returns User information with roles
 */
async function getMeHandler(request, reply) {
    try {
        if (!request.user) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }
        // Fetch full user data from database
        const user = await prisma_1.default.user.findUnique({
            where: { id: request.user.id },
            include: { roles: true },
        });
        if (!user) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'User not found',
            });
        }
        return reply.status(200).send({
            id: user.id,
            email: user.email,
            name: user.name,
            active: user.active,
            confirmedAt: user.confirmedAt?.toISOString() || null,
            createdAt: user.createdAt.toISOString(),
            roles: user.roles.map((role) => role.name),
        });
    }
    catch (error) {
        request.log.error({ error }, 'Error fetching user info');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred fetching user info',
        });
    }
}
/**
 * Requests a password reset
 * POST /api/auth/reset-request
 *
 * @param request - Fastify request with email
 * @param reply - Fastify reply
 * @returns Success message (always returns 200 to prevent user enumeration)
 */
async function resetRequestHandler(request, reply) {
    try {
        const { email } = request.body;
        request.log.info({ email }, 'Password reset requested');
        // Find user by email
        const user = await prisma_1.default.user.findUnique({
            where: { email },
        });
        // If user exists, create reset token
        if (user) {
            // Generate random 40-character token
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const resetToken = crypto.randomBytes(20).toString('hex');
            // Calculate expiration (24 hours from now)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            // Deactivate any existing reset tokens for this user
            await prisma_1.default.passwdReset.updateMany({
                where: {
                    userId: user.id,
                    active: true,
                },
                data: {
                    active: false,
                },
            });
            // Create new reset token
            await prisma_1.default.passwdReset.create({
                data: {
                    hashStr: resetToken,
                    userId: user.id,
                    expiresAt,
                },
            });
            request.log.info({ userId: user.id }, 'Password reset token created');
            // TODO: Send email with reset link
            // In production, this would send an email like:
            // https://your-domain.com/reset-password?token=RESET_TOKEN
            request.log.warn({ resetToken }, 'Email sending not implemented - reset token logged');
        }
        else {
            // Don't reveal that user doesn't exist (security best practice)
            request.log.info({ email }, 'Password reset requested for unknown email');
        }
        // Always return success to prevent user enumeration
        return reply.status(200).send({
            message: 'If an account exists with that email, a password reset link has been sent',
        });
    }
    catch (error) {
        request.log.error({ error }, 'Password reset request error');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred processing password reset request',
        });
    }
}
/**
 * Confirms password reset with token
 * POST /api/auth/reset-confirm
 *
 * @param request - Fastify request with token and new password
 * @param reply - Fastify reply
 * @returns Success message
 */
async function resetConfirmHandler(request, reply) {
    try {
        const { token, newPassword } = request.body;
        request.log.info('Password reset confirmation attempt');
        // Find active reset token
        const resetRecord = await prisma_1.default.passwdReset.findFirst({
            where: {
                hashStr: token,
                active: true,
            },
            include: {
                user: true,
            },
        });
        if (!resetRecord) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Invalid or expired reset token',
            });
        }
        // Check if token has expired
        if (resetRecord.expiresAt < new Date()) {
            // Deactivate expired token
            await prisma_1.default.passwdReset.update({
                where: { id: resetRecord.id },
                data: { active: false },
            });
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Reset token has expired',
            });
        }
        // Hash the new password
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update user's password
        await prisma_1.default.user.update({
            where: { id: resetRecord.userId },
            data: { password: hashedPassword },
        });
        // Deactivate the reset token
        await prisma_1.default.passwdReset.update({
            where: { id: resetRecord.id },
            data: { active: false },
        });
        request.log.info({ userId: resetRecord.userId }, 'Password reset successful');
        return reply.status(200).send({
            message: 'Password has been reset successfully',
        });
    }
    catch (error) {
        request.log.error({ error }, 'Password reset confirmation error');
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'An error occurred resetting password',
        });
    }
}
