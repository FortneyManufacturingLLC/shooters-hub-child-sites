# Local admin configuration drafts

The admin configuration editor prepares a local draft and downloads a validated site configuration. It does not authenticate an administrator, save to the running site, or grant permissions. The public gateway currently supports GET requests only. Downloading a draft does not deploy it; a deployment owner must review the exported configuration and use the existing build/deployment process.

`validateAdminDraft(base, patch)` in `src/admin.mjs` returns a complete configuration accepted by `validateSite`. It throws a validation error on invalid input. The base is the deployment's configured site, never a client-selected tenant. Both inputs remain unchanged, and returned brand/token objects are independent copies.

Only `title`, `timeZone`, `brand`, and `themeTokens` may appear in the patch. Omitted fields retain their base values. Supplied `brand` and `themeTokens` objects replace the corresponding objects; `{}` clears the overrides. Brand fields are limited to `logoPath` and `heroPath`, using local `/assets/` paths without traversal, query strings, or external origins. This validation checks path syntax, not whether an asset exists. Theme values use the shared safe CSS token validator. Known credential field names are rejected; the configuration and export are public data, so never put secrets in any presentation value.

`siteId`, `communityId`, `seriesId`, `canonicalOrigin`, and `entityBaseOrigin` are fixed by the deployment. They are rejected in patches even when their values equal the configured values. Unknown fields, permission claims, malformed objects, invalid time zones, and unsafe CSS values fail validation. This allowlist is a draft validation boundary, not a substitute for authorization.

## Future production admin provider

A live admin provider needs a server-authenticated session and server-side authorization for the exact deployment/site/community/series scope on every read and write. The server must derive that binding from trusted deployment and account data, validate the presentation patch again, and reject tenant or origin changes regardless of client UI state. Never treat a hidden button, a client `admin` flag, a theme, or an exported configuration as a grant.

Before enabling saves, implement and verify denied identities and cross-scope attempts as well as allowed identities. Define authenticated read/update operations, CSRF protection where cookie sessions apply, concurrency/version checks, an audit record, and error handling that does not expose credentials. Keep provider secrets on the server. The current draft module intentionally supplies no fake session, role, live save, or production admin authorization implementation.
