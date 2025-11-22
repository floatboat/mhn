"use strict";
/**
 * Attack API Routes
 *
 * Exposes HTTP endpoints for querying and analyzing attack data
 * from both PostgreSQL (metadata) and MongoDB (full payloads)
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = attackRoutes;
const attackHandler = __importStar(require("../../handlers/attack.handler"));
const attackTypes = __importStar(require("../../types/attack.types"));
async function attackRoutes(fastify) {
    /**
     * GET /api/attack
     * List attacks with filtering and pagination
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack',
        schema: attackTypes.getAttacksSchema,
        handler: attackHandler.getAttacksHandler,
    });
    /**
     * GET /api/attack/stats
     * Get attack statistics and aggregated data
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/stats',
        schema: attackTypes.getAttackStatsSchema,
        handler: attackHandler.getAttackStatsHandler,
    });
    /**
     * GET /api/attack/top-attackers
     * Get leaderboard of top attackers by IP
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/top-attackers',
        schema: attackTypes.getTopAttackersSchema,
        handler: attackHandler.getTopAttackersHandler,
    });
    /**
     * GET /api/attack/geo
     * Get geographic statistics for heatmap visualization
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/geo',
        schema: attackTypes.getGeoStatsSchema,
        handler: attackHandler.getGeoStatsHandler,
    });
    /**
     * GET /api/attack/sensor/:sensorId
     * Get attacks for specific sensor with pagination
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/sensor/:sensorId',
        schema: attackTypes.getAttacksBySensorSchema,
        handler: attackHandler.getAttacksBySensorHandler,
    });
    /**
     * GET /api/attack/search
     * Search attacks by source IP address
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/search',
        schema: attackTypes.searchAttacksByIpSchema,
        handler: attackHandler.searchAttacksByIpHandler,
    });
    /**
     * GET /api/attack/:id
     * Get detailed attack data from MongoDB by ObjectId
     * Requires: api_key or JWT auth (not implemented yet)
     */
    fastify.route({
        method: 'GET',
        url: '/attack/:id',
        schema: attackTypes.getAttackDetailSchema,
        handler: attackHandler.getAttackDetailHandler,
    });
}
