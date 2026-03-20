/**
 * ClarixBI API — k6 Load Test Script
 *
 * Runs multi-scenario load tests against the ClarixBI API and asserts
 * p95 latency thresholds per endpoint group.
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=http://localhost:4000 \
 *     --env JWT_TOKEN=<your-jwt> \
 *     --env ORG_ID=<uuid> \
 *     --env DASHBOARD_ID=<uuid> \
 *     --env WIDGET_ID=<uuid> \
 *     --env CONVERSATION_ID=<uuid> \
 *     k6-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const healthDuration = new Trend('health_duration', true);
const authMeDuration = new Trend('auth_me_duration', true);
const dashboardsListDuration = new Trend('dashboards_list_duration', true);
const dashboardDetailDuration = new Trend('dashboard_detail_duration', true);
const widgetDataDuration = new Trend('widget_data_duration', true);
const aiMessageDuration = new Trend('ai_message_duration', true);

const errorRate = new Rate('errors');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const ORG_ID = __ENV.ORG_ID || '00000000-0000-4000-a000-000000000001';
const DASHBOARD_ID = __ENV.DASHBOARD_ID || '00000000-0000-4000-a000-000000000002';
const WIDGET_ID = __ENV.WIDGET_ID || '00000000-0000-4000-a000-000000000003';
const CONVERSATION_ID = __ENV.CONVERSATION_ID || '00000000-0000-4000-a000-000000000004';

const API = `${BASE_URL}/api/v1`;

const authHeaders = {
  headers: {
    Authorization: `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json',
  },
};

const publicHeaders = {
  headers: {
    'Content-Type': 'application/json',
  },
};

// ---------------------------------------------------------------------------
// Options: scenarios + thresholds
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Scenario 1: Health check (lightweight, constant load)
    health: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'healthCheck',
      tags: { scenario: 'health' },
    },

    // Scenario 2: Authenticated user fetching their profile
    auth_me: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'authMe',
      startTime: '10s',
      tags: { scenario: 'auth_me' },
    },

    // Scenario 3: Listing dashboards (common read path)
    dashboards_list: {
      executor: 'constant-vus',
      vus: 15,
      duration: '5m',
      exec: 'dashboardsList',
      startTime: '10s',
      tags: { scenario: 'dashboards_list' },
    },

    // Scenario 4: Fetching a single dashboard (detail view)
    dashboard_detail: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'dashboardDetail',
      startTime: '15s',
      tags: { scenario: 'dashboard_detail' },
    },

    // Scenario 5: Widget data retrieval
    widget_data: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'widgetData',
      startTime: '15s',
      tags: { scenario: 'widget_data' },
    },

    // Scenario 6: AI message (expensive, lower VUs)
    ai_message: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'aiMessage',
      startTime: '20s',
      tags: { scenario: 'ai_message' },
    },
  },

  thresholds: {
    // Global
    errors: ['rate<0.1'], // <10% error rate

    // Per-endpoint p95 targets
    health_duration: ['p(95)<100'],
    auth_me_duration: ['p(95)<200'],
    dashboards_list_duration: ['p(95)<300'],
    dashboard_detail_duration: ['p(95)<1000'],
    widget_data_duration: ['p(95)<500'],
    ai_message_duration: ['p(95)<5000'],

    // Global HTTP duration
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

// ---------------------------------------------------------------------------
// Scenario functions
// ---------------------------------------------------------------------------

export function healthCheck() {
  group('Health Check', () => {
    const res = http.get(`${API}/health`, publicHeaders);

    healthDuration.add(res.timings.duration);

    const ok = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: body has status ok': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.status === 'ok';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function authMe() {
  group('Auth Me', () => {
    const res = http.get(`${API}/auth/me`, authHeaders);

    authMeDuration.add(res.timings.duration);

    const ok = check(res, {
      'auth/me: status 200': (r) => r.status === 200,
      'auth/me: has data': (r) => {
        try {
          return JSON.parse(r.body).data !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function dashboardsList() {
  group('Dashboards List', () => {
    const res = http.get(
      `${API}/organizations/${ORG_ID}/dashboards`,
      authHeaders,
    );

    dashboardsListDuration.add(res.timings.duration);

    const ok = check(res, {
      'dashboards list: status 200': (r) => r.status === 200,
      'dashboards list: data is array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).data);
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function dashboardDetail() {
  group('Dashboard Detail', () => {
    const res = http.get(
      `${API}/organizations/${ORG_ID}/dashboards/${DASHBOARD_ID}`,
      authHeaders,
    );

    dashboardDetailDuration.add(res.timings.duration);

    const ok = check(res, {
      'dashboard detail: status 200': (r) => r.status === 200,
      'dashboard detail: has data object': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && typeof body.data === 'object';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function widgetData() {
  group('Widget Data', () => {
    const res = http.get(
      `${API}/organizations/${ORG_ID}/dashboards/${DASHBOARD_ID}/widgets`,
      authHeaders,
    );

    widgetDataDuration.add(res.timings.duration);

    const ok = check(res, {
      'widgets: status 200': (r) => r.status === 200,
      'widgets: has data': (r) => {
        try {
          return JSON.parse(r.body).data !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function aiMessage() {
  group('AI Message', () => {
    const payload = JSON.stringify({
      content: 'What were total sales last month?',
    });

    const res = http.post(
      `${API}/organizations/${ORG_ID}/ai/conversations/${CONVERSATION_ID}/messages`,
      payload,
      authHeaders,
    );

    aiMessageDuration.add(res.timings.duration);

    const ok = check(res, {
      'ai message: status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'ai message: has data': (r) => {
        try {
          return JSON.parse(r.body).data !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);
  });

  sleep(2); // AI calls are heavier, add extra think time
}

// ---------------------------------------------------------------------------
// Default function (runs if no specific scenario exec is matched)
// ---------------------------------------------------------------------------

export default function () {
  healthCheck();
  authMe();
  dashboardsList();
  dashboardDetail();
  widgetData();
  aiMessage();
}
