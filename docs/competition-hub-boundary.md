# CompetitionHub and child-site boundaries

Status: accepted architectural direction; implementation is incremental. This decision does not assert that CompetitionHub, a tractor-pulling product, or shared Hub entity components have already been extracted.

## Decision

Use existing Fortney infrastructure beneath a private CompetitionHub competition-domain kernel. Build Shooters Hub and a future Tractor Pullers Hub as distinct community/product packs. Publish a small child-site runtime, provider/client contracts, and separately maintained themes. Keep deployment configuration and privileged services private.

The child-site framework starts as an extraction and pilot of the existing child-site experience. It is not a new implementation of the Hub backend and is not yet a shared rendering layer for the full Hub application.

| Layer | Responsibility | Distribution boundary |
| --- | --- | --- |
| Fortney infrastructure | Existing identity, data, media, community, search, delivery, and UI primitives | Existing package ownership and licenses; no automatic republication |
| CompetitionHub kernel | Competition lifecycle and authority: events, entries, rounds, attempts, result revisions and publication | Private service/domain implementation |
| Community/product packs | Community policy, vocabulary, workflows, discipline capabilities and product integrations | Private product implementation; selected public presentation contracts |
| Child-site runtime and contracts | Render allowed projections; navigation, accessible UI, presentation state and provider ports | Open source after publication review |
| Parent themes and child themes | Typography, colors, layout, accessible components and licensed assets | Separate open-source repositories with explicit asset licenses |
| Deployment configuration | Trusted site/community/tenant mapping, provider wiring, credentials and environment policy | Private deployment repositories or secret/config services |

Dependency direction runs from products toward the infrastructure they use. The public runtime depends on public contracts, not on private server packages. A private adapter implements its provider ports; it does not expose database or service internals to the theme.

## Reuse before extraction

The existing package inventory already includes these relevant families:

| Need | Existing package examples to evaluate first |
| --- | --- |
| Persistence and projections | `data-core`, `data-server`, `data-client`, `data-contracts`, `data-projections`, `data-bundles`, `data-entity-registry` |
| Media and publication | `media-core`, `media-server`, `media-contracts`, `media-client`, `media-react` |
| Identity and policy | `identity-core`, `auth`, `security`, `eligibility-core`, `privacy-lifecycle`, `moderation-core` |
| Community and engagement | `community-core`, `community-client`, `engagement-core`, `notifications-core`, `sponsorship-core` |
| Discovery and synchronization | `search-engine`, `search-indexing`, `search-adapters`, `offline-sync`, `offline-native` |
| Application presentation | `app-runtime`, `app-shell`, `site-runtime`, `theme`, `entity-ui`, `entity-blocks`, `finder-ui` |
| Existing shooting competition behavior | `shooters-scoring`, `domain-shooters`; Hub-owned `match-ops-core` and product projection/policy packages |

These names establish an inventory, not a compatibility or licensing guarantee. Assess the relevant exports and ownership before introducing a new dependency. An npm manifest's publication flag is not an open-source license grant. Do not copy proprietary package implementation into the public framework.

CompetitionHub must use these capabilities through their existing boundaries. Do not create parallel account stores, media pipelines, relationship engines, search indexes, offline journals, bundle generation systems, or general theme engines merely to support child sites. A narrow child-site adapter or theme contract is acceptable when it translates existing capabilities rather than replacing their authority.

## Competition concepts and discipline plugins

The proposed kernel has a small shared vocabulary:

- An **event** identifies a competition and its lifecycle, organizer and venue references.
- An **entry** records participation of an authorized competitor, team or machine under that event's rules.
- A **round** groups competition activity without assuming a shooting stage or a tractor-pulling class.
- An **attempt** identifies a recorded performance with evidence and revision references; it does not prescribe measurements.
- A **result** is a versioned output from a named ruleset/plugin, with provenance and publication state.

Shared identity and lifecycle do not imply shared scoring. MatchOps orchestrates discipline-specific operations through typed plugin boundaries. Shooting plugins may model stages, hits, points, times, penalties and divisions. Tractor-pulling plugins may model classes, machine eligibility, measured distance, attempt eligibility and pull-offs. Exact scoring, rank order, ties, penalties, units, precision and official approval rules belong to the selected discipline and ruleset version.

