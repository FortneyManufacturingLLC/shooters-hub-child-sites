# Shared membership administration

The starter's **Members** workspace uses the same portable view/controller shipped by the Jackalope child site. It displays a canonical season's roster, private questionnaire answers, page filters and formula-safe CSV export. It does not maintain a second membership database.

Before the module runs, a server-backed host can provide `window.HubMembershipAdmin = {config, host, hubOrigin}`. `config` is presentation metadata `{enrollmentEnabled, issuerType:'season', issuerId}`; changing it never authorizes a read. `host` supplies:

- `ready`: promise resolved when sign-in state is known.
- `session()`: current `{uid, generation}`. Increment generation for account changes, including sign-out then sign-in.
- `isCurrent(owner)`: checks both UID and generation against current authenticated state.
- `subscribeActor(listener)`: notifies account transitions so private information clears immediately.
- `request(path)`: authenticated GET, private/no-store, bound to the expected visible actor before token lookup, before dispatch and after response.

`createStarterServer` accepts an optional `membershipAdminService.read({authorization, afterId})` host port. The starter rejects missing bearer tokens, scope overrides and writes before calling this port; all responses use private/no-store. The service must perform the authoritative checks and sanitized projection below, returning `{status,data}`. Without this service, the route returns503.

The view requests only `/api/admin/memberships` with an optional `afterId` cursor. The server must independently bind the configured canonical season to this child site's community/series, verify current issuer-manager authority on every request, and return at most25 responses (1MiB maximum). Do not trust browser issuer IDs, `canManage` flags, public page visibility or cached responses as authority. Do not expose this route through a public data adapter.

Response contract:

```js
{issuerType:'season', issuerId, program:null /* or sanitized current program */,
 responses:[{enrollmentId,userId,displayName,revision,programRevision,joinedAt,
 expiresAt:null,status,form:{title,description,fields:[]},answers:[]}], nextCursor:null}
```

Each response carries its original questionnaire, independently of the current program. Question columns are keyed by program revision and field ID. Filter controls and CSV export apply to the current page only; exports perform a new protected read. Account changes and failed reads clear private page state. Names, labels and answers are rendered as text; CSV cells are quoted and formula-prefixed inputs escaped.

Program configuration, questionnaire changes and membership decisions link to the canonical Hub route `/seasons/:id/memberships`, where Hub permissions apply again. This route must be deployed by the Hub host before enabling that link in a child deployment. The starter remains visibly unconfigured when no host integration is supplied. No service credentials or private member data belong in generated static files.

For the initial Jackalope implementation, enrollment remains gated. Membership is issued by the canonical2027 Season to the canonical shooter UID. Unknown season dates remain unspecified; match eligibility follows explicit season association. Match plans, RO interest, registration and giveaways are separate.
