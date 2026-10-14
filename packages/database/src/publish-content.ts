import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';
import { themeDefinitionSchema } from '@aquarium/aquarium-engine/content';

const args = process.argv.slice(2).filter(arg => arg !== '--');
const apply = args.includes('--apply');
const themes = [
  { id: 'sunny-reef', name: 'Sunny Reef', emoji: '☀️', appearance: { background: 'coral', substrate: 'white-sand', lighting: 'sunny', bubbles: 'lots' }, scenery: [
      { id: 'reef-arch-left', assetId: 'reef-arch', x: 0.17, depth: 0.5, scale: 1.3, rotation: -0.12, color: '#9e94a4' },
      { id: 'reef-fan-pink', assetId: 'reef-fan', x: 0.32, depth: 0.5, scale: 1.4, rotation: 0.12, color: '#ff729e' },
      { id: 'reef-fan-orange', assetId: 'reef-fan', x: 0.72, depth: 0.5, scale: 1.2, rotation: -0.2, color: '#ffab5d' },
      { id: 'reef-arch-right', assetId: 'reef-arch', x: 0.88, depth: 0.5, scale: 1.1, rotation: 0.15, color: '#b7a1ad' },
    ] },
  { id: 'ocean-garden', name: 'Ocean Garden', emoji: '🌿', appearance: { background: 'ocean', substrate: 'sand', lighting: 'soft', bubbles: 'some' }, scenery: [
      { id: 'garden-kelp-left', assetId: 'kelp', x: 0.13, depth: 0.5, scale: 1.35, rotation: -0.08, color: '#2ca986' },
      { id: 'garden-grass-left', assetId: 'seagrass', x: 0.29, depth: 0.5, scale: 1.1, rotation: 0, color: '#75d99d' },
      { id: 'garden-kelp-center', assetId: 'kelp', x: 0.49, depth: 0.5, scale: 1.12, rotation: 0.1, color: '#278a7a' },
      { id: 'garden-grass-right', assetId: 'seagrass', x: 0.7, depth: 0.5, scale: 1.2, rotation: 0.1, color: '#55c9a0' },
      { id: 'garden-kelp-right', assetId: 'kelp', x: 0.87, depth: 0.5, scale: 1.4, rotation: 0.12, color: '#3ab28c' },
    ] },
  { id: 'midnight-sea', name: 'Midnight Sea', emoji: '🌙', appearance: { background: 'deep-sea', substrate: 'dark-gravel', lighting: 'night', bubbles: 'some' }, scenery: [
      { id: 'midnight-glow-left', assetId: 'glow-plant', x: 0.13, depth: 0.5, scale: 1.28, rotation: -0.1, color: '#608cff' },
      { id: 'midnight-grass-left', assetId: 'seagrass', x: 0.31, depth: 0.5, scale: 1.04, rotation: 0.06, color: '#8769bd' },
      { id: 'midnight-arch', assetId: 'reef-arch', x: 0.52, depth: 0.5, scale: 1.08, rotation: 0.08, color: '#4a5b8a' },
      { id: 'midnight-fan', assetId: 'reef-fan', x: 0.72, depth: 0.5, scale: 1.17, rotation: -0.13, color: '#a179d3' },
      { id: 'midnight-glow-right', assetId: 'glow-plant', x: 0.89, depth: 0.5, scale: 1.2, rotation: 0.13, color: '#b06dff' },
    ] },
  { id: 'magic-lagoon', name: 'Magic Lagoon', emoji: '✨', appearance: { background: 'fantasy', substrate: 'pebbles', lighting: 'soft', bubbles: 'lots' }, scenery: [
      { id: 'lagoon-mushrooms-left', assetId: 'glow-mushroom', x: 0.14, depth: 0.5, scale: 1.28, rotation: -0.12, color: '#d18aff' },
      { id: 'lagoon-fan-pink', assetId: 'reef-fan', x: 0.34, depth: 0.5, scale: 1.35, rotation: 0.1, color: '#fa7ebf' },
      { id: 'lagoon-grass-center', assetId: 'seagrass', x: 0.52, depth: 0.5, scale: 1.06, rotation: 0, color: '#66d8b6' },
      { id: 'lagoon-fan-purple', assetId: 'reef-fan', x: 0.71, depth: 0.5, scale: 1.25, rotation: -0.15, color: '#bc8cf3' },
      { id: 'lagoon-mushrooms-right', assetId: 'glow-mushroom', x: 0.87, depth: 0.5, scale: 1.18, rotation: 0.14, color: '#80e8ed' },
    ] },
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const unsupportedArgs = args.filter(arg => arg !== '--apply');
  if (unsupportedArgs.length > 0) {
    throw new Error(`Unsupported arguments: ${unsupportedArgs.join(', ')}. Only --apply is supported.`);
  }
  console.log(apply ? 'APPLY MODE: publishing theme definitions' : 'DRY RUN: no changes will be written');
  const target = process.env.DATABASE_URL;
  if (target) {
    try { const u = new URL(target); console.log(`Database target: ${u.hostname}:${u.port || '5432'}/${u.pathname.slice(1)}`); }
    catch { console.log('Database target: DATABASE_URL set (could not parse hostname)'); }
  } else console.log('Database target: resolved by existing database configuration');

  for (const theme of themes) {
    const definition = themeDefinitionSchema.parse({ schemaVersion: 2, ...theme });
    const payload = { type: 'THEME', data: definition };
    const existing = await prisma.contentItem.findUnique({
      where: { type_slug: { type: 'THEME', slug: theme.id } },
      include: { versions: true },
    });
    const published = existing?.versions.find(v => v.id === existing.publishedVersionId);
    if (published && canonical(published.definition) === canonical(payload)) {
      console.log(`${theme.id}: unchanged (v${published.version})`);
      continue;
    }
    const next = Math.max(0, ...(existing?.versions.map(v => v.version) ?? [])) + 1;
    console.log(`${theme.id}: ${existing ? `publish v${next}` : 'create and publish v1'}${published ? ` (current v${published.version})` : ''}`);
    if (!apply) continue;

    await prisma.$transaction(async tx => {
      const item = await tx.contentItem.upsert({
        where: { type_slug: { type: 'THEME', slug: theme.id } },
        create: { type: 'THEME', slug: theme.id, name: theme.name },
        update: {},
      });
      const versions = await tx.contentVersion.findMany({ where: { contentItemId: item.id } });
      const active = versions.find(v => v.id === item.publishedVersionId);
      if (active && canonical(active.definition) === canonical(payload)) return;
      const nextVersion = Math.max(0, ...versions.map(v => v.version)) + 1;
      const version = await tx.contentVersion.create({ data: {
          contentItemId: item.id, version: nextVersion, schemaVersion: 2,
          definition: payload as Prisma.InputJsonValue,
        } });
      await tx.contentItem.update({ where: { id: item.id }, data: {
          name: theme.name, status: 'PUBLISHED', publishedVersionId: version.id,
        } });
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
