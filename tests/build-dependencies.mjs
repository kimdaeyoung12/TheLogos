import assert from 'node:assert/strict';
import test from 'node:test';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

test('updated CSS dependencies preserve Tailwind 3 utilities and vendor prefixes', async () => {
  const result = await postcss([
    tailwindcss({
      content: [{ raw: '<div class="flex p-4 hover:underline"></div>', extension: 'html' }],
      corePlugins: { preflight: false },
    }),
    autoprefixer({ overrideBrowserslist: ['Safari 12'] }),
  ]).process('@tailwind utilities; .select { user-select: none; }', { from: undefined });
  assert.match(result.css, /display:\s*flex/);
  assert.match(result.css, /padding:\s*1rem/);
  assert.match(result.css, /text-decoration-line:\s*underline/);
  assert.match(result.css, /-webkit-user-select:\s*none/);
  assert.equal(result.warnings().length, 0);
});
