const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${encodeURIComponent('summary,status,issuetype,parent')}`;

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
    issueType: issue.fields?.issuetype?.name || '',
    isSubtask: Boolean(issue.fields?.issuetype?.subtask),
    parentKey: issue.fields?.parent?.key || null,
  }));
}

async function postComment(ticketKey, commentBody, env) {
  if (!env.JIRA_BASE_URL || !env.JIRA_API_TOKEN) {
    throw new Error('Missing JIRA_BASE_URL or JIRA_API_TOKEN in .env');
  }

  const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(ticketKey)}/comment`;

  return requestJson(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.JIRA_API_TOKEN}`,
    },
    body: JSON.stringify({ body: commentBody }),
  });
}

async function attachFile(ticketKey, filePath, env) {
  if (!env.JIRA_BASE_URL || !env.JIRA_API_TOKEN) {
    throw new Error('Missing JIRA_BASE_URL or JIRA_API_TOKEN in .env');
  }

  const fileContent = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const boundary = `----FormBoundary${Date.now()}`;

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    `Content-Type: text/markdown\r\n\r\n`,
  ];

  const bodyPrefix = Buffer.from(bodyParts.join(''), 'utf8');
  const bodySuffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([bodyPrefix, fileContent, bodySuffix]);

  const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(ticketKey)}/attachments`);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.JIRA_API_TOKEN}`,
          'X-Atlassian-Token': 'no-check',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Accept: 'application/json',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Jira attachment failed (${res.statusCode}): ${responseBody.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            resolve({ ok: true });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  listTicketsByStatus,
  postComment,
  attachFile,
};
