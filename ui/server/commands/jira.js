const https = require('https');
const http = require('http');

function requestJson(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method || 'GET',
        headers: options.headers || {},
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Jira request failed (${res.statusCode}): ${body.slice(0, 300)}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Unable to parse Jira response: ${error.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function listTicketsByStatus(status, env, maxResults = 50) {
  if (!env.JIRA_BASE_URL || !env.JIRA_API_TOKEN) {
    throw new Error('Missing JIRA_BASE_URL or JIRA_API_TOKEN in .env');
  }

  const project = env.JIRA_PROJECT || 'SSPLAN';
  const jql = `project = "${project}" AND status = "${status}" ORDER BY updated DESC`;
  const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${encodeURIComponent('summary,status')}`;

  const data = await requestJson(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.JIRA_API_TOKEN}`,
    },
  });

  return (data.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary || 'No summary',
    status: issue.fields?.status?.name || status,
  }));
}

module.exports = {
  listTicketsByStatus,
};
