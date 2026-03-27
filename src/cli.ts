#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { renderPattern, renderOgpFromConfig, renderOgpEditorFromConfig } from './renderer.js';
import { parseOgpConfig, parseOgpEditorConfig, getColorSchemeNames } from '@takazudo/pattern-gen-core';
import type { GenerateOptions } from '@takazudo/pattern-gen-core';
import { getPatternNames } from '@takazudo/pattern-gen-generators';

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
        if (options.zoom <= 0 || options.zoom > 100) fail('--zoom must be greater than 0 and at most 100');
        break;
      case '--bg': {
        let bgInput = args[++i];
        if (!bgInput) fail('--bg requires a color value');
        // Normalize: ensure # prefix
        if (!bgInput.startsWith('#')) bgInput = '#' + bgInput;
        // Validate hex color format
        const bgHex = bgInput.slice(1);
        if (!/^[0-9a-fA-F]{3}$/.test(bgHex) && !/^[0-9a-fA-F]{6}$/.test(bgHex)) {
          fail('--bg must be a valid hex color (e.g., #ff0000 or #f00)');
        }
        options.bg = bgInput;
        break;
      }
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
      case '--hue':
        options.hsl = options.hsl ?? {};
        options.hsl.h = requireFloat('--hue', args[++i]);
        if (options.hsl.h < -180 || options.hsl.h > 180) fail('--hue must be between -180 and 180');
        break;
      case '--saturation':
        options.hsl = options.hsl ?? {};
        options.hsl.s = requireFloat('--saturation', args[++i]);
        if (options.hsl.s < -100 || options.hsl.s > 100) fail('--saturation must be between -100 and 100');
        break;
      case '--lightness':
        options.hsl = options.hsl ?? {};
        options.hsl.l = requireFloat('--lightness', args[++i]);
        if (options.hsl.l < -100 || options.hsl.l > 100) fail('--lightness must be between -100 and 100');
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
  --hue <number>              Hue shift (-180 to 180)
  --saturation <number>       Saturation shift (-100 to 100)
  --lightness <number>        Lightness shift (-100 to 100)
  --out, -o <path>            Output file path
  --out-dir <dir>             Output directory
  --ogp-config <path>         Render OGP image from config JSON file
  --ogp-editor-config <path>  Render OGP editor config JSON file
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

function extractOutputFlags(args: string[], excludeIdx: number): { outPath?: string; outDir?: string } {
  const flagArgs = args.filter((_, i) => i !== excludeIdx && i !== excludeIdx + 1);
  let outPath: string | undefined;
  let outDir: string | undefined;
  for (let i = 0; i < flagArgs.length; i++) {
    if ((flagArgs[i] === '--out' || flagArgs[i] === '-o') && flagArgs[i + 1]) outPath = flagArgs[++i];
    else if (flagArgs[i] === '--out-dir' && flagArgs[i + 1]) outDir = flagArgs[++i];
  }
  return { outPath, outDir };
}

async function main() {
  const args = process.argv.slice(2);

  // Handle --ogp-config mode (early exit, no positional slug required)
  const ogpConfigIdx = args.indexOf('--ogp-config');
  if (ogpConfigIdx !== -1) {
    const configPath = args[ogpConfigIdx + 1];
    if (!configPath || configPath.startsWith('-')) fail('--ogp-config requires a file path');

    const jsonStr = readFileSync(resolve(configPath), 'utf-8');
    const config = parseOgpConfig(jsonStr);
    const result = await renderOgpFromConfig(config);

    const { outPath, outDir } = extractOutputFlags(args, ogpConfigIdx);
    const outputPath = outPath ?? resolve(outDir ?? process.cwd(), `ogp-${config.type}-${config.slug}.png`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.buffer);
    console.log(`Generated OGP: ${outputPath} (${result.patternName}, ${result.colorSchemeName}, ${result.width}x${result.height})`);
    return;
  }

  // Handle --ogp-editor-config mode (early exit, no positional slug required)
  const editorConfigIdx = args.indexOf('--ogp-editor-config');
  if (editorConfigIdx !== -1) {
    const configPath = args[editorConfigIdx + 1];
    if (!configPath || configPath.startsWith('-')) fail('--ogp-editor-config requires a file path');

    const jsonStr = readFileSync(resolve(configPath), 'utf-8');
    const config = parseOgpEditorConfig(jsonStr);
    const result = await renderOgpEditorFromConfig(config);

    const { outPath, outDir } = extractOutputFlags(args, editorConfigIdx);
    const outputPath = outPath ?? resolve(outDir ?? process.cwd(), `ogp-editor-${config.background.type}-${config.background.slug}.png`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.buffer);
    console.log(`Generated OGP Editor: ${outputPath} (${result.patternName}, ${result.width}x${result.height})`);
    return;
  }

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
