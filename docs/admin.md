# Local admin configuration drafts

The admin configuration editor prepares a local draft and downloads a validated site configuration. It does not authenticate an administrator, save to the running site, or grant permissions. The public gateway currently supports GET requests only. Downloading a draft does not deploy it; a deployment owner must review the exported configuration and use the existing build/deployment process.

`validateAdminDraft(base, patch)` in `src/admin.mjs` returns a complete configuration accepted by `validateSite`. It throws a validation error on invalid input. The base is the deployment's configured site, never a client-selected tenant. Both inputs remain unchanged, and returned brand/token objects are independent copies.

Only `title`, `timeZone`, `brand`, `themeTokens`, `themeId`, `themeLayout`, and `homePage` may appear in the patch. Omitted fields retain their base values. Supplied `brand` and `themeTokens` objects replace the corresponding objects; `{}` clears the overrides. Brand fields are limited to `logoPath` and `heroPath`, using local `/assets/` paths without traversal, query strings, or external origins. This validation checks path syntax, not whether an asset exists. Theme values use the shared safe CSS token validator. Known credential field names are rejected; the configuration and export are public data, so never put secrets in any presentation value.

`siteId`, `communityId`, `seriesId`, `canonicalOrigin`, and `entityBaseOrigin` are fixed by the deployment. They are rejected in patches even when their values equal the configured values. Unknown fields, permission claims, malformed objects, invalid time zones, and unsafe CSS values fail validation. This allowlist is a draft validation boundary, not a substitute for authorization.

## Future production admin provider

A live admin provider needs a server-authenticated session and server-side authorization for the exact deployment/site/community/series scope on every read and write. The server must derive that binding from trusted deployment and account data, validate the presentation patch again, and reject tenant or origin changes regardless of client UI state. Never treat a hidden button, a client `admin` flag, a theme, or an exported configuration as a grant.

Before enabling saves, implement and verify denied identities and cross-scope attempts as well as allowed identities. Define authenticated read/update operations, CSRF protection where cookie sessions apply, concurrency/version checks, an audit record, and error handling that does not expose credentials. Keep provider secrets on the server. The current draft module intentionally supplies no fake session, role, live save, or production admin authorization implementation.


## Page composition and installed themes
The homepage editor reorders and hides existing Introduction, Matches and Sponsors sections. `homePage` is `{version:1, sections:[{id,visible}]}`: a complete, unique set of registered renderer IDs, with order given by the array. It stores presentation only; no text, HTML, scripts or entity patches. The generic `@competition-hub/child-sites/page-composition` module accepts a host-supplied registry and has no community, database, authentication or UI dependencies.

Build with pinned parent/child theme directories to expose each chain prefix as an installed choice. Core is reserved. `themeId` chooses a compiled entry; `themeLayout` overrides navigation/density and `themeTokens` overrides presentation tokens last. The Node validation route rejects uninstalled themes. Rebuild uses the same selected ID and overrides. This does not download or execute arbitrary themes.

Save browser draft stores validated public configuration in localStorage under site/community/series identity; Restore loads that draft explicitly. Reset returns to deployed settings. Preview uses a same-origin iframe with a conspicuous draft banner and tab-scoped configuration. It uses the actual starter renderer and live public provider; unavailable data stays unavailable. Preview and browser storage do not publish or grant access. Branding paths still reference assets the deployment must supply; asset upload/copy/rendering remains outside this pilot.

## Platform integration boundary
The layout envelope aligns with the current governed Shooters Hub public-page contract, not the older Platform main/side/disabled editor. Register section IDs per host and page type; matching envelope does not mean homepage section IDs are valid on a series page. Canonical entity layout reads/writes must use the existing authorized layout command, expected revision and request ID. Canonical content commands remain separate. Do not write raw `publicPageLayout` or entity content through this draft endpoint.

A future shared Platform UI can host the same registry-driven controls with authenticated load/save adapters. Shooters Hub supplies its existing revision/permission/audit authority; Commerce supplies its own page registry and publishing authority. The open module added here is newly authored; private Platform implementations have not been redistributed. Platform and Commerce have not been upgraded by this release.

The same open entry point exports `mountPageEditor(container, {registry, value, onChange, announce})`, used directly by this admin page. It returns `update(layout)` and `destroy()` for a host/React wrapper. The widget edits only registry-defined visibility and order; hosts retain persistence, confirmation, conflict state, content editing and authorization. Render the container as an ordered list and announce updates through a host-provided live region. This is a shared browser control, not a private product editor copy.
