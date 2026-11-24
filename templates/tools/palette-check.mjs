#!/usr/bin/env node
//
// Palette check: proves a chart palette is readable, from the project's real
// CSS custom properties, in every theme.
//
// For each theme in tools/palette.json it reads the variables the theme's
// selectors set (repeated blocks merge in order, var() resolves, comments are
// ignored) and fails when:
// - a variable the palette names does not exist, or its color cannot be read;
// - two series have the same color;
// - a series has less than "minContrast" (3:1 by default, the graphics floor)
//   against any surface;
// - two series are closer than "minDeltaE" in OKLab (×100), for every pair,
//   not just neighbors: a legend pairs any two;
// - under simulated color blindness (protanopia, deuteranopia, tritanopia),
//   two series are closer than "failDeltaECvd". Between that and
//   "minDeltaECvd" it warns: pair those series with a pattern or a label.
//
// Usage: node tools/palette-check.mjs     Exit 1 on a failure, 2 when it cannot
// run (palette.json or a CSS file missing or broken).
// No dependencies beyond Node.js 20.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(scriptFile), "..");

// The custom properties each selector sets, from the innermost CSS blocks.
export function readVariables(css) {
  const blocks = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((selector) => selector.trim().replace(/\s+/g, " "));
    const values = {};
    for (const declaration of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) values[declaration[1]] = declaration[2].trim();
    blocks.push({ selectors, values });
  }
  return blocks;
}

export function themeVariables(blocks, selectors) {
  const variables = {};
  for (const block of blocks) {
    if (block.selectors.some((selector) => selectors.includes(selector))) Object.assign(variables, block.values);
  }
  return variables;
}

export function resolve(value, variables, depth = 0) {
  if (depth > 20) return null;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
    if (variables[name] !== undefined) return resolve(variables[name], variables, depth + 1) ?? "";
    return fallback !== undefined ? fallback.trim() : `__missing(${name})`;
  });
}

// sRGB 0..1 from a CSS color: #rgb, #rrggbb, #rrggbbaa, rgb(), hsl().
export function parseColor(text) {
  const value = text.trim().toLowerCase();
  let hex = /^#([0-9a-f]{3,8})$/.exec(value)?.[1];
  if (hex) {
    if (hex.length <= 4) hex = [...hex].map((char) => char + char).join("");
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(value);
  if (rgb) return rgb.slice(1, 4).map((part) => (part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / 255));
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(value);
  if (hsl) {
    const [h, s, l] = [parseFloat(hsl[1]) / 360, parseFloat(hsl[2]) / 100, parseFloat(hsl[3]) / 100];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
      const x = ((t % 1) + 1) % 1;
      return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    };
    return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
  }
  return null;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function contrast(a, b) {
  const luminance = (rgb) => {
    const [r, g, bl] = rgb.map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function oklab(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// OKLab distance, scaled ×100 (about 2 is barely visible, 15 clearly apart).
export function deltaE(a, b) {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
}

// Full-severity color blindness, applied in linear RGB (Machado et al., 2009).
const deficiencies = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

export function simulate(rgb, kind) {
  const linear = rgb.map(toLinear);
  return deficiencies[kind].map((row) => toGamma(Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]))));
}

export function checkTheme(name, variables, settings) {
  const failures = [];
  const warnings = [];
  const color = (variable) => {
    if (variables[variable] === undefined) {
      failures.push(`${name}: ${variable} is not set`);
      return null;
    }
    const resolved = resolve(variables[variable], variables);
    const missing = /__missing\((--[\w-]+)\)/.exec(resolved ?? "");
    if (missing) {
      failures.push(`${name}: ${variable} uses ${missing[1]}, which is not set`);
      return null;
    }
    const parsed = parseColor(resolved ?? "");
    if (!parsed) failures.push(`${name}: ${variable} is "${resolved}", a color this check cannot read (use hex, rgb(), or hsl())`);
    return parsed;
  };
  const series = (settings.series ?? []).map((variable) => ({ variable, rgb: color(variable) })).filter((item) => item.rgb);
  const surfaces = (settings.surfaces ?? []).map((variable) => ({ variable, rgb: color(variable) })).filter((item) => item.rgb);

  for (const item of series) {
    for (const surface of surfaces) {
      const ratio = contrast(item.rgb, surface.rgb);
      if (ratio < (settings.minContrast ?? 3)) failures.push(`${name}: ${item.variable} on ${surface.variable} is ${ratio.toFixed(2)}:1, under ${settings.minContrast ?? 3}:1`);
    }
  }
  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const [a, b] = [series[i], series[j]];
      const distance = deltaE(a.rgb, b.rgb);
      if (distance < 0.5) {
        failures.push(`${name}: ${a.variable} and ${b.variable} are the same color`);
        continue;
      }
      if (distance < (settings.minDeltaE ?? 15)) failures.push(`${name}: ${a.variable} and ${b.variable} are ${distance.toFixed(1)} apart, under ${settings.minDeltaE ?? 15}`);
      for (const kind of Object.keys(deficiencies)) {
        const seen = deltaE(simulate(a.rgb, kind), simulate(b.rgb, kind));
        if (seen < (settings.failDeltaECvd ?? 6)) failures.push(`${name}: with ${kind}, ${a.variable} and ${b.variable} look the same (${seen.toFixed(1)} apart)`);
        else if (seen < (settings.minDeltaECvd ?? 8)) warnings.push(`${name}: with ${kind}, ${a.variable} and ${b.variable} are close (${seen.toFixed(1)}); add a pattern or a direct label`);
      }
    }
  }
  return { failures, warnings };
}

function main() {
  const settings = JSON.parse(readFileSync(path.join(path.dirname(scriptFile), "palette.json"), "utf8"));
  const css = (settings.css ?? []).map((file) => readFileSync(path.resolve(projectDirectory, file), "utf8")).join("\n");
  const blocks = readVariables(css);
  const failures = [];
  const warnings = [];
  for (const [theme, selectors] of Object.entries(settings.themes ?? {})) {
    const result = checkTheme(theme, themeVariables(blocks, [selectors].flat()), settings);
    failures.push(...result.failures);
    warnings.push(...result.warnings);
  }
  for (const warning of warnings) console.log(`warning: ${warning}`);
  if (failures.length === 0) {
    console.log(`palette-check: ${(settings.series ?? []).length} series readable in ${Object.keys(settings.themes ?? {}).length} theme(s).`);
    return 0;
  }
  console.error(`palette-check: ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  return 1;
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(scriptFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`palette-check: ${error.message}`);
    process.exitCode = 2; // Exit 1 means the check failed; 2 means it could not run.
  }
}