The kernel must not assume that higher values always win, every attempt is a shot, every round is a stage, or every competitor is an individual person. A plugin emits validated result projections with explicit labels, units, source ranks and lifecycle. Public clients display those projections; they never compute official standings or turn provisional outputs into approved results.

The plugin interface and its schema must be deliberately reviewed before extraction. This ADR does not introduce a universal untyped metadata bag or authorize moving existing scoring engines.

## Community isolation, identity and branding

Shooters Hub and Tractor Pullers Hub are separate communities even if they share infrastructure or a future parent product. Community membership, moderation, visibility, discoverability and permissions remain explicit.

Branding is presentation. Tenancy is an enforcement boundary. A domain, logo, theme, series or club does not automatically create a tenant, and a shared theme does not combine tenants. A deployment maps a site to trusted community and tenant scopes on the server. A browser cannot choose a broader scope by editing a URL or configuration payload.

Identity federation is optional. An account may bind identities across participating products only under explicit federation policy. Federation does not create a universal public directory, transfer community membership, or merge public profiles.

In particular, no relationship or capability crosses community boundaries implicitly:

- A follow in one community does not subscribe the person in another.
- Direct-message eligibility and recipient discovery require the destination community's policy.
- Search uses that community's approved public index/projection and scope.
- Ratings remain attached to their declared discipline, ruleset and scope; they are not interchangeable reputation or global rank.
- Profile publication, minor protections, blocks, moderation and removals remain enforced by the owning service.

Cross-community features need an explicit contract, authorization and privacy review, user-facing semantics and independent tests. Shared actor IDs alone are insufficient.

## Public contracts and private authority

Public interfaces may describe published events, venues, series, approved results, permitted profile summaries, request states, pagination and provenance. Public client ports may describe sign-in handoff or authorized commands. Publishing an interface does not publish or delegate its enforcement.

Private services retain API implementations, authorization, credential verification, membership checks, administration, moderation, scoring authorities, import pipelines, publication decisions and database access. An optional public reference provider may serve synthetic fixtures; it must be visibly separate from production adapters.

Provider responses must distinguish published-empty, unpublished, withheld, partial and unavailable states. Missing metrics stay missing; clients must not invent zero results or infer identity by matching display names. An opaque public result-row ID does not authorize resolving a person. Public profile data must come from the owning service's current public projection, including its privacy and removal policy.

Server adapters constrain upstream origins and resource scope, bound requests and payloads, refuse unsafe redirects and avoid forwarding caller credentials to public reads. Personalized reads and commands use explicit authenticated ports with server-side authorization; they are never implemented by adding a token to a theme setting. Cache and invalidation policy follows the sensitivity of each projection, including no-store behavior where current privacy is required.

The public framework can enforce contract shape and safe rendering. These checks supplement server authority and never replace it. A self-hosted fork does not gain access to private services or source merely by implementing the public interfaces.

## Theme inheritance

Resolve allowed presentation values in this order:

1. Core accessible defaults.
2. Parent theme.
3. Child theme.
4. Validated site presentation configuration.

Later layers override only declared presentation fields. Security headers, auth providers, trusted origins, tenant/community bindings, API scopes, privacy gates, moderation, scoring and administrative capabilities are outside this override tree. Unknown fields fail validation rather than becoming arbitrary runtime hooks.

The manifest adapter compiles core defaults, parent theme, child theme and validated deployment `themeTokens`. Its public site configuration carries identity and optional local asset paths; the starter does not yet copy or render those brand assets. This small adapter is not a replacement for existing Fortney theme or site-runtime infrastructure.

Keep parent themes and child themes in separate repositories with versioned compatibility declarations. Prefer tokens, styles, documented component slots and licensed assets to forks of runtime logic. Do not load arbitrary remote executable theme code from user-editable configuration. Review and pin any executable component extension as code with the same access limits as the public client.

## Consequences and limits

The first child site can become reusable without forcing a broad Hub refactor. More than one sport can share competition lifecycle concepts without sharing incompatible scoring or community permissions. Theme authors can work publicly while server policy and operations remain private.

The cost is explicit contracts, adapter maintenance and compatibility testing. Existing Hub packages and components are reuse candidates, not assumed drop-in dependencies. Extract them only when a specific consumer and acceptance tests establish the benefit.

No repository publication, deployment, license change, credential migration, identity merger or production data migration is authorized by this document. Implementation proceeds through the gates in [the migration plan](migration-plan.md).
