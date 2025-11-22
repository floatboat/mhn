import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

const SALT_ROUNDS = 10; // Industry standard

/**
 * Custom error for user already exists
 */
export class UserExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserExistsError';
  }
}

/**
 * Custom error for user not found
 */
export class UserNotFoundError extends Error {
  constructor(message: string = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

/**
 * User response interface without password
 */
export interface UserResponse {
  id: number;
  email: string;
  name: string;
  active: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User update data interface
 */
export interface UserUpdateData {
  email?: string;
  name?: string;
  active?: boolean;
  confirmedAt?: Date | null;
}

export async function getAllUserNames() {
  const users = await prisma.user.findMany({
    select: {
      name: true,
    },
  });
  return users.map((user) => user.name);
}

// TODO: Consider using typebox for validation and creating different types for request and response (ie. userWIthoutPassword).
export async function createUser(
  name: string,
  email: string,
  password: string,
) {
  // Check if user exists by name or email
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ name }, { email }],
    },
  });

  if (existingUser) {
    const field = existingUser.name === name ? 'name' : 'email';
    throw new UserExistsError(`User with this ${field} already exists`);
  }

  // Hash password before storing
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  // Don't return password in response
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Verifies a plain text password against a hashed password
 * Used for login authentication
 * @param plainPassword - Plain text password to verify
 * @param hashedPassword - Hashed password from database
 * @returns True if password matches
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Gets a user by ID
 * @param id - User ID
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
export async function getUserById(id: number): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      password: false, // Explicitly exclude password
    },
  });

  if (!user) {
    throw new UserNotFoundError(`User with ID ${id} not found`);
  }

  return user;
}

/**
 * Gets a user by email
 * @param email - User's email address
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
export async function getUserByEmail(email: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      password: false, // Explicitly exclude password
    },
  });

  if (!user) {
    throw new UserNotFoundError(`User with email '${email}' not found`);
  }

  return user;
}

/**
 * Gets a user by username
 * @param name - Username
 * @returns User object without password
 * @throws UserNotFoundError if user doesn't exist
 */
export async function getUserByName(name: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { name },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      password: false, // Explicitly exclude password
    },
  });

  if (!user) {
    throw new UserNotFoundError(`User with name '${name}' not found`);
  }

  return user;
}

/**
 * Updates a user's information
 * @param id - User ID
 * @param data - Fields to update
 * @returns Updated user object without password
 * @throws UserNotFoundError if user doesn't exist
 * @throws UserExistsError if email or name is already taken
 */
export async function updateUser(
  id: number,
  data: UserUpdateData,
): Promise<UserResponse> {
  // Verify user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new UserNotFoundError(`User with ID ${id} not found`);
  }

  // Check if email or name is being changed to an already-used value
  if (data.email || data.name) {
    const conflictingUser = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: id } }, // Exclude current user
          {
            OR: [
              data.email ? { email: data.email } : {},
              data.name ? { name: data.name } : {},
            ],
          },
        ],
      },
    });

    if (conflictingUser) {
      if (conflictingUser.email === data.email) {
        throw new UserExistsError('Email is already taken');
      }
      if (conflictingUser.name === data.name) {
        throw new UserExistsError('Username is already taken');
      }
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      password: false, // Explicitly exclude password
    },
  });

  return updatedUser;
}

/**
 * Deletes a user
 * This will cascade delete related records (API keys, reset tokens, etc.)
 * @param id - User ID
 * @returns True if deletion was successful
 * @throws UserNotFoundError if user doesn't exist
 */
export async function deleteUser(id: number): Promise<boolean> {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new UserNotFoundError(`User with ID ${id} not found`);
  }

  // Delete user (cascade will handle related records)
  await prisma.user.delete({
    where: { id },
  });

  return true;
}

/**
 * Activates a user account
 * Sets active field to true
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
export async function activateUser(id: number): Promise<UserResponse> {
  return updateUser(id, { active: true });
}

/**
 * Deactivates a user account
 * Sets active field to false
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
export async function deactivateUser(id: number): Promise<UserResponse> {
  return updateUser(id, { active: false });
}

/**
 * Confirms a user's email
 * Sets confirmedAt to current timestamp
 * @param id - User ID
 * @returns Updated user object
 * @throws UserNotFoundError if user doesn't exist
 */
export async function confirmUserEmail(id: number): Promise<UserResponse> {
  return updateUser(id, { confirmedAt: new Date() });
}

/**
 * Lists all users with optional filtering
 * @param includeInactive - Whether to include inactive users (default: true)
 * @returns Array of user objects without passwords
 */
export async function getAllUsers(
  includeInactive: boolean = true,
): Promise<UserResponse[]> {
  const where: Prisma.UserWhereInput = includeInactive ? {} : { active: true };

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      password: false, // Explicitly exclude password
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Counts total number of users
 * @param activeOnly - Whether to count only active users (default: false)
 * @returns Total number of users
 */
export async function countUsers(activeOnly: boolean = false): Promise<number> {
  const where: Prisma.UserWhereInput = activeOnly ? { active: true } : {};

  return prisma.user.count({ where });
}

/**
 * Checks if a user exists by email
 * @param email - Email address to check
 * @returns True if user exists
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email },
  });

  return count > 0;
}

/**
 * Checks if a user exists by username
 * @param name - Username to check
 * @returns True if user exists
 */
export async function userExistsByName(name: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { name },
  });

  return count > 0;
}
