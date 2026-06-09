#!/usr/bin/env node
// Inlines the favicon SVG as a base64 data URI into dist-single/index.html
// so the final file is truly self-contained (no external requests).

const fs   = require('fs');
const path = require('path');

const htmlPath    = path.join(__dirname, '..', 'dist-single', 'index.html');
const faviconPath = path.join(__dirname, '..', 'public', 'favicon.svg');

if (!fs.existsSync(htmlPath)) {
  console.error('dist-single/index.html not found – run build:single first');
  process.exit(1);
}

const html    = fs.readFileSync(htmlPath, 'utf8');
const svg     = fs.readFileSync(faviconPath, 'utf8');
const b64     = Buffer.from(svg).toString('base64');
const dataUri = `data:image/svg+xml;base64,${b64}`;

// Replace any <link rel="icon" ...> href with the inlined data URI
const updated = html.replace(
  /(<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["'])[^"']+?(["'][^>]*>)/gi,
  `$1${dataUri}$2`
).replace(
  /(<link[^>]+href=["'])[^"']+?(["'][^>]+rel=["'](?:icon|shortcut icon)["'][^>]*>)/gi,
  `$1${dataUri}$2`
);

if (updated === html) {
  // No existing <link rel="icon"> — inject one into <head>
  const injected = updated.replace('</head>', `  <link rel="icon" type="image/svg+xml" href="${dataUri}">\n</head>`);
  fs.writeFileSync(htmlPath, injected);
} else {
  fs.writeFileSync(htmlPath, updated);
}

console.log('Favicon inlined successfully into dist-single/index.html');
