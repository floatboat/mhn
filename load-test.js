/**
 * Load Testing Script for MHN API
 * Run with: k6 run load-test.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const API_URL = `${BASE_URL}/api`;
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'password123';

// Load test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.1'], // Error rate < 10%
  },
};

// Global test state
let authToken = '';
let sensorUuids = [];

// Setup: Login once to get auth token
export function setup() {
  console.log('Setting up load test...');

  const loginRes = http.post(`${API_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('accessToken') !== null,
  });

  const data = loginRes.json();
  return {
    token: data.accessToken,
  };
}

// Main test function
export default function (setup_data) {
  authToken = setup_data.token;

  group('Authentication Tests', () => {
    // Test login (without consuming quota)
    const loginRes = http.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });

  group('Sensor Management Tests', () => {
    // List sensors
    const listRes = http.get(`${API_URL}/sensor`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(listRes, {
      'list sensors status is 200': (r) => r.status === 200,
      'list sensors response time < 500ms': (r) => r.timings.duration < 500,
      'list sensors returns array': (r) => Array.isArray(r.json()),
    });

    sleep(1);
  });

  group('Attack Data Tests', () => {
    // Get attack statistics
    const statsRes = http.get(`${API_URL}/attack/stats`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(statsRes, {
      'attack stats status is 200': (r) => r.status === 200,
      'attack stats response time < 500ms': (r) => r.timings.duration < 500,
      'attack stats returns object': (r) => r.json() !== null,
    });

    // Get top attackers
    const topRes = http.get(`${API_URL}/attack/top-attackers`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(topRes, {
      'top attackers status is 200': (r) => r.status === 200,
      'top attackers response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });

  group('Rules Management Tests', () => {
    // List rules
    const listRes = http.get(`${API_URL}/rule`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(listRes, {
      'list rules status is 200': (r) => r.status === 200,
      'list rules response time < 500ms': (r) => r.timings.duration < 500,
      'list rules returns array': (r) => Array.isArray(r.json()),
    });

    // Export rules in Snort format
    const exportRes = http.get(`${API_URL}/rules.rules`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(exportRes, {
      'export rules status is 200': (r) => r.status === 200,
      'export rules response time < 1000ms': (r) => r.timings.duration < 1000,
      'export rules contains Snort syntax': (r) => r.body.includes('alert'),
    });

    sleep(1);
  });

  group('Analytics Tests', () => {
    // Get analytics stats
    const analyticsRes = http.get(`${API_URL}/analytics/stats`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(analyticsRes, {
      'analytics stats status is 200': (r) => r.status === 200,
      'analytics stats response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Get geographic data
    const geoRes = http.get(`${API_URL}/attack/geo`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(geoRes, {
      'geo data status is 200': (r) => r.status === 200,
      'geo data response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });

  group('Health Checks', () => {
    // Basic health check
    const healthRes = http.get(`${BASE_URL}/health`);

    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });

    // Readiness probe
    const readinessRes = http.get(`${BASE_URL}/readiness`);

    check(readinessRes, {
      'readiness check status is 200': (r) => r.status === 200,
      'readiness check response time < 100ms': (r) => r.timings.duration < 100,
    });

    sleep(1);
  });

  sleep(0.5);
}

// Teardown: Log results
export function teardown(data) {
  console.log('Load test completed');
}
