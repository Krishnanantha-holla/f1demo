const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axe = require('axe-core');

async function run() {
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error('dist/index.html not found — run `npm run build` first');
    process.exit(2);
  }

  const html = fs.readFileSync(distIndex, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  const { window } = dom;

  // Expose globals expected by axe-core
  global.window = window;
  global.document = window.document;
  global.Node = window.Node;
  global.HTMLElement = window.HTMLElement;
  global.navigator = { userAgent: 'node.js' };

  // Wait briefly for resources to be available
  setTimeout(async () => {
    try {
      const results = await axe.run(window.document);
      const serious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      if (serious.length) {
        console.error('[a11y-jsdom] Serious violations found:');
        console.error(JSON.stringify(serious, null, 2));
        process.exit(1);
      }
      console.log('[a11y-jsdom] No serious accessibility violations.');
      process.exit(0);
    } catch (err) {
      console.error('[a11y-jsdom] Error running axe:', err);
      process.exit(3);
    }
  }, 300);
}

run();
