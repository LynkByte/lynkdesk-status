#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');

const SITES = [
  'corporate-website',
  'web-app',
  'api',
  'database-and-cache'
];
const WINDOW_HOURS = 24 * 7;
const REF = process.env.GIT_REF || 'HEAD';

const since = new Date(Date.now() - WINDOW_HOURS * 3600000).toISOString();
const services = {};

for (const slug of SITES) {
  let log = '';
  try {
    log = execFileSync(
      'git',
      ['log', REF, `--since=${since}`, '--date=iso-strict', '--pretty=format:%cI%x09%s', '--', `history/${slug}.yml`],
      { encoding: 'utf8' }
    );
  } catch (error) {
    log = '';
  }

  const buckets = new Map();
  for (const line of log.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const date = line.slice(0, tab);
    const subject = line.slice(tab + 1);
    const match = subject.match(/\((\d+) in (\d+) ms\)/);
    if (!match) continue;
    const code = Number(match[1]);
    const responseTime = Number(match[2]);
    if (!Number.isFinite(responseTime) || responseTime <= 0) continue;
    if (!Number.isFinite(code) || code <= 0) continue;
    const timestamp = new Date(date);
    if (Number.isNaN(timestamp.getTime())) continue;
    const hour = new Date(Math.floor(timestamp.getTime() / 3600000) * 3600000).toISOString();
    const bucket = buckets.get(hour) || { sum: 0, count: 0, min: responseTime, max: responseTime };
    bucket.sum += responseTime;
    bucket.count += 1;
    bucket.min = Math.min(bucket.min, responseTime);
    bucket.max = Math.max(bucket.max, responseTime);
    buckets.set(hour, bucket);
  }

  services[slug] = {
    hours: [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, bucket]) => ({
        hour,
        avg: Math.round(bucket.sum / bucket.count),
        min: bucket.min,
        max: bucket.max,
        count: bucket.count
      }))
  };
}

const output = {
  generated_at: new Date().toISOString(),
  window_hours: WINDOW_HOURS,
  services
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/hourly.json', JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote data/hourly.json for ${SITES.length} services`);
