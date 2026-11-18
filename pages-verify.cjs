'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {stage} = require('./build-pages.cjs');
const temporaryRoot = fs.realpathSync(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'dot-wave-pages-'));
try {
  const output = path.join(temporary, 'site');
  const result = stage(output);
  assert.ok(fs.readFileSync(path.join(output, 'index.html')).equals(fs.readFileSync(path.join(__dirname, 'releases', `Dot-Wave-Studio-${result.version}.html`))));
  assert.ok(fs.readFileSync(path.join(output, 'Dot-Wave-Classic.html')).equals(fs.readFileSync(path.join(__dirname, 'Dot-Wave-Classic.html'))));
  console.log('PASS Pages entry is the complete verified Studio, with Classic at its relative link.');
  const files = fs.readdirSync(output, {recursive:true}).filter(name=>fs.statSync(path.join(output, name)).isFile()).map(name=>name.split(path.sep).join('/')).sort();
  assert.deepEqual(files, ['.nojekyll', 'Dot-Wave-Classic.html', 'Sample-credits/LICENSE.md', 'Sample-credits/README.txt', 'Sample-credits/SAMPLE-PROVENANCE.json', 'Sample-credits/sample-source-info.txt', 'Third-party-notices.txt', 'index.html'].sort());
  for (const name of ['LICENSE.md', 'README.txt', 'SAMPLE-PROVENANCE.json', 'sample-source-info.txt']) {
    assert.ok(fs.readFileSync(path.join(output, 'Sample-credits', name)).equals(fs.readFileSync(path.join(__dirname, 'sample-credits', name))));
  }
  console.log('PASS Only the eight website files are published, including complete sample credits.');
  const canary = path.join(output, 'private-project.studio.json');
  fs.writeFileSync(canary, 'local-only test file');
  assert.throws(()=>stage(output), /Use an empty output folder/);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'local-only test file');
  console.log('PASS A nonempty output folder is rejected without changing its files.');
  console.log('3 Pages package checks passed.');
} finally {
  const absolute = path.resolve(temporary);
  if (path.dirname(absolute) !== temporaryRoot || !path.basename(absolute).startsWith('dot-wave-pages-')) throw new Error('Unexpected temporary Pages folder.');
  fs.rmSync(absolute, {recursive:true, force:true});
}
