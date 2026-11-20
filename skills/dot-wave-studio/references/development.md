# Studio source and publication

Inspect the actual checkout version, local instructions and Git changes before changing the program. This skill supports development when the user asks for program changes; a music-composition request does not itself request a release.

Main boundaries:

- `core.js`: project validation, migration, patterns, sound capture and rendering entry points.
- `dsp/`: shared pure audio models. Vocal pronunciation data is loaded in the main page; saved notes already contain phonemes so the audio worker does not need the dictionary.
- `app.js`, `woof-ui.js`, `vocals-ui.js`, `capture-ui.js`: visible workflow and controllers.
- `capture-tools.js` and `dsp/hum-*.js`: reviewed single-voice pitch extraction, atomic note insertion and cycle shaping; shared by browser and worker.
- `studio-ideas.js` and `dsp/doodle-jazz.js`: seeded Doodle Jazz music, random ideas and validation of AI note sketches.
- `market-wave.js` and `market-ui.js`: explicit 24-hour chart or CSV selection, audio-cycle conversion and Wave A/B handoff. Keeper allows the market origins on the Studio page.
- `audio.js`: browser audio, pending render cancellation, finite previews and patch keys.
- `build.cjs`: self-contained HTML and worker, including both JavaScript and CSS dependencies.
- `storage.js`: browser drafts and personal voice banks, separate from public release assets.

Use the repository's checks. Current commands:

```text
npm test
node build.cjs
node check-release.cjs
node pages-verify.cjs
```

The release checker compares a clean build with `releases/Dot-Wave-Studio-<package-version>.html`. After source changes, rebuild and update the new release file before running it. Retain earlier downloadable releases when possible. Run the relevant module checks while developing; use fresh complete results before reporting completion.

Test visible editing and downloads in an isolated localhost session or a saved copy. Do not seed test songs into the user's only live draft. Reload the page after a non-hot-reloading build change. Preserve existing saved projects, old sounds and recorded voice banks; an optional new field should default to the older behavior when absent.

Public repository: https://github.com/moswald14/dot-wave-studio. GitHub Pages: https://moswald14.github.io/dot-wave-studio/. Main-branch Actions verify the program and publish a small allowlisted website package. Ordinary publication should include source, examples without personal recordings, licenses and the new release; exclude live drafts, voice banks, credentials and local session exports. `build-pages.cjs` refuses a nonempty staging directory rather than publishing arbitrary extra files.

`python package-release.py --out <new.zip>` builds a deterministic, verified download with the offline app, Classic, full corresponding source, notices, examples and this skill. It refuses existing output files. Keeper has its own importer and same-origin worker, relative Classic URL, Telephone bridge and match privacy restrictions; update its canonical source and generated Home Assistant copy together.

When publication is authorized, follow the existing repository workflow. Verify the actual deployed page/version and compare live HTML with the release; a successful build alone is insufficient. Treat the itch.io edition and any Home Assistant integration as separate destinations. Return to the Studio after release verification.
