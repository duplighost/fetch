# FETCH

- Source: this folder (GitHub duplighost/fetch, branch main). Run: `node serve.mjs 8711`.
  Debug hook: `window.__FETCH`.
- Nothing deploys from here. The site keeps its own copy of `src/` under
  qualiacology/fetch/: to ship, copy the changed `src/` files there (keep the site's own
  index.html, which carries the site shell), then follow the site repo's AGENTS.md.
- The suites in `tests/` need this machine's GPU. Run only the one your change touches.
