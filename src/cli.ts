#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { renderPattern } from './renderer.js';
import { getPatternNames } from './patterns/index.js';
import { getColorSchemeNames } from './core/color-schemes.js';
import type { GenerateOptions } from './core/types.js';

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function requireInt(flag: string, value: string | undefined): number {
  if (value == null) fail(`${flag} requires a value`);
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) fail(`${flag} must be a number, got "${value}"`);
  return n;
}

function requireFloat(flag: string, value: string | undefined): number {
  if (value == null) fail(`${flag} requires a value`);
  const n = parseFloat(value);
  if (Number.isNaN(n)) fail(`${flag} must be a number, got "${value}"`);
  return n;
}

function parseArgs(args: string[]): GenerateOptions & { outPath?: string; outDir?: string } {
  const options: GenerateOptions & { outPath?: string; outDir?: string } = {
    slug: '',
    type: 'wood-block',
  };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
      case '-t':
        options.type = args[++i];
        if (!options.type) fail('--type requires a pattern name');
        break;
      case '--size':
      case '-s':
        options.size = requireInt('--size', args[++i]);
        if (options.size <= 0 || options.size > 10000) fail('--size must be between 1 and 10000');
        break;
      case '--zoom':
      case '-z':
        options.zoom = requireFloat('--zoom', args[++i]);
        if (options.zoom <= 0) fail('--zoom must be positive');
        break;
      case '--bg':
        options.bg = args[++i];
        if (!options.bg) fail('--bg requires a color value');
        break;
      case '--color-scheme':
      case '-c':
        options.colorScheme = args[++i];
        if (!options.colorScheme) fail('--color-scheme requires a name or "random"');
        break;
      case '--out':
      case '-o':
        options.outPath = args[++i];
        if (!options.outPath) fail('--out requires a path');
        break;
      case '--out-dir':
        options.outDir = args[++i];
        if (!options.outDir) fail('--out-dir requires a directory path');
        break;
      case '--list-types':
        console.log('Available pattern types:');
        console.log(getPatternNames().join('\n'));
        process.exit(0);
      case '--list-color-schemes':
        console.log('Available color schemes:');
        console.log(getColorSchemeNames().join('\n'));
        process.exit(0);
      case '--help':
      case '-h':
        console.log(`Usage: pattern-gen <slug> [options]

Options:
  --type, -t <name>           Pattern type (default: wood-block)
  --size, -s <number>         Output size in pixels (default: 800)
  --zoom, -z <number>         Zoom factor (default: 1)
  --bg <color>                Override background color
  --color-scheme, -c <name>   Color scheme name or "random"
  --out, -o <path>            Output file path
  --out-dir <dir>             Output directory
  --list-types                List available pattern types
  --list-color-schemes        List available color schemes
  --help, -h                  Show this help`);
        process.exit(0);
      default:
        if (args[i].startsWith('-')) fail(`Unknown flag: ${args[i]}`);
        positional.push(args[i]);
        break;
    }
  }

  const slug = positional[0];
  if (!slug) {
    fail('Usage: pattern-gen <slug> [--type wood-block] [--size 800] [--zoom 1] [--color-scheme random] [--out path]');
  }

  options.slug = slug;
  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const { outPath, outDir, ...options } = parseArgs(args);

  const result = await renderPattern(options);

  const outputPath = outPath ?? resolve(outDir ?? process.cwd(), `${options.slug}.png`);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.buffer);

  console.log(`Generated: ${outputPath} (${result.patternName}, ${result.colorSchemeName}, ${result.width}x${result.height})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
