# Child-site framework migration plan

This is an incremental extraction plan, not a rewrite of Shooters Hub. The initial pilot is the existing Jackalope child-site experience. CompetitionHub and a future Tractor Pullers Hub are architectural targets; they are not represented as completed packages or deployed products.

The governing ownership and security decisions are in [CompetitionHub and child-site boundaries](competition-hub-boundary.md).

## Delivery boundaries

Use separate repositories or equivalent independently reviewed release units for:

- The public child-site runtime, portable contracts, development fixtures and tests.
- Each public parent theme and each child theme, with asset/license manifests and compatibility ranges.
- Private production adapters, environment/tenant/community bindings and deployment configuration.
- Existing Fortney infrastructure and private Hub/domain services, maintained through their established release processes.

Repository names alone do not establish tenancy, licensing, package extraction or production readiness. Pin compatible versions and record the exact runtime, theme, adapter and configuration inputs for each deployment. Keep one release owner per environment and reuse the same verification evidence for unchanged inputs.

## Phase 1: extract a small reference runtime

Start with the child site's proven public behavior: site shell, navigation, event/series/venue views, rules, published standings/results, public profile presentation, source-status handling and theme hooks. Keep authentication handoffs behind interfaces. Preserve the existing content and operating routes during the pilot.

Move only code and assets whose redistribution rights have been checked. Rewrite or omit proprietary implementation. Public example data must be visibly synthetic and limited to tests/demo providers; production views always require real approved projections. Do not ship real account fixtures, private data, production configuration or photographs without explicit redistribution rights.

Define the smallest provider contract the reference runtime consumes. It should expose bounded public DTOs and explicit publication/availability states. Keep the existing production adapter private and allow a local fixture provider for development. The extraction must not introduce a new database, relationship service, media system or scoring engine.

Acceptance evidence:

- Source and dependency review proves that public artifacts contain no secrets, private deployment values, proprietary implementation or unlicensed media/fonts.
- A deterministic fixture provider renders the supported routes without private credentials.
- Provider contract tests cover scope, published-empty versus unavailable states, removal/privacy behavior, absent metrics and safe links.
- Focused checks preserve keyboard access, mobile layout, source ranks and safe exports.
- The existing child site has an explicit rollback target; extraction alone does not change its deployed backend.

## Phase 2: separate parent and child themes

Move the general presentation into a versioned parent theme. Express Jackalope identity as a child theme and validated site presentation values. Preserve the approved visual result while reducing runtime-specific overrides.

Use the fixed precedence: core defaults, parent theme, child theme, site presentation configuration. Validate the allowed token/slot schema. Keep origins, authentication, tenancy, community scope, privacy, scoring and administrative policy outside theme configuration.

The pilot manifest compiler implements all four token layers, including validated `themeTokens` in deployment configuration. Brand asset copying/rendering remains planned; accepting an asset path in configuration does not implement its delivery or presentation. Keep deployment documentation explicit about this limit until those features are independently qualified.

Acceptance evidence:

- The same runtime runs a neutral fixture theme and the Jackalope child theme without copied feature logic.
- Compatibility tests establish the supported parent/runtime versions and reject incompatible or unknown configuration.
- Desktop/mobile and keyboard checks cover real content, not just an empty branded shell.
- Each repository has its own code license and explicit asset attribution/redistribution terms.

## Phase 3: pilot with existing private Hub adapters

Connect the extracted runtime to the existing scoped production projections through private adapters. Use existing Fortney infrastructure for data, media, identity, community, discovery and delivery. Evaluate existing `site-runtime`, `theme`, `entity-ui` and related packages before creating overlapping machinery; adopt only compatible, licensed exports at the correct side of the public/private boundary.

Public reads remain sanitized projections. Authenticated actions continue to use private server authorization, idempotency and ownership policy. Do not expose an administrator API, scoring computation or unrestricted upstream proxy as a shortcut to feature parity.

