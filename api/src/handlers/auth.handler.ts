// src/handlers/auth.handler.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  login,
  logout,
  refreshAccessToken,
  InvalidCredentialsError,
  InactiveUserError,
  TokenBlacklistedError,
} from '../services/auth.service';
import {
  LoginRequestBody,
  RefreshRequestBody,
  ResetRequestBody,
  ResetConfirmBody,
} from '../types/auth.types';
import { AuthenticatedRequest } from '../decorators/auth.decorators';
import { prisma } from '../lib/prisma';

/**
 * Handles user login
 * POST /api/auth/login
 *
 * @param request - Fastify request with email and password
 * @param reply - Fastify reply
 * @returns Access token, refresh token, and user info
 */
export async function loginHandler(
  request: FastifyRequest<{ Body: LoginRequestBody }>,
  reply: FastifyReply,
) {
  try {
    const { email, password } = request.body;

    request.log.info({ email }, 'Login attempt');

    const loginResponse = await login(email, password);

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
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      request.log.warn({ email: request.body.email }, 'Invalid credentials');
      return reply.status(401).send({
        error: error.message,
      });
    }

    if (error instanceof InactiveUserError) {
      request.log.warn({ email: request.body.email }, 'Inactive user account');
      return reply.status(403).send({
        error: error.message,
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
export async function logoutHandler(
  request: FastifyRequest<{ Body: RefreshRequestBody }>,
  reply: FastifyReply,
) {
  try {
    const { refreshToken } = request.body;

    await logout(refreshToken);

    request.log.info('User logged out');

    return reply.status(200).send({
      message: 'Logged out successfully',
    });
  } catch (error) {
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
export async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshRequestBody }>,
  reply: FastifyReply,
) {
  try {
    const { refreshToken } = request.body;

    const accessToken = await refreshAccessToken(refreshToken);

    request.log.info('Token refreshed');

    return reply.status(200).send({
      accessToken,
    });
  } catch (error) {
    if (error instanceof TokenBlacklistedError) {
      request.log.warn('Attempted to use blacklisted token');
      return reply.status(401).send({
        error: 'Unauthorized',
        message: error.message,
      });
    }

    if (error instanceof InvalidCredentialsError) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: error.message,
      });
    }

    if (error instanceof InactiveUserError) {
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
export async function getMeHandler(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  try {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Fetch full user data from database
    const user = await prisma.user.findUnique({
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
      roles: user.roles.map((role: { name: string }) => role.name),
    });
  } catch (error) {
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
export async function resetRequestHandler(
  request: FastifyRequest<{ Body: ResetRequestBody }>,
  reply: FastifyReply,
) {
  try {
    const { email } = request.body;

    request.log.info({ email }, 'Password reset requested');

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // If user exists, create reset token
    if (user) {
      // Generate random 40-character token
      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(20).toString('hex');

      // Calculate expiration (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Deactivate any existing reset tokens for this user
      await prisma.passwdReset.updateMany({
        where: {
          userId: user.id,
          active: true,
        },
        data: {
          active: false,
        },
      });

      // Create new reset token
      await prisma.passwdReset.create({
        data: {
          hashStr: resetToken,
          userId: user.id,
          expiresAt,
        },
      });

      request.log.info({ userId: user.id }, 'Password reset token created');

      // Send email with reset link if email service is configured
      try {
        const { EmailNotificationService } = await import('../services/email-notification.service');
        const IntegrationService = await import('../services/integration.service');

        const emailConfig = await IntegrationService.getIntegration('email');
        if (emailConfig && emailConfig.enabled) {
          const emailService = new EmailNotificationService(emailConfig.config);
          const resetUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

          await emailService.sendPasswordResetEmail(user.email, resetUrl);
          request.log.info({ userId: user.id }, 'Password reset email sent');
        } else {
          request.log.warn(
            { resetToken },
            'Email service not configured - reset token logged for manual testing',
          );
        }
      } catch (emailError) {
        // Log error but don't fail the request
        request.log.error(
          { error: emailError },
          'Failed to send password reset email',
        );
      }
    } else {
      // Don't reveal that user doesn't exist (security best practice)
      request.log.info({ email }, 'Password reset requested for unknown email');
    }

    // Always return success to prevent user enumeration
    return reply.status(200).send({
      message:
        'If an account exists with that email, a password reset link has been sent',
    });
  } catch (error) {
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
export async function resetConfirmHandler(
  request: FastifyRequest<{ Body: ResetConfirmBody }>,
  reply: FastifyReply,
) {
  try {
    const { token, newPassword } = request.body;

    request.log.info('Password reset confirmation attempt');

    // Find active reset token
    const resetRecord = await prisma.passwdReset.findFirst({
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
        error: 'Invalid or expired reset token',
      });
    }

    // Check if token has expired
    if (resetRecord.expiresAt < new Date()) {
      // Deactivate expired token
      await prisma.passwdReset.update({
        where: { id: resetRecord.id },
        data: { active: false },
      });

      return reply.status(400).send({
        error: 'Invalid or expired reset token',
      });
    }

    // Hash the new password
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Deactivate the reset token
    await prisma.passwdReset.update({
      where: { id: resetRecord.id },
      data: { active: false },
    });

    request.log.info(
      { userId: resetRecord.userId },
      'Password reset successful',
    );

    // Send confirmation email if email service is configured
    try {
      const { EmailNotificationService } = await import('../services/email-notification.service');
      const IntegrationService = await import('../services/integration.service');

      const emailConfig = await IntegrationService.getIntegration('email');
      if (emailConfig && emailConfig.enabled) {
        const emailService = new EmailNotificationService(emailConfig.config);
        await emailService.sendPasswordChangeConfirmationEmail(
          resetRecord.user.email,
        );
        request.log.info(
          { userId: resetRecord.userId },
          'Password change confirmation email sent',
        );
      }
    } catch (emailError) {
      // Log error but don't fail the request
      request.log.error(
        { error: emailError },
        'Failed to send confirmation email',
      );
    }

    return reply.status(200).send({
      message: 'Password reset successfully',
    });
  } catch (error) {
    request.log.error({ error }, 'Password reset confirmation error');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred resetting password',
    });
  }
}
