/**
 * Default Scripts Loader Service
 * Loads default deploy scripts from /scripts folder into the database
 * Runs during application startup
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../lib/prisma';
import { globalLogger } from '../lib/logger';

interface ScriptMetadata {
  name: string;
  description: string;
  honeypotType: string;
}

/**
 * Extract metadata from script header comments
 * Format:
 * # MHN <Honeypot Name> Honeypot Deployment Script
 * # Description: <description>
 */
function parseScriptMetadata(filename: string, content: string): ScriptMetadata | null {
  // Parse from filename: ubuntu-dionaea.sh -> Ubuntu - Dionaea
  const match = filename.match(/^([a-z]+)-([a-z]+)\.sh$/);
  if (!match) {
    return null;
  }

  const [, os, honeypot] = match;

  // Get description from file header
  const headerMatch = content.match(/^#\s+MHN\s+(.+)\n#\s+Usage:/);
  const description = headerMatch ? headerMatch[1] : `${honeypot.charAt(0).toUpperCase() + honeypot.slice(1)} Honeypot on ${os.charAt(0).toUpperCase() + os.slice(1)}`;

  return {
    name: `${os.charAt(0).toUpperCase() + os.slice(1)} - ${honeypot.charAt(0).toUpperCase() + honeypot.slice(1)}`,
    description,
    honeypotType: honeypot.toLowerCase(),
  };
}

/**
 * Load all default deploy scripts from /scripts directory
 * Creates or updates scripts in the database (owned by admin user)
 */
export async function loadDefaultDeployScripts(): Promise<void> {
  try {
    // Get admin user (or create if doesn't exist)
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@mhn.local' },
    });

    if (!adminUser) {
      globalLogger.warn('Admin user not found for loading default scripts');
      return;
    }

    const scriptsDir = join(__dirname, '../../..', 'scripts');

    // Check if scripts directory exists
    if (!existsSync(scriptsDir)) {
      globalLogger.warn({ path: scriptsDir }, 'Default scripts directory not found');
      return;
    }

    // Read all .sh files
    const files = readdirSync(scriptsDir).filter((f) => f.endsWith('.sh'));

    if (files.length === 0) {
      globalLogger.info('No default scripts found to load');
      return;
    }

    globalLogger.info({ count: files.length }, 'Loading default deploy scripts');

    for (const filename of files) {
      try {
        const filepath = join(scriptsDir, filename);
        const content = readFileSync(filepath, 'utf-8');
        const metadata = parseScriptMetadata(filename, content);

        if (!metadata) {
          globalLogger.warn({ filename }, 'Could not parse script metadata');
          continue;
        }

        // Check if script already exists
        const existing = await prisma.deployScript.findFirst({
          where: {
            name: metadata.name,
            userId: adminUser.id,
          },
        });

        if (existing) {
          // Update existing script
          await prisma.deployScript.update({
            where: { id: existing.id },
            data: {
              script: content,
              notes: metadata.description,
            },
          });
          globalLogger.info({ name: metadata.name }, 'Updated default deploy script');
        } else {
          // Create new script
          await prisma.deployScript.create({
            data: {
              name: metadata.name,
              script: content,
              notes: metadata.description,
              userId: adminUser.id,
            },
          });
          globalLogger.info({ name: metadata.name }, 'Created default deploy script');
        }
      } catch (error) {
        globalLogger.error(
          {
            filename,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to load deploy script'
        );
      }
    }

    globalLogger.info('Finished loading default deploy scripts');
  } catch (error) {
    globalLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to load default deploy scripts'
    );
  }
}

/**
 * Initialize default scripts on application startup
 * Should be called once during app initialization
 */
export async function initializeDefaultScripts(): Promise<void> {
  try {
    await loadDefaultDeployScripts();
  } catch (error) {
    globalLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error initializing default scripts'
    );
    // Don't throw - this is optional functionality
  }
}
