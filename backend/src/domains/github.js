/**
 * GitHub events domain pack
 * Produces GitHub Archive-shaped events for 4 curated event types.
 */

const types = ['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'ReleaseEvent'];

const defaultRates = {
  PushEvent: 800,
  PullRequestEvent: 200,
  IssuesEvent: 150,
  ReleaseEvent: 20
};

const scenarios = {
  normal: {
    PushEvent: 800,
    PullRequestEvent: 200,
    IssuesEvent: 150,
    ReleaseEvent: 20
  },
  'release-rush': {
    PushEvent: 4000,
    PullRequestEvent: 1500,
    IssuesEvent: 150,
    ReleaseEvent: 400
  }
};

/**
 * Renders a ShadowTraffic value object for the given GitHub event type.
 * @param {string} type - One of: PushEvent, PullRequestEvent, IssuesEvent, ReleaseEvent
 * @returns {Object} ShadowTraffic value template
 */
function renderValue(type) {
  if (!types.includes(type)) {
    throw new Error(`Unknown GitHub event type: ${type}`);
  }

  // Common fields for all event types
  const baseEvent = {
    type: type,
    actor_login: {
      _gen: 'oneOf',
      choices: ['octocat', 'torvalds', 'gaearon', 'mojombo', 'defunkt', 'bot-ci[bot]', 'dependabot[bot]', 'renovate[bot]']
    },
    actor_id: {
      _gen: 'uniformDistribution',
      bounds: [1, 9999999],
      decimals: 0
    },
    repo_full_name: {
      _gen: 'oneOf',
      choices: [
        'torvalds/linux',
        'facebook/react',
        'aiven/aiven-client',
        'kubernetes/kubernetes',
        'rust-lang/rust',
        'apache/kafka',
        'microsoft/vscode',
        'nodejs/node'
      ]
    },
    // repo_id also appears in the Kafka message key (see renderKey) to spread
    // load across partitions. Same distribution; ShadowTraffic has no same-record
    // key→value reference, so this is an independent draw (fine for the demo).
    repo_id: {
      _gen: 'uniformDistribution',
      bounds: [1, 500000],
      decimals: 0
    },
    org_login: {
      _gen: 'oneOf',
      choices: ['aiven', 'facebook', 'kubernetes', 'rust-lang', 'apache']
    },
    created_at: {
      _gen: 'now'
    },
    public: true
  };

  // Add type-specific fields
  switch (type) {
    case 'PushEvent':
      return {
        ...baseEvent,
        commit_count: {
          _gen: 'uniformDistribution',
          bounds: [1, 20],
          decimals: 0
        },
        ref: {
          _gen: 'oneOf',
          choices: ['main', 'develop', 'feature/x']
        }
      };

    case 'PullRequestEvent':
      return {
        ...baseEvent,
        action: {
          _gen: 'oneOf',
          choices: ['opened', 'closed', 'reopened', 'synchronize']
        }
      };

    case 'IssuesEvent':
      return {
        ...baseEvent,
        action: {
          _gen: 'oneOf',
          choices: ['opened', 'closed', 'reopened']
        }
      };

    case 'ReleaseEvent':
      return {
        ...baseEvent,
        tag_name: {
          _gen: 'oneOf',
          choices: ['v1.0.0', 'v2.1.3', 'v0.9.0']
        }
      };

    default:
      throw new Error(`Unknown GitHub event type: ${type}`);
  }
}

/**
 * The Kafka message key: an object carrying repo_id. Keying by repo_id spreads
 * load across partitions and keeps a repo's events ordered on one partition.
 */
function renderKey() {
  return { repo_id: { _gen: 'uniformDistribution', bounds: [1, 500000], decimals: 0 } };
}

// Postgres table the JDBC sink writes to (topic github-events → table github_events
// via the connector's table.name.format). created_at is BIGINT epoch-millis (from
// ShadowTraffic's `now` Avro long); bucket in SQL with to_timestamp(created_at/1000.0).
const table = 'github_events';
const nowMs = 'extract(epoch from now())*1000';

const metricQueries = {
  eventsPerSec: `SELECT count(*)/5.0 AS v FROM ${table} WHERE created_at > (${nowMs} - 5000)`,
  totalEvents: `SELECT count(*) AS v FROM ${table}`,
  activeRepos: `SELECT count(DISTINCT repo_id) AS v FROM ${table} WHERE created_at > (${nowMs} - 60000)`,
  byType: `SELECT type AS label, count(*) AS value FROM ${table} WHERE created_at > (${nowMs} - 60000) GROUP BY type ORDER BY value DESC`,
  topRepos: `SELECT repo_full_name AS label, count(*) AS value FROM ${table} WHERE created_at > (${nowMs} - 60000) GROUP BY repo_full_name ORDER BY value DESC LIMIT 8`,
  series: `SELECT floor(created_at/1000)::bigint AS t, type, count(*) AS value
           FROM ${table} WHERE created_at > (${nowMs} - 120000)
           GROUP BY t, type ORDER BY t`,
};

function shapeMetrics(raw) {
  const num = (rows) => (rows && rows[0] ? Number(Object.values(rows[0])[0]) : 0);
  const list = (rows) => (rows || []).map((r) => ({ label: r.label, value: Number(r.value) }));
  return {
    kpis: {
      eventsPerSec: Math.round(num(raw.eventsPerSec)),
      totalEvents: num(raw.totalEvents),
      activeRepos: num(raw.activeRepos),
    },
    byType: list(raw.byType),
    topRepos: list(raw.topRepos),
    series: (raw.series || []).map((r) => ({ t: Number(r.t), type: r.type, value: Number(r.value) })),
    ts: Date.now(),
  };
}

export default {
  topic: 'github-events',
  keyField: 'repo_id',
  table,
  types,
  defaultRates,
  scenarios,
  renderValue,
  renderKey,
  metricQueries,
  shapeMetrics,
};
