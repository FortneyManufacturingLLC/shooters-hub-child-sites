# Provider contract — draft version 1

This is an integration boundary, not a claim that every listed capability is available today.

## Working starter read contract

The Node adapter performs `GET <server-configured origin>/api/site`. The origin and optional bearer credential never come from browser parameters. The gateway must bind community and series server-side, enforce visibility/deletion/publication policy, and return authorized public projections. Theme metadata and starter DTO checks are not authorization controls.

```json
{
  "series": {"id": "your-series-id", "title": "Series title", "shortDescription": "Public description", "sponsors": []},
  "matches": [],
  "source": {"partial": false, "updatedAt": "2026-11-01T00:00:00Z"}
}
```

A match exposes `id`, `title`, `start` (ISO date or offset-bearing timestamp), `timeTbd`, `location` and `status`. Sponsors expose `name`, `displayLabel` and HTTPS `website`. Private owner, account, financial and raw database fields are not forwarded. A different series identity is rejected. Missing data stays missing.

## Future provider ports

`readEntity`, `readPublicProfile`, `readHelp`, `getSession`, `signIn`, `signOut`, `readNotifications` and `readMessages` are interface names only. Implementations belong to the relevant product integration. Entity renderers should consume the same reviewed projection/components as the parent Hub rather than cloning screens into each theme. Community and discipline capabilities determine available sections.

A session identity grants no cross-community visibility. Messages and notifications must be recipient-authorized, community-scoped and privately cached. Never infer profile identity from a competitor display name.

## Rendering ownership

The public framework owns shell/navigation contracts and generic controls. The community pack owns terminology and permitted features. The provider owns canonical entities and permissions. Themes own presentation; no executable entity-slot plugin API is promised in 0.1.

Do not import private Fortney packages into the public starter. Future extraction requires licensing/API review and a compatibility release. Existing private theme, site-runtime and entity infrastructure should be adapted, not rebuilt here.
