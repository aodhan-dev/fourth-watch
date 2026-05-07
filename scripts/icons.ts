/**
 * Generate PNG icons for the PWA manifest from the source SVGs.
 * Run with: npm run icons
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

interface Job {
  src: string;
  out: string;
  size: number;
}

const STATIC = join(process.cwd(), 'static');

const jobs: Job[] = [
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-192.png', size: 192 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
  { src: 'icon.svg', out: 'apple-touch-icon.png', size: 180 }
];

for (const j of jobs) {
  const svg = readFileSync(join(STATIC, j.src));
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: j.size } });
  const png = resvg.render().asPng();
  writeFileSync(join(STATIC, j.out), png);
  console.log(`wrote ${j.out} (${j.size}x${j.size}, ${png.length} bytes)`);
}
