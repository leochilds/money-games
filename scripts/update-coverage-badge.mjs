import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const COVERAGE_SUMMARY_PATH = 'coverage/coverage-summary.json';
const BADGE_PATH = '.github/badges/coverage.json';

async function readCoverageSummary() {
  const raw = await readFile(COVERAGE_SUMMARY_PATH, 'utf8');
  return JSON.parse(raw);
}

function pickColor(percentage) {
  if (percentage >= 90) return 'brightgreen';
  if (percentage >= 80) return 'green';
  if (percentage >= 70) return 'yellowgreen';
  if (percentage >= 60) return 'yellow';
  if (percentage >= 50) return 'orange';
  return 'red';
}

function buildBadge(totalCoverage) {
  const pct = Number(totalCoverage?.lines?.pct ?? 0);
  const formatted = `${pct.toFixed(2)}%`;

  return {
    schemaVersion: 1,
    label: 'coverage',
    message: formatted,
    color: pickColor(pct),
  };
}

async function writeBadge(badge) {
  await mkdir(dirname(BADGE_PATH), { recursive: true });
  const serialized = `${JSON.stringify(badge, null, 2)}\n`;
  await writeFile(BADGE_PATH, serialized);
}

async function main() {
  try {
    const summary = await readCoverageSummary();
    const badge = buildBadge(summary.total);
    await writeBadge(badge);
    console.log(`Updated ${BADGE_PATH} with ${badge.message} coverage`);
  } catch (error) {
    console.error('Failed to update coverage badge:', error);
    process.exitCode = 1;
  }
}

await main();
