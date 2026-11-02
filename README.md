# Shooters Hub child sites

An open-source starting point for branded Hub child sites, with separate parent and child themes. MIT-licensed code; no private platform packages, production credentials, customer records, or third-party brand artwork are included.

**Status: 0.1 pilot.** The starter runs today with a read-only gateway. Shared results controls and date utilities are extracted and usable. Full canonical Hub entity pages, authentication/session integration, notifications, messaging, administration and MatchOps are provider integrations still to be extracted. Jackalope is the first migration pilot, not a second source of competition data.

## Run locally

Requires Node.js 22 or newer and Git. There are no runtime npm dependencies or private package registry requirements.

```sh
git clone https://github.com/FortneyManufacturingLLC/shooters-hub-child-sites.git
git clone https://github.com/FortneyManufacturingLLC/shooters-hub-theme-classic.git
git clone https://github.com/FortneyManufacturingLLC/shooters-hub-theme-jackalope.git
cd shooters-hub-child-sites
npm test
npm run build -- --site site.example.json --theme ../shooters-hub-theme-classic --theme ../shooters-hub-theme-jackalope
npm start
```

Open `http://localhost:8768`. Without a gateway the site shows an honest connection/setup state, not demonstration competitors or matches. Copy `site.example.json` to your own configuration and replace the series binding, title and origins. Site JSON is public; never put credentials in it. The sample grants no access to any real series.

Configure the server environment before starting:

| Variable | Purpose |
| --- | --- |
| `HUB_GATEWAY_ORIGIN` | Approved HTTPS gateway serving the public, fixed-scope `/api/site` contract |
| `HUB_GATEWAY_TOKEN` | Optional server-only credential issued by that gateway operator |
| `PORT` | Server port; defaults to 8768 |

`.env.example` documents names; the server does not automatically load `.env`. Use your host's environment settings or a supported Node environment-file option. Credentials are not written to `dist`.

## Themes and child themes

The [Classic theme](https://github.com/FortneyManufacturingLLC/shooters-hub-theme-classic) is a reusable parent. The [Jackalope theme](https://github.com/FortneyManufacturingLLC/shooters-hub-theme-jackalope) extends it. Each has its own repository, manifest, CSS, version and license. Pass parent themes before children; the compiler rejects a missing/mismatched parent and duplicate IDs. Pin reviewed commit SHAs in deployments rather than following mutable branches.

Precedence is framework defaults → parent → child → optional `themeTokens` in deployment configuration. Public site identity is separate configuration. Brand asset bindings are validated but automatic asset copying/rendering is not implemented in this pilot; the running Jackalope deployment still supplies its own artwork through its existing integration. The compiler accepts presentation settings only: a theme cannot change community identity, series scope, authentication policy or authorization. CSS is trusted presentation code, not a sandbox; review third-party themes before use.

The starter supports a header/rail choice and theme tokens. This is a small manifest adapter, **not a replacement for Fortney's existing theme or site-runtime systems**. See [the provider contract](docs/provider-contract.md) for canonical component integration plans.

## Hosting

### Node, container or managed service

Run `npm run build` using pinned theme versions, then `npm start` with server environment variables. The included Dockerfile runs the already-built public output on Node 22. Build `dist` first; it is deliberately not committed. Keep gateway credentials in the host's secret manager. Route HTTPS traffic to the container port and use independent validation and production configuration.

### Firebase Hosting with Cloud Run

1. Build the starter and container from a reviewed commit.
2. Deploy the container to your own Cloud Run service with server-side gateway configuration.
3. Serve `dist` from Firebase Hosting and rewrite `/api/**` to that service.
4. Set a restrictive CSP, HTTPS domain and current TLS certificate. The Node server supplies baseline security headers; configure equivalent headers on static hosting.
5. Deploy validation first. Verify data scope and any sign-in integration before production promotion.

### Other static hosting

Upload `dist`, but supply a same-origin server/serverless `/api/site` handler backed by an approved gateway. Static files alone cannot safely hold a server credential. Do not add a browser-configurable arbitrary upstream proxy. The starter currently links to the configured Hub for entity details, so no catch-all SPA rewrite is required.

## What stays closed

The actual Hub APIs, authentication/authorization enforcement, tenancy policy, admin implementation, private infrastructure packages and MatchOps engines remain provider-owned. This repository publishes interfaces and presentation utilities, not authority to access private records. Real integrations need an approved gateway/deployment agreement. Public authentication UI or client interfaces do not require exposing authentication servers or secrets.

## Competition Hub direction

Shooters Hub and a distinct Tractor Pullers Hub could share competition infrastructure while keeping community data and discipline rules separate. This does not rename or migrate existing production services. Read [the boundary decision](docs/competition-hub-boundary.md) and [migration plan](docs/migration-plan.md).

## Contributing and verification

Run `npm test` and `npm run build`. Tests cover theme inheritance, forbidden security overrides, series identity, safe URLs, results sorting/CSV, and date-only/time-zone behavior. UI changes need desktop/mobile and keyboard checks. Do not submit credentials, production exports, private packages or unlicensed brand assets. See [SECURITY.md](SECURITY.md).

## Site administration
Open `/admin` when running the Node starter. The theme-aware configuration editor provides a preview, public connection status, immutable scope summary, and validated `site.json` download. Rebuild with that configuration and your pinned themes, then deploy to publish. Drafts stay in the current tab; they are not automatically saved.

This is a public presentation configuration editor, not an authenticated CMS. It cannot change Hub data, users, permissions, provider credentials, or deployment scope. Static-only hosting can serve the interface at `/admin.html`, but download validation requires the Node server endpoint. Live publishing and protected admin operations require an authenticated provider; see [admin boundaries](docs/admin.md).


### Homepage composition and theme switching
Build with your pinned parent/child `--theme` directories, then open `/admin`. Choose an installed chain prefix, adjust navigation/spacing and colors, reorder or hide homepage sections, save/restore a browser draft, and preview the actual homepage before downloading configuration. Rebuild with `--site site.json` and the same pinned themes to apply it. This is presentation authoring, not live publishing or shared entity mutation. The portable versioned layout module is available at `@competition-hub/child-sites/page-composition`; see [admin integration boundaries](docs/admin.md).
