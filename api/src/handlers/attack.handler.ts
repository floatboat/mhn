/**
 * Attack API Handlers - Process HTTP requests for attack data
 *
 * These handlers extract and validate request parameters, call the appropriate
 * service functions, and format responses with proper HTTP status codes.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import * as attackService from '../services/attack.service';
import { prisma } from '../lib/prisma';

/**
 * GET /api/attack - List attacks with filtering and pagination
 * Query params: startDate, endDate, sensorId, sourceIp, protocol, limit, offset
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Paginated attack list with total and filtered counts
 */
export async function getAttacksHandler(
  request: FastifyRequest<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      sensorId?: string;
      sourceIp?: string;
      protocol?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      sensorId,
      sourceIp,
      protocol,
      limit,
      offset,
    } = request.query;

    // Validate required date parameters
    if (!startDate || !endDate) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'startDate and endDate are required',
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      });
    }

    // Validate date range
    if (start > end) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'startDate must be before endDate',
      });
    }

    // Build filters
    const filters: attackService.AttackFilters = {};

    if (sensorId) {
      const parsedSensorId = parseInt(sensorId, 10);
      if (isNaN(parsedSensorId) || parsedSensorId < 1) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'sensorId must be a positive integer',
        });
      }
      filters.sensorId = parsedSensorId;
    }

    if (sourceIp) {
      filters.sourceIp = sourceIp;
    }

    if (protocol) {
      filters.protocol = protocol.toUpperCase();
    }

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'limit must be a positive integer between 1 and 1000',
        });
      }
      filters.limit = parsedLimit;
    }

    if (offset) {
      const parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'offset must be a non-negative integer',
        });
      }
      filters.offset = parsedOffset;
    }

    request.log.info(
      { start, end, filters },
      'Fetching attacks by date range',
    );

    const result = await attackService.getAttacksByDateRange(
      start,
      end,
      filters,
    );

    // Format response with sensor information
    const attacksWithSensors = await Promise.all(
      result.attacks.map(async (attack) => {
        const sensor = await prisma.sensor.findUnique({
          where: { id: attack.sensorId },
        });

        return {
          id: attack.id,
          sourceIp: attack.sourceIp,
          protocol: attack.protocol,
          port: attack.port,
          timestamp: attack.timestamp.toISOString(),
          sensor: sensor
            ? {
                uuid: sensor.uuid,
                name: sensor.name,
                honeypot: sensor.honeypot,
              }
            : null,
          location:
            attack.country || attack.city
              ? {
                  country: attack.country,
                  city: attack.city,
                  latitude: attack.latitude,
                  longitude: attack.longitude,
                }
              : null,
        };
      }),
    );

    return reply.status(200).send({
      attacks: attacksWithSensors,
      total: result.total,
      filtered: result.filtered,
    });
  } catch (error) {
    request.log.error({ error }, 'Error fetching attacks');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching attacks',
    });
  }
}

/**
 * GET /api/attack/stats - Get attack statistics
 * Query params: startDate?, endDate?
 *
 * @param request - Fastify request with optional date range
 * @param reply - Fastify reply
 * @returns Attack statistics object
 */
export async function getAttackStatsHandler(
  request: FastifyRequest<{
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { startDate, endDate } = request.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid startDate format. Use ISO 8601 format',
        });
      }
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid endDate format. Use ISO 8601 format',
        });
      }
    }

    request.log.info({ start, end }, 'Fetching attack statistics');

    const stats = await attackService.getAttackStatistics(start, end);

    return reply.status(200).send({
      ...stats,
      timeRange: {
        start: stats.timeRange.start.toISOString(),
        end: stats.timeRange.end.toISOString(),
      },
    });
  } catch (error) {
    request.log.error({ error }, 'Error fetching attack statistics');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching attack statistics',
    });
  }
}

/**
 * GET /api/attack/top-attackers - Get top attacker leaderboard
 * Query params: limit?, startDate?, endDate?
 *
 * @param request - Fastify request with optional parameters
 * @param reply - Fastify reply
 * @returns Array of top attackers with statistics
 */
export async function getTopAttackersHandler(
  request: FastifyRequest<{
    Querystring: {
      limit?: string;
      startDate?: string;
      endDate?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { limit, startDate, endDate } = request.query;

    let parsedLimit = 10; // default
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'limit must be a positive integer between 1 and 100',
        });
      }
    }

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid startDate format. Use ISO 8601 format',
        });
      }
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid endDate format. Use ISO 8601 format',
        });
      }
    }

    request.log.info({ limit: parsedLimit, start, end }, 'Fetching top attackers');

    const topAttackers = await attackService.getTopAttackers(
      parsedLimit,
      start,
      end,
    );

    return reply.status(200).send(topAttackers);
  } catch (error) {
    request.log.error({ error }, 'Error fetching top attackers');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching top attackers',
    });
  }
}

/**
 * GET /api/attack/geo - Get geographic statistics for heatmap
 * Query params: startDate?, endDate?
 *
 * @param request - Fastify request with optional date range
 * @param reply - Fastify reply
 * @returns Array of geographic statistics by country
 */
