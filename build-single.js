// Bundles index.html + styles.css + js/*.js into one self-contained file:
//   aymora-weekly-match.html  (full HTML document, opens offline)
//   artifact.html             (body-only version for hosted previews)
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`);
html = html.replace(/<script src="([\w-]+\.js)"><\/script>/g, (_, f) => `<script>\n${read(f)}\n</script>`);

fs.writeFileSync(path.join(root, 'aymora-weekly-match.html'), html);

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
fs.writeFileSync(path.join(root, 'artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('Built aymora-weekly-match.html and artifact.html');
