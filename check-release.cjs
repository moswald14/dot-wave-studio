'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const root = __dirname;
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Studio needs a numeric release version.');
const filename = `Dot-Wave-Studio-${version}.html`;
const temporaryRoot = fs.realpathSync(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'dot-wave-release-'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

try {
  const build = spawnSync(process.execPath, [path.join(root, 'build.cjs'), temporary], {
    cwd: root, stdio: 'inherit', timeout: 120000
  });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`Studio build failed (${build.status ?? build.signal}).`);
  const built = fs.readFileSync(path.join(temporary, filename));
  const released = fs.readFileSync(path.join(root, 'releases', filename));
  if (!built.equals(released)) {
    throw new Error(`${filename} is out of date. Rebuild Studio and update the file in releases/.`);
  }
  for (const name of ['Dot-Wave-Classic.html', 'Third-party-notices.txt']) {
    if (!fs.readFileSync(path.join(root, name)).equals(fs.readFileSync(path.join(temporary, name)))) {
      throw new Error(`The build did not preserve ${name}.`);
    }
  }
  for (const name of fs.readdirSync(path.join(root, 'sample-credits'))) {
    if (!fs.readFileSync(path.join(root, 'sample-credits', name)).equals(fs.readFileSync(path.join(temporary, 'Sample-credits', name)))) {
      throw new Error(`The build did not preserve sample credit ${name}.`);
    }
  }
  console.log(`PASS downloadable Studio ${version} matches a clean build (${built.length} bytes).`);
  console.log(`SHA-256 ${digest(built)}`);
} finally {
  const absolute = path.resolve(temporary);
  if (path.dirname(absolute) !== temporaryRoot || !path.basename(absolute).startsWith('dot-wave-release-')) {
    throw new Error('Refusing to remove a directory outside the temporary build location.');
  }
  fs.rmSync(absolute, {recursive: true, force: true});
}
