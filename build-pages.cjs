'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function stage(output) {
  const root = __dirname;
  const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Studio needs a numeric release version.');
  const files = new Map([
    ['index.html', fs.readFileSync(path.join(root, 'releases', `Dot-Wave-Studio-${version}.html`))],
    ['Dot-Wave-Classic.html', fs.readFileSync(path.join(root, 'Dot-Wave-Classic.html'))],
    ['Third-party-notices.txt', fs.readFileSync(path.join(root, 'Third-party-notices.txt'))],
    ['.nojekyll', Buffer.alloc(0)]
  ]);
  for (const entry of fs.readdirSync(path.join(root, 'sample-credits'), {withFileTypes:true})) {
    if (!entry.isFile()) throw new Error('Sample credits must contain regular files.');
    files.set(`Sample-credits/${entry.name}`, fs.readFileSync(path.join(root, 'sample-credits', entry.name)));
  }
  output = path.resolve(output);
  if (fs.existsSync(output) && fs.readdirSync(output).length) {
    throw new Error('Use an empty output folder for the Pages build; existing files will not be overwritten or published.');
  }
  for (const [name, bytes] of files) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, bytes);
  }
  return {version, files:files.size, htmlSha256:crypto.createHash('sha256').update(files.get('index.html')).digest('hex')};
}

module.exports = {stage};
if (require.main === module) console.log(JSON.stringify(stage(process.argv[2] || path.join(__dirname, 'pages-site')), null, 2));