export async function getGeoStatsHandler(
  request: FastifyRequest<{
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { startDate, endDate } = request.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid startDate format. Use ISO 8601 format',
        });
      }
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid endDate format. Use ISO 8601 format',
        });
      }
    }

    request.log.info({ start, end }, 'Fetching geographic statistics');

    const geoStats = await attackService.getGeoStatistics(start, end);

    return reply.status(200).send(geoStats);
  } catch (error) {
    request.log.error({ error }, 'Error fetching geographic statistics');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching geographic statistics',
    });
  }
}

/**
 * GET /api/attack/sensor/:sensorId - Get attacks for specific sensor
 * Query params: limit?, offset?
 *
 * @param request - Fastify request with sensor ID and pagination parameters
 * @param reply - Fastify reply
 * @returns Paginated attacks for the sensor
 */
export async function getAttacksBySensorHandler(
  request: FastifyRequest<{
    Params: { sensorId: string };
    Querystring: { limit?: string; offset?: string };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { sensorId } = request.params;
    const { limit, offset } = request.query;

    const parsedSensorId = parseInt(sensorId, 10);
    if (isNaN(parsedSensorId) || parsedSensorId < 1) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'sensorId must be a positive integer',
      });
    }

    let parsedLimit = 20; // default
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'limit must be a positive integer between 1 and 1000',
        });
      }
    }

    let parsedOffset = 0; // default
    if (offset) {
      parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'offset must be a non-negative integer',
        });
      }
    }

    request.log.info(
      { sensorId: parsedSensorId, limit: parsedLimit, offset: parsedOffset },
      'Fetching attacks for sensor',
    );

    const result = await attackService.getAttacksBySensor(
      parsedSensorId,
      parsedLimit,
      parsedOffset,
    );

    // Format attacks with ISO dates
    const formattedAttacks = result.attacks.map((attack) => ({
      id: attack.id,
      sourceIp: attack.sourceIp,
      protocol: attack.protocol,
      port: attack.port,
      timestamp: attack.timestamp.toISOString(),
      sensorId: attack.sensorId,
      mongoId: attack.mongoId,
      location:
        attack.country || attack.city
          ? {
              country: attack.country,
              city: attack.city,
              latitude: attack.latitude,
              longitude: attack.longitude,
            }
          : null,
    }));

    return reply.status(200).send({
      attacks: formattedAttacks,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof attackService.SensorNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: error.message,
      });
    }

    request.log.error({ error }, 'Error fetching attacks for sensor');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching attacks',
    });
  }
}

/**
 * GET /api/attack/search - Search attacks by source IP
 * Query params: ip (required), limit?
 *
 * @param request - Fastify request with IP search parameters
 * @param reply - Fastify reply
 * @returns Array of attacks from the specified IP
 */
export async function searchAttacksByIpHandler(
  request: FastifyRequest<{
    Querystring: {
      ip: string;
      limit?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { ip, limit } = request.query;

    if (!ip) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'ip parameter is required',
      });
    }

    let parsedLimit = 50; // default
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'limit must be a positive integer between 1 and 1000',
        });
      }
    }

    request.log.info({ ip, limit: parsedLimit }, 'Searching attacks by IP');

    const attacks = await attackService.searchAttacksByIp(ip, parsedLimit);

    // Format attacks with ISO dates
    const formattedAttacks = attacks.map((attack) => ({
      id: attack.id,
      sourceIp: attack.sourceIp,
      protocol: attack.protocol,
      port: attack.port,
      timestamp: attack.timestamp.toISOString(),
      sensorId: attack.sensorId,
      mongoId: attack.mongoId,
      location:
        attack.country || attack.city
          ? {
              country: attack.country,
              city: attack.city,
              latitude: attack.latitude,
              longitude: attack.longitude,
            }
          : null,
    }));

    return reply.status(200).send({
      attacks: formattedAttacks,
      total: formattedAttacks.length,
    });
  } catch (error) {
    if (error instanceof attackService.AttackValidationError) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: error.message,
      });
    }

    request.log.error({ error }, 'Error searching attacks by IP');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred searching attacks',
    });
  }
}

/**
 * GET /api/attack/:id - Get single attack detail from MongoDB
 * Params: id (MongoDB ObjectId)
 *
 * @param request - Fastify request with MongoDB ObjectId
 * @param reply - Fastify reply
 * @returns Detailed attack payload from MongoDB
 */
export async function getAttackDetailHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params;

    // Validate ObjectId format (24 hex characters)
    if (!/^[0-9a-f]{24}$/i.test(id)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid MongoDB ObjectId format',
      });
    }

    request.log.info({ mongoId: id }, 'Fetching attack detail');

    const attack = await attackService.getAttackDetail(id);

    if (!attack) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Attack not found',
      });
    }

    return reply.status(200).send(attack);
  } catch (error) {
    request.log.error({ error }, 'Error fetching attack detail');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred fetching attack detail',
    });
  }
}
