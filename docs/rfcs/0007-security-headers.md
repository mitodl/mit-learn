---
layout: default
parent: RFCs
nav_order: 7
---

# 0007: Security Headers for learn.mit.edu and the Learn API

{: .no_toc }

## Table of Contents

{: .no_toc .text-delta }

- Table of Contents
  {:toc}

Status: **spec** — D1–D4 decided, D5–D7 open. Nothing here is implemented yet.
Project: `wp-worknest-assessment-remediation-security-headers-ef7183`
Basis: [mitodl/hq#14080](https://github.com/mitodl/hq/issues/14080), its [scoping comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6372991750) and [plan comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6373957431)

All `mit-learn` source anchors below are against `origin/main` @ `59d24e38b`. All `ol-infrastructure` anchors are against its `origin/main` @ `a3a258ee4`. Line numbers rot; if one does not match, trust the symbol name and re-derive.

### Abstract

The Worknest web application assessment of learn.mit.edu and api.learn.mit.edu (report 3449364b, 2026-10-16) raised "Missing HTTP Security Headers" and "HTTP Header Version Disclosure". learn.mit.edu sends no `Content-Security-Policy`, no `X-Content-Type-Options` and no `Referrer-Policy`, and advertises `X-Powered-By: Next.js`. api.learn.mit.edu sends no `Content-Security-Policy`, and authenticated responses carry no `Cache-Control`.

Two of those are a few lines of configuration. The CSP is not, and the reason is worth stating up front because it drives most of this document: **learn.mit.edu cannot have a strict `script-src`.** Next.js App Router emits a per-page inline `<script>` carrying the React Server Components flight payload, so hashing is infeasible; the only alternative is a per-request nonce, and learn.mit.edu serves one Fastly-cached HTML body to every viewer, so a nonce would be shared by all of them and protect nothing. Closing that gap means changing the caching strategy, which is a larger piece of work than this one.

So this RFC ships the CSP directives that can be enforced without touching the caching strategy or Google Tag Manager's workflow — `frame-ancestors`, `object-src`, `base-uri`, `form-action`, `frame-src`, `img-src`, `style-src`, `connect-src` — and leaves `script-src` permissive as an explicit, tracked gap ([mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083)). That is a real limitation, not a technicality: an attacker who achieves HTML injection on learn.mit.edu can still execute script after this work lands.

Gateway TLS and HSTS are a separate issue and out of scope here.

#### Measured starting point

- `frontends/main/next.config.js` `headers()` has exactly two entries, both `Cache-Control`, for `/images/(.*)` and `/favicon.ico`. No security headers anywhere. `poweredByHeader` is unset, so Next's default `X-Powered-By` is sent.
- `frontends/main/src/proxy.ts` runs on every page route and sets `Cache-Control: s-maxage=<env>, stale-if-error=86400, stale-while-revalidate=86400` plus the `html-pages` `Surrogate-Key`. Its header comment explains that `next.config.js` `headers()` runs at build time and cannot read per-environment variables, which is why this file exists.
- `frontends/main/src/app/(site)/layout.tsx` renders an inline `<Script>` bootstrapping GTM whose body interpolates `GTM_AUTH` and `GTM_PREVIEW`, a `<noscript>` iframe pointing at `googletagmanager.com/ns.html`, and external scripts for Appzi (`NEXT_PUBLIC_APPZI_URL`) and HubSpot.
- Emotion and MUI v6 inject `<style>` elements at runtime.
- Third-party hosts referenced from the frontend: `www.googletagmanager.com`, `js.hs-scripts.com`, `use.typekit.net`, `p.typekit.net`, `fonts.googleapis.com`, `cdn.jsdelivr.net`, `player.vimeo.com`, `www.youtube.com`.
- Django 5.2.17. `SecurityMiddleware` is first in `MIDDLEWARE` (`main/settings.py`). Only `SECURE_CROSS_ORIGIN_OPENER_POLICY` is set explicitly; `SECURE_CONTENT_TYPE_NOSNIFF` and `SECURE_REFERRER_POLICY` are unset, so Django's defaults (`True` and `same-origin`) apply and the API probably already sends both. There is no `django-csp` dependency and no `Cache-Control` logic anywhere in the Python code.

#### Where response headers come from today

Four layers already set headers on these hostnames, which is why "where does this header go" is a decision rather than an implementation detail.

| Layer                              | Sets today                                           | Defined in                                                                                                    |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Fastly VCL                         | `Strict-Transport-Security`                          | `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn/__main__.py`                                |
| EKS Gateway (`next.learn.mit.edu`) | `X-Robots-Tag` via a `ResponseHeaderModifier` filter | `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn_nextjs/__main__.py`                         |
| APISIX (`api.learn.mit.edu`)       | `Referrer-Policy: origin`, CORS, http→https          | `ol-infrastructure` `src/ol_infrastructure/components/services/apisix.py`, reached via `enable_defaults=True` |
| Next.js                            | `Cache-Control`, `Surrogate-Key`                     | `frontends/main/next.config.js`, `frontends/main/src/proxy.ts`                                                |

Two consequences that are easy to get wrong:

**api.learn.mit.edu is not missing `Referrer-Policy`.** APISIX sets it from the shared plugin defaults. learn.mit.edu differs because its request path is Fastly → `next.learn.mit.edu`, which is a plain `OLEKSGateway` route, not an APISIX route — so the shared plugin never reaches it. The issue body's claim that both hosts lack the header is only true of the frontend.

**A route-level APISIX `response-rewrite` replaces the shared plugin wholesale** rather than merging with it (`ol-infrastructure` `src/ol_infrastructure/components/services/apisix_gateway_api.py`). Adding one to a Learn API route in order to set `Cache-Control` would silently delete `Referrer-Policy` from that route. This has already happened in production on mitxonline's static-hash route. It is the reason D5 is constrained to Django.

### Architecture Changes

#### D1. Headers are emitted by the application, not at the edge (decided)

All headers in scope are emitted by the applications themselves — the Next.js app for learn.mit.edu, Django for api.learn.mit.edu — rather than by Fastly VCL or the EKS Gateway route.

The alternative was to put them in `ol-infrastructure` alongside the existing `Strict-Transport-Security` and `X-Robots-Tag`, where precedent exists: mitxonline already sets a `frame-ancestors` CSP at the gateway (`src/ol_infrastructure/applications/mitxonline/definition.py`), asserted by a test.

Rejected for three reasons. The policy has to allowlist the Appzi host, which comes from `NEXT_PUBLIC_APPZI_URL` and is an application concern expressed in application config. Splitting header ownership across two repos is already why learn.mit.edu has no `Referrer-Policy` today — the gateway route and the APISIX route diverged and nobody noticed. And the report-only soak in D4 is an iterative loop; at the edge every iteration costs an infrastructure deploy and review cycle.

**Would have won if** one policy had to be enforced uniformly across learn.mit.edu, api.learn.mit.edu and other properties from a single place, or if application deploys were materially slower than infrastructure deploys. Neither holds.

#### D2. Static headers in `next.config.js`, the CSP in `proxy.ts` (decided)

`X-Content-Type-Options`, `Referrer-Policy` and `poweredByHeader: false` are genuinely static — one value, every environment — so they go in `next.config.js`, which is where the repo already keeps static response-header rules.

The CSP cannot go there. `headers()` is evaluated at build time and the policy must contain the per-environment Appzi host. It goes in `frontends/main/src/proxy.ts`, which exists for exactly this reason and already sets `Cache-Control` from runtime environment for the same underlying cause.

mitodl/hq#14080's original Plan/Design says to put the CSP in `next.config.js`. That is wrong, and this supersedes it.

#### D3. `script-src` stays permissive; every other directive is enforced (decided)

The policy enforces `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors` (D7), `frame-src`, `img-src`, `style-src` and `connect-src`. `script-src` keeps `'unsafe-inline'` alongside a host allowlist.

Three facts force this, and they compound:

1. **Next's own inline scripts cannot be hashed.** The App Router streams `<script>self.__next_f.push(...)</script>` per page (`next/dist/server/app-render/use-flight-response.js`). The content is the serialized RSC payload, so it differs per page and per render.
2. **A nonce cannot survive the page cache.** Next does support nonces — it reads one from the `Content-Security-Policy` or `Content-Security-Policy-Report-Only` request header (`next/dist/server/app-render/app-render.js`) and propagates it to its own scripts and to `next/script` tags. But learn.mit.edu HTML is cached at Fastly with `s-maxage` and served from one body to every viewer, and Fastly strips the request cookie before caching. A nonce in a shared cached body is known to anyone who can fetch the page, which is everyone.
3. **A strict host allowlist fights GTM's purpose.** `docs/architecture/gtm.md` states that tag configuration is "owned in the GTM UI, not in this repo", so marketing can add third-party tags "without needing a code deploy". A `script-src` that enumerates permitted script hosts breaks that: every new tag is blocked until engineering ships a CSP change. `'strict-dynamic'` is the directive designed for this, but it only propagates trust from a nonce or hash — which is what (1) and (2) rule out.

**The accepted tradeoff.** Giving up: a `script-src` that blocks injected inline script, so HTML injection still yields script execution. To get: an enforced CSP that ships without changing the caching strategy or breaking GTM's workflow. Revisit when: HTML page caching is dropped for an unrelated reason, or the GTM tag inventory stabilises enough to allowlist, or an assessment flags `script-src` specifically. Decided by: @rhysyngsun. Tracked at [mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083) (`tk-strict-script-src-for-learn-mit-edu-close-the-cs-c77d86`), which also records the measurement that work needs first.

**Would have won if** learn.mit.edu HTML were not CDN-cached, or if measured origin headroom showed the Next.js pods absorb uncached HTML without losing the `stale-if-error=86400` shield that currently serves stale pages for 24 hours during an origin incident. Neither has been measured. That measurement is the first step of hq#14083, not of this work.

One alternative was considered and discarded as not actually distinct: moving the inline GTM bootstrap into a same-origin route so no inline application script exists. It does not help, because Next's own hydration scripts are still inline, so `script-src` ends up in the same place with extra indirection added.

#### D4. Report-only first, enforce after a soak (decided)

The CSP ships as `Content-Security-Policy-Report-Only`, collects violations in production, and is flipped to enforcing only after the observed violation budget has been written down and judged acceptable.

This is not ceremony. The policy touches embedded video, web fonts, a CDN, two analytics vendors and a feedback widget, and the inventory above was assembled by reading source — it is a good starting point, not a guarantee. Enforcing directly risks breaking page rendering for everyone on a single deploy.

Next reads a nonce from the report-only header as readily as the enforcing one, so nothing about the soak forecloses D3 being revisited later.

#### D5. Mechanism for `Cache-Control` on user-specific API responses (open)

Authenticated and user-specific responses from api.learn.mit.edu must carry `Cache-Control: no-store`. Public, anonymously cacheable responses must not.

There is no existing `Cache-Control` logic in the Python codebase, so there is no in-repo pattern to follow. Candidates: Django middleware keyed on `request.user.is_authenticated`; a DRF mixin applied to the user-specific viewsets; a per-view decorator.

Two constraints hold whichever wins:

- **It is implemented in Django, not at APISIX.** A route-level `response-rewrite` would delete the shared `Referrer-Policy` from that route (see the header-provenance note above).
- **Public search endpoints must keep their cacheability.** ocw.mit.edu and draft.ocw.mit.edu are in Learn's production CORS allowlist, and `ocw-hugo-themes` builds with `FEATURE_ENABLE_LEARN_INTEGRATION` true plus `MIT_LEARN_API_BASE_URL`, so OCW calls these endpoints from the browser today — and the OCW search switchover ([mitodl/hq#12184](https://github.com/mitodl/hq/issues/12184)) is about to increase that volume substantially. A blanket `no-store` middleware is a regression, not a fix.

**Who decides:** whoever picks up `tk-chunk-2-cache-control-no-store-on-user-specific--c0a90d`. Settle it in a PR comment on this RFC before writing the code.

**Verify first.** Before any of this, `curl -sI https://api.learn.mit.edu/api/v0/users/me/` with a session. Django's defaults may already supply headers the issue lists as missing; the work should start from observed production responses rather than the issue body.

#### D6. Where CSP violation reports are collected (open)

`@sentry/nextjs` is already a dependency and is the obvious destination. What is unsettled is the mechanism: the deprecated-but-universally-supported `report-uri`, the newer `report-to` with a `Reporting-Endpoints` header, or both; and which Sentry ingest path receives them.

Volume matters here. A report-only CSP on a high-traffic public site generates a report per violation per page view, and browser extensions inject scripts that will trip it constantly. Whatever is chosen needs a sampling or rate-limiting story, or the soak will be expensive and the signal buried.

**Who decides:** whoever picks up `tk-chunk-3-csp-report-only-on-learn-mit-edu-emitted-f8001f`.

#### D7. The `frame-ancestors` origin list (open — externally blocked)

`frame-ancestors` controls which sites may embed learn.mit.edu in an iframe. Set too narrowly, any site embedding Learn today breaks, and it breaks as a blank frame rather than as an error anyone is paged for.

Asked of the OCW and MITx Online teams at [this comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6373425561). What is known:

- The OCW search switchover is link-and-redirect, so inbound navigation does not require framing.
- OCW does have a live browser-side integration with the Learn API and with learn-ai (`LEARN_AI_SYLLABUS_ENDPOINT`), and whether the AI syllabus widget renders in an iframe is not determinable from the code.
- MITx Online almost certainly does frame something: `ol-infrastructure` already sets `frame-ancestors 'self' {openedx_base_url}` for mitxonline, so that stack has an established embedding relationship.

**Who decides:** the OCW and MITx Online teams. This is not answerable from the codebase and must not be guessed.

### Security Considerations

**What this closes.** After D1–D4 and D7 land: clickjacking via framing (`frame-ancestors`), plugin-based content injection (`object-src 'none'`), base-tag hijacking that redirects relative script URLs (`base-uri 'self'`), form exfiltration to third-party origins (`form-action 'self'`), MIME-sniffing attacks (`X-Content-Type-Options: nosniff`), full-URL referrer leakage to third parties (`Referrer-Policy`), framework version disclosure (`X-Powered-By`), and shared-cache retention of user-specific API responses (D5).

**What this does not close, and will not.** Cross-site scripting. With `'unsafe-inline'` in `script-src`, an attacker who achieves HTML injection executes script. The CSP constrains where script may be _loaded from_; it does not constrain inline execution. Anyone reading "learn.mit.edu now has a CSP" and inferring XSS protection has inferred wrongly, and a subsequent assessment could reasonably raise the same finding. This is the single most important caveat in this document and the reason hq#14083 exists.

**Residual risk from the permissive `script-src`.** The host allowlist still has value — it blocks loading script from an arbitrary attacker-controlled origin, and `object-src 'none'` plus `base-uri 'self'` remove two common escalation paths — but the allowlist includes GTM, which can load arbitrary third-party script by design. In practice the trust boundary includes everyone with write access to the GTM container.

**`Referrer-Policy` has consequences beyond privacy.** It must be `strict-origin-when-cross-origin`. The tighter `same-origin` and `no-referrer` send no `Referer` at all on a cross-origin navigation, and OCW is about to start sending search traffic here as exactly that ([mitodl/hq#13617](https://github.com/mitodl/hq/issues/13617), [mitodl/hq#13767](https://github.com/mitodl/hq/issues/13767)). Those visits would then arrive with no referrer for any analytics to attribute them to — a silent loss, with no error anywhere to connect it back to this change. Note this is the mechanical consequence; neither issue states how the rollout will be measured, so treat "it would break their measurement" as unverified and the referrer loss as the thing actually established.

**`Cache-Control` scoping cuts both ways.** Too narrow and user-specific responses stay cacheable in shared caches, which is the finding. Too broad and public search endpoints lose caching at the moment OCW starts sending them significant traffic.

### Testing & Rollout

Four chunks. Chunk 1 is stacked on this RFC's own pull request, so it merges after this document does. Chunks 2 and 3 are independent of it and of each other, and may land in any order or in parallel. Chunk 4 depends on chunk 3 being **deployed and soaked**, not merged. Sizes are estimates taken from the measured starting point and are re-measured during implementation. Epic: `tk-add-missing-security-headers-to-learn-mit-edu-an-4097f6`.

#### Sequencing

1. **Static headers** — `tk-chunk-1-static-security-headers-on-learn-mit-edu-9062b4`, ~40 lines, touches `frontends/main/next.config.js` and `frontends/main/src/nextConfig.test.ts`.
   Done when `curl -sI https://learn.mit.edu/` shows `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and no `X-Powered-By`. Unblocked by every open decision above, so the work can start immediately; it is stacked on this RFC's pull request, so it merges after this document does.

2. **API cache scoping** — `tk-chunk-2-cache-control-no-store-on-user-specific--c0a90d`, ~80 lines, touches `main/settings.py`, middleware or a DRF mixin, and tests. Requires D5.
   Done when an authenticated response carries `Cache-Control: no-store` and an anonymous search response still carries its existing caching headers, both asserted in tests rather than checked by hand.

3. **CSP report-only** — `tk-chunk-3-csp-report-only-on-learn-mit-edu-emitted-f8001f`, ~150 lines, touches `frontends/main/src/proxy.ts`, `frontends/main/src/common/config.ts`, `frontends/main/src/proxy.test.ts`. Requires D6.
   Done when the header is live in production, violations are arriving at the chosen collector, and a violation sample has been gathered over a stated soak window.

4. **CSP enforced** — `tk-chunk-4-enforce-the-csp-and-add-frame-ancestors-57a453`, ~20 lines, touches `frontends/main/src/proxy.ts` and its test. Requires D7 and chunk 3 deployed and soaked.
   Done when the header is `Content-Security-Policy` rather than `-Report-Only`, `frame-ancestors` carries the confirmed origin list, and the Fastly HTML hit ratio is unchanged.

#### Verification

Beyond each chunk's done-condition:

- **Headers are verified against production, not locally.** `curl -sI https://learn.mit.edu/` and `curl -sI https://api.learn.mit.edu/api/v0/users/me/` with a session. Four layers can set a header on these hostnames and a local run exercises one of them.
- **The Fastly HTML hit ratio is checked after chunk 4.** D3 was chosen specifically so the policy is identical for every viewer and the cache is unaffected. A hit-ratio drop means something in the implementation made responses vary per request, which is a bug in the implementation and not an accepted cost.
- **The soak's violation budget is written down before the flip.** An enforce with unexplained violations in the sample means the policy is still wrong for somebody who has not been identified.
- **OCW's integration is exercised after chunk 2.** A public search request from a browser on ocw.mit.edu should still be served with its existing caching headers.

#### Rollback

Chunks 1, 2 and 4 revert cleanly — headers appear and disappear with the deploy, and no data or external contract moves. Chunk 3 is report-only and carries no user-visible behaviour to roll back, though a misconfigured collector can generate significant report volume; that is a reason to settle D6's sampling story before shipping, not a reason to skip the soak.

### Non-goals

- **Gateway TLS and HSTS.** Tracked separately. Fastly already sets `Strict-Transport-Security`.
- **A strict `script-src`.** Deliberately deferred — see D3 and [mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083). This RFC should not be amended to add it; that work replaces part of this policy and gets its own RFC if it needs one.
- **Changing the HTML caching strategy.** The entire shape of D3 follows from leaving it alone.
- **The shared APISIX CORS configuration.** Already addressed by `ol-infrastructure` [#5755](https://github.com/mitodl/ol-infrastructure/pull/5755), which replaced the wildcard default with required per-app origin lists. An earlier draft of the scoping for hq#14080 claimed otherwise; that was read from a stale checkout and is wrong.
- **`Content-Security-Policy` on api.learn.mit.edu.** The assessment lists it, but a CSP on a JSON API has no document context to constrain and buys nothing. If a reader disagrees, that is a decision to open as D8 rather than an omission.

### Open questions

|     | Question                                                                                                      | Who answers                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D5  | Which mechanism scopes `Cache-Control: no-store` to user-specific responses without catching public endpoints | Implementer of chunk 2, in review on this RFC                                                              |
| D6  | Which reporting mechanism and ingest path collects CSP violations, and how the volume is sampled              | Implementer of chunk 3, in review on this RFC                                                              |
| D7  | Which origins legitimately embed learn.mit.edu                                                                | OCW and MITx Online teams, [asked here](https://github.com/mitodl/hq/issues/14080#issuecomment-6373425561) |

### Risks

**The violation inventory is incomplete.** The third-party host list was assembled by reading source, and runtime behaviour differs — GTM loads tags configured outside this repo, and those tags load whatever they like. Mitigated by D4's soak, which is the only way to find them. Residual risk: a low-frequency tag that fires for a small audience may not appear in the sample and will break at enforce. Accepted; the reporting stays on after the flip so it surfaces as a report rather than a silent failure.

**D7 arrives late or vague.** `frame-ancestors` is the directive the assessment most directly motivates, and it is the one blocked on other teams. If no answer arrives, the fallback is to ship chunk 4 with every other directive enforced and `frame-ancestors` omitted, then add it separately — not to guess a value. Omitting it leaves the clickjacking finding open and should be stated as such rather than quietly dropped.

**Line numbers in this document rot.** Anchored to `59d24e38b` and `a3a258ee4` as noted in the header. If an anchor does not match, the code moved; re-derive from the symbol name rather than assuming this RFC is describing something that no longer exists.

**GTM container write access is part of the trust boundary.** D3 accepts a `script-src` permissive enough that GTM can load arbitrary third-party script. That is the status quo rather than a regression, but this RFC makes it explicit, and anyone reasoning about the site's script trust boundary should start from the GTM container's access list.