Acceptance evidence:

- Adapter tests reject cross-site/community scope overrides, unsafe origins/redirects and unpublished or private fallbacks.
- Profile reads respect current upstream privacy and deletion behavior; public reads do not receive forwarded user credentials.
- Partial failures do not become empty-success claims, and recovery/cache behavior is tested.
- Published results retain source provenance and ranks. Imports or provisional results cannot silently become official.
- A pilot deployment pins exact inputs, passes its required release gates and has a rehearsable rollback using the prior artifact/configuration.

Proceed to a rollout only with the authorization required by that environment. Keep infrastructure migrations and public framework publication separately reviewable.

## Phase 4: reuse real Hub entity capabilities deliberately

The initial extraction does not make Hub entity components reusable. Compare one concrete consumer need against the actual entity/projection packages first. Choose a bounded component or read contract with compatible ownership, styling, dependency and privacy assumptions.

Extract or adapt that capability through the existing package owners. Prefer a shared contract plus product-specific projection to copying a full application route. Retain typed authorities and existing data/media boundaries. Do not create a broad Hub migration merely to make the child-site repository look more shared.

Acceptance evidence:

- Both the Hub consumer and the child-site consumer pass the same contract checks for the selected capability.
- No provider SDK or privileged server implementation crosses into public rendering code.
- The change removes a specific duplication and records remaining incompatibilities honestly.
- Package versioning, licensing, consumer upgrades and rollback are independently verified.

## Phase 5: establish the private CompetitionHub kernel

Extract competition-domain concepts only when a second concrete discipline/product requires them. Reuse existing Fortney command, persistence, identity, offline, media and projection infrastructure. Keep this work in a separate private domain program, not as a dependency of completing the child-site pilot.

Start with event, entry, round, attempt and result lifecycle contracts. Preserve discipline-specific typed payloads and authorities. Treat shooting stages/penalties and tractor-pulling distance/classes as different plugins, not renamed versions of one score formula. Select and version the plugin/ruleset used for each official result revision.

Acceptance evidence:

- One shooting scenario and one independently specified tractor-pulling scenario demonstrate the proposed common lifecycle without losing discipline semantics.
- Rank, ties, units, penalties, approvals and provisional/published distinctions have discipline-owned tests.
- Shooters Hub continues to operate without a mass data-model migration.
- Any data migration has explicit ownership, reconciliation, replay/idempotency checks and rollback; a plan or schema alone is not completion.

## Phase 6: qualify a second community

Build a future Tractor Pullers Hub community/product pack using approved contracts and existing infrastructure. Its branding and theme may share foundations with Shooters Hub, while membership, discoverability and operating policy remain separate.

Identity federation, if selected, requires an explicit account-binding and consent policy. It does not imply a shared directory. Do not copy follows, direct-message permissions, search indexes, ratings or moderation decisions between communities by default.

Acceptance evidence:

- Isolation tests use distinct community/tenant scopes and prove that altered client settings cannot broaden them.
- Follow, messaging, profile discovery, search and ratings use the destination community's declared policy.
- Public child sites receive only the appropriate community projections.
- Any cross-community feature is independently specified, authorized and reviewed before release.

## Working rules throughout

Keep work bounded by files, owner, provider contract and acceptance criteria. Do not mix public extraction with privileged engine refactoring or unrelated infrastructure changes. Record what is implemented, what is only designed and what remains dependent on another product team's work.

Review exact release artifacts rather than assuming a repository's contents are safe to publish. The review includes source maps, build output, fixture data, dependency bundles, embedded configuration and asset rights. Public documentation must not contain private filesystem paths, credentials, internal account records or copied proprietary implementation.

When a boundary is unclear, keep the behavior behind the current private adapter until the smallest explicit contract is reviewed. A working pilot with honest limits is the acceptance target; complete Hub component reuse and the future CompetitionHub product are separate milestones.
