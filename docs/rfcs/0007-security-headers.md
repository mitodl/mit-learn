# 0007: Security Headers for learn.mit.edu and the Learn API

Status: **spec** — D1–D9, D11 and D12 decided, D10 open. Nothing here is implemented yet.
Project: `wp-worknest-assessment-remediation-security-headers-ef7183`
Basis: [mitodl/hq#14080](https://github.com/mitodl/hq/issues/14080), its [scoping comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6372991750) and [plan comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6373957431)

All `mit-learn` source anchors below are against `origin/main` @ `0deaee154`. All `ol-infrastructure` anchors are against its `origin/main` @ `a3a258ee4`. Line numbers rot; if one does not match, trust the symbol name and re-derive.

### Abstract

The Worknest web application assessment of learn.mit.edu and api.learn.mit.edu (report 3449364b, 2026-10-16) raised "Missing HTTP Security Headers" and "HTTP Header Version Disclosure". learn.mit.edu sends no `Content-Security-Policy`, no `X-Content-Type-Options` and no `Referrer-Policy`, and advertises `X-Powered-By: Next.js`. api.learn.mit.edu sends no `Content-Security-Policy`, and authenticated responses carry no `Cache-Control`.

Two of those are a few lines of configuration. The CSP is not, and the reason is worth stating up front because it drives most of this document: **learn.mit.edu cannot have a strict `script-src`.** Next.js App Router emits a per-page inline `<script>` carrying the React Server Components flight payload, so hashing is infeasible; the only alternative is a per-request nonce, and learn.mit.edu serves one Fastly-cached HTML body to every viewer, so a nonce would be shared by all of them and protect nothing. Closing that gap means changing the caching strategy, which is a larger piece of work than this one.

So this RFC ships the CSP directives that can be enforced without touching the caching strategy — `frame-ancestors`, `object-src`, `base-uri`, `form-action`, `frame-src`, `img-src`, `style-src`, `connect-src`, and the `default-src`/`media-src`/`font-src`/`worker-src` set D10 adds — and leaves `script-src` permissive as an explicit, tracked gap ([mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083)). That is a real limitation, not a technicality: an attacker who achieves HTML injection on learn.mit.edu can still execute script after this work lands.

Gateway TLS and HSTS are out of scope. They are separate findings from the same report, and HSTS is already set on both hostnames: learn.mit.edu sends `max-age=31536000` from Fastly, and api.learn.mit.edu sends `max-age=86400` from the APISIX `security-response-headers` global rule. [mitodl/hq#14079](https://github.com/mitodl/hq/issues/14079) hardened the gateway's TLS ciphers and is closed; [mitodl/hq#14230](https://github.com/mitodl/hq/issues/14230) raises the gateway's HSTS `max-age` to a year and is open. Neither touches the headers this RFC owns.

#### Measured starting point

- `frontends/main/next.config.js` `headers()` has exactly two entries, both `Cache-Control`, for `/images/(.*)` and `/favicon.ico`. No security headers anywhere. `poweredByHeader` is unset, so Next's default `X-Powered-By` is sent.
- `frontends/main/src/proxy.ts` runs on every page route and sets `Cache-Control: s-maxage=<env>, stale-if-error=86400, stale-while-revalidate=86400` plus the `html-pages` `Surrogate-Key`. Its header comment explains that `next.config.js` `headers()` runs at build time and cannot read per-environment variables, which is why this file exists.
- `frontends/main/src/app/(embed)/` is a second route group serving exactly two paths — `/video/embed/<id>` (which accepts `?t=<seconds>`) and `/podcast/embed/<id>`. Next.js route groups contribute nothing to the URL, so there is no `/embed/` prefix, and the sibling `(site)` paths `/video/<id>` and `/podcast/<podcastId>` must not be matched by a rule meant for these. Its `layout.tsx` renders only `<MITLearnGlobalStyles />` plus children: no GTM, no Appzi, no HubSpot, no header or footer. The root `app/layout.tsx` still applies.
- `frontends/main/src/components/ShareDialog/ShareDialog.tsx` hands users a copy-paste `<iframe>` snippet pointing at `/video/embed/<id>` for videos on the `ovs` and `ocw` platforms, and displays `/podcast/embed/<id>` as a copyable "Audio URL" that users wrap in an iframe themselves. Both are meant to be pasted onto arbitrary third-party domains. This is the fact D7 turns on.
- learn.mit.edu does **not** frame itself today, despite appearances. `MediaEmbedURLHandler.ts` does recognise own-origin embed URLs, but it stores them as a `mitLearnVideoId` attribute, and both render sites branch on exactly that to produce a native React `OVSVideoPlayer` — the `<iframe>` is the fallback for third-party URLs only (`MediaEmbedViewer.tsx:84`, `MediaEmbedNodeView.tsx:245`). Podcast URLs become a `podcastEpisodeEmbed` node whose render tree contains no iframe at all.
- `frontends/main/src/app/(site)/layout.tsx` renders an inline `<Script>` bootstrapping GTM whose body interpolates `GTM_AUTH` and `GTM_PREVIEW`, a `<noscript>` iframe pointing at `googletagmanager.com/ns.html`, and external scripts for Appzi (`NEXT_PUBLIC_APPZI_URL`) and HubSpot.
- Emotion and MUI v6 inject `<style>` elements at runtime.
- Third-party hosts referenced from the frontend: `www.googletagmanager.com`, `js.hs-scripts.com`, `use.typekit.net`, `p.typekit.net`, `fonts.googleapis.com`, `cdn.jsdelivr.net`, `player.vimeo.com`, `www.youtube.com`, `video.odl.mit.edu`. The last is resolved by `convertToEmbedUrl()` in `frontends/main/src/common/utils.ts` alongside the YouTube and Vimeo players. **This list is hosts that appear as literals in the frontend, and it is therefore not the policy's host list.** reCAPTCHA's hosts appear nowhere here because `react-google-recaptcha` injects them at runtime (see D10), and GTM loads whatever its container is configured to load. Reading source bounds this inventory from below, never from above.
- Hosts that reach the browser only as **runtime environment values**, read from the live `x-public-env` payload on 2026-10-27 and absent from the list above for the same reason: `https://w.appzi.io` (`NEXT_PUBLIC_APPZI_URL`, the concrete value behind D2's argument that this host cannot be known at build time), `https://ph.ol.mit.edu` (`NEXT_PUBLIC_POSTHOG_API_HOST` - PostHog, proxied at an MIT host rather than called at `posthog.com`) and `https://analytics.learn.mit.edu` (`NEXT_PUBLIC_ANALYTICS_API_BASE_URL`). Two of the three are `connect-src` concerns that D10's `'self' https:` already covers; they are listed so a future tightening knows they exist.

**`ph.ol.mit.edu` is the exception.** It is also a `script-src` host, not only a `connect-src` one. `posthog-js` fetches its optional bundles - surveys, the session recorder, the toolbar - as `<script>`, and routes them through `RequestRouter.endpointFor('assets', …)`, which returns `api_host` verbatim whenever the region is `CUSTOM` (`node_modules/posthog-js/src/utils/request-router.ts`). `ph.ol.mit.edu` matches neither the US nor the EU host pattern, so it is `CUSTOM`, so the bundles load from our own proxy. `NEXT_PUBLIC_POSTHOG_UI_HOST` (`https://us.posthog.com`, set in `ol-infrastructure` `applications/mit_learn/__main__.py`) is reached only by `endpointFor('ui')`, which builds application links, and is not a script source.

Nothing short of reading `posthog-js`'s shipped code finds this one. It is not in the GTM container, so the container inventory misses it; it is not a literal in this repo, so reading source misses it; and it is not at a vendor's documented domain, so a vendor CSP guide misses it. It is an environment variable consumed inside a library, pointed at infrastructure we run.

- The GTM container's own contents are **measured, not inferred** — see "Measuring the GTM container" under D11. That is where `cdn.jsdelivr.net` and `unpkg.com` come from, and neither could have been found by reading this repo.
- Media sources are **not** enumerable from this repo. `learning_resources/etl/ovs.py` sets a video's `streaming_url` to whatever the OVS API returns (a CloudFront host), and podcast audio URLs come from third-party RSS feeds. See D10.
- Django 5.2.17. `SecurityMiddleware` is first in `MIDDLEWARE` (`main/settings.py`). Only `SECURE_CROSS_ORIGIN_OPENER_POLICY` is set explicitly; `SECURE_CONTENT_TYPE_NOSNIFF` and `SECURE_REFERRER_POLICY` are unset, so Django's defaults (`True` and `same-origin`) apply and the API probably already sends both. There is no `django-csp` dependency and no `Cache-Control` logic anywhere in the Python code.

- **Not every learn.mit.edu document comes from Next.js.** Fastly rewrites `^/courses/o/` to `/ocw-course-v3/courses/` and routes it to the `ocw_site` live S3 bucket — the `is_ocw_request` VCL and the "OCW course requests" condition in `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn/__main__.py`. `curl -sI https://learn.mit.edu/courses/o/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/` on 2026-11-05 returns `server: AmazonS3`, `content-type: text/html`, and `Strict-Transport-Security` as its only security header. Those documents load `www.googletagmanager.com` and `w.appzi.io` script on the learn.mit.edu origin, and nothing in this repo is in their request path. See D12.

#### Where response headers come from today

Five layers already set headers on these hostnames, which is why "where does this header go" is a decision rather than an implementation detail.

| Layer                                   | Sets today                                           | Defined in                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Fastly VCL                              | `Strict-Transport-Security`                          | `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn/__main__.py`                                                            |
| EKS Gateway (`next.learn.mit.edu`)      | `X-Robots-Tag` via a `ResponseHeaderModifier` filter | `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn_nextjs/__main__.py`                                                     |
| APISIX (`api.learn.mit.edu`)            | `Referrer-Policy: origin`, CORS, http→https          | `ol-infrastructure` `src/ol_infrastructure/components/services/apisix.py`, reached via `enable_defaults=True`                             |
| APISIX global rule (every gateway host) | `Strict-Transport-Security: max-age=86400`           | `ol-infrastructure` `src/ol_infrastructure/infrastructure/aws/eks/apisix_official.py`, the `security-response-headers` `ApisixGlobalRule` |
| Next.js                                 | `Cache-Control`, `Surrogate-Key`                     | `frontends/main/next.config.js`, `frontends/main/src/proxy.ts`                                                                            |

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

The CSP cannot go there. `headers()` is evaluated at build time and the policy must contain the per-environment Appzi host. It is emitted from `frontends/main/src/proxy.ts`, which exists for exactly this reason and already sets `Cache-Control` from runtime environment for the same underlying cause. D8 refines this without overriding it: the header is still set in `proxy.ts`, but the policy is _built_ in a separate `frontends/main/src/common/csp.ts` so it can be tested on its own.

mitodl/hq#14080's original Plan/Design says to put the CSP in `next.config.js`. That is wrong, and this supersedes it.

#### D3. `script-src` stays permissive; every other directive is enforced (decided)

The policy enforces `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors` (D7), `frame-src`, `img-src`, `style-src`, `connect-src` and the fallbacks named in D10. `script-src` keeps `'unsafe-inline'` alongside a host allowlist — except on the `(embed)` routes, where D8 narrows the allowlist to `'self'` plus YouTube.

`base-uri` is `'none'` rather than `'self'` because nothing in either document emits a `<base>` element — not the Next.js app, not `ol-components`, and not Next itself, which uses `assetPrefix` instead. `'self'` would still permit a same-origin `<base>`, and a same-origin `<base>` is enough to repoint every relative URL in the document. `base-uri` does not fall back to `default-src`, so it has to be named explicitly in both policies.

Be honest about which of those are load-bearing. Under a permissive `script-src`, **`connect-src` and `img-src` buy close to nothing**: an attacker who can already execute inline script, or who reaches the GTM container, has an exfiltration channel regardless, and tightening `connect-src` would break HLS video long before it inconvenienced them. The directives actually doing work are `frame-ancestors`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-src`, and the embed group's narrowed `script-src`.

Three facts force this, and they compound:

1. **Next's own inline scripts cannot be hashed.** The App Router streams `<script>self.__next_f.push(...)</script>` per page (`next/dist/server/app-render/use-flight-response.js`). The content is the serialized RSC payload, so it differs per page and per render.
2. **A nonce cannot survive the page cache.** Next does support nonces — it reads one from the `Content-Security-Policy` or `Content-Security-Policy-Report-Only` request header (`next/dist/server/app-render/app-render.js`) and propagates it to its own scripts and to `next/script` tags. But learn.mit.edu HTML is cached at Fastly with `s-maxage` and served from one body to every viewer, and Fastly strips the request cookie before caching. A nonce in a shared cached body is known to anyone who can fetch the page, which is everyone.
3. **A strict host allowlist fights GTM's purpose.** `docs/architecture/gtm.md` states that tag configuration is "owned in the GTM UI, not in this repo", so marketing can add third-party tags "without needing a code deploy". A `script-src` that enumerates permitted script hosts breaks that: every new tag is blocked until engineering ships a CSP change. `'strict-dynamic'` is the directive designed for this, but it only propagates trust from a nonce or hash — which is what (1) and (2) rule out.

**Point 3 is a cost this decision accepts, not one it solves.** `'unsafe-inline'` governs inline `<script>` blocks and inline handlers. It does nothing for _external_ scripts: a `<script src>` pointing at a host outside the allowlist is still blocked, and the browser enforces that whether the tag was in the markup or injected by already-running JavaScript ([MDN `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)). So `'unsafe-inline'` plus a host allowlist **does not** preserve GTM's deploy-free tag workflow — a new vendor tag loading from a host nobody has allowlisted is blocked at enforce, exactly as point 3 describes. D11 settles that in favour of the allowlist, so the deploy cost is accepted deliberately.

**The accepted tradeoff.** Giving up: a `script-src` that blocks injected inline script, so HTML injection still yields script execution. To get: an enforced CSP that ships without changing the caching strategy. Revisit when: HTML page caching is dropped for an unrelated reason, or an assessment flags `script-src` specifically. Decided by: @rhysyngsun.

D11's host allowlist is not itself a revisit condition. The allowlist bounds _which hosts_ may serve script; `'unsafe-inline'` still permits inline execution, which is the part that makes HTML injection dangerous. The two are independent, and only the second is what [mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083) exists to fix. Tracked at [mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083) (`tk-strict-script-src-for-learn-mit-edu-close-the-cs-c77d86`).

**Would have won if** learn.mit.edu HTML were not CDN-cached, or if measured origin headroom showed the Next.js pods absorb uncached HTML without losing the `stale-if-error=86400` shield that currently serves stale pages for 24 hours during an origin incident. Neither has been measured. That measurement is the first step of hq#14083, not of this work.

One alternative was considered and discarded as not actually distinct: moving the inline GTM bootstrap into a same-origin route so no inline application script exists. It does not help, because Next's own hydration scripts are still inline, so `script-src` ends up in the same place with extra indirection added.

#### D4. Report-only first, enforce after a soak (decided)

The CSP ships as `Content-Security-Policy-Report-Only`, collects violations in production, and is flipped to enforcing only after the observed violation budget has been written down and judged acceptable.

This is not ceremony. The policy touches embedded video, web fonts, a CDN, two analytics vendors and a feedback widget, and the inventory above was assembled by reading source — it is a good starting point, not a guarantee. Enforcing directly risks breaking page rendering for everyone on a single deploy.

Next reads a nonce from the report-only header as readily as the enforcing one, so nothing about the soak forecloses D3 being revisited later.

#### D5. Mechanism for `Cache-Control` on user-specific API responses (decided)

Authenticated and user-specific responses from api.learn.mit.edu must carry `Cache-Control: no-store`. Public, anonymously cacheable responses must not.

**Decision: a response-phase middleware that fails closed, with an explicit opt-out**, plus a small classification layer separating _which responses are private_ from _what header each class gets_. `main/cache_policy.py` holds the classification and the policy map; `main/middleware/cache_policy.py` applies it.

The rule, in order of precedence:

1. An existing `Cache-Control` wins outright — a view that set one meant it. `podcast_rss_feed` uses Django's `cache_page` and must keep its `max-age=900`.
2. An explicit stamp wins next. The Redis view-cache decorators in `main/utils.py` mark a response `SHARED` when they actually serve one shared across users.
3. Otherwise private if the request is authenticated **or the response sets a cookie**.

**Why middleware rather than a DRF mixin or a decorator.** Those are opt-in: a new user-specific endpoint ships uncovered unless someone remembers, and nothing fails when they don't — which is precisely how the original finding arose. Middleware inverts the failure mode. Forgetting now costs cache efficiency, which is visible, rather than confidentiality, which is not.

**The cookie clause is not redundant with the authentication clause.** `/api/v0/users/me/` permits anonymous access — `CurrentUserRetrieveViewSet` returns `request.user` either way — and carries `ensure_csrf_cookie`, so an anonymous request there produces a cookie-bearing response that the authentication clause alone leaves cacheable.

**Two constraints, both held:**

- **Implemented in Django, not at APISIX.** A route-level `response-rewrite` would delete the shared `Referrer-Policy` from that route (see the header-provenance note above).
- **Public endpoints keep their cacheability.** Anonymous requests are untouched, which is what protects OCW: their browser calls carry no session, so they never reach the rule. ocw.mit.edu and draft.ocw.mit.edu are in Learn's production CORS allowlist and `ocw-hugo-themes` builds with `FEATURE_ENABLE_LEARN_INTEGRATION`, and the search switchover ([mitodl/hq#12184](https://github.com/mitodl/hq/issues/12184)) raises that volume. Asserted by a test, not argued.

**Position in `MIDDLEWARE` is load-bearing and fails silently if wrong.** Django runs response phases bottom-up, so an entry listed _earlier_ runs _later_ on the way out. `SessionMiddleware` and `CsrfViewMiddleware` set their cookies during their own response phase, so this middleware must be listed **before** them to observe those cookies — it sits directly after `SecurityMiddleware`. Listed last instead, it would run first on the way out, see no cookies, and quietly stop protecting the one case the cookie clause exists for, with every unit test still green. A test asserts the relative ordering.

**The classification reuses what is already there.** There is no `Cache-Control` _header_ logic anywhere in the Python codebase, but there is already an explicit declaration of which responses are safe to share between users: `main/utils.py`'s `cache_page_for_all_users` / `cache_page_for_anonymous_users`, over ~25 view call sites. They emit no headers, but they are maintained and they are exactly the classification this needs. Building a second, parallel list would be the mistake.

Only `cache_page_for_all_users` earns the `SHARED` stamp. `cache_page_for_anonymous_users` _bypasses_ its cache for authenticated users, so those responses are computed per request and may carry user-specific fields; a request taken by the `bypass` predicate is likewise uncached. Both stay private.

**Header value:** `no-store` with `private`, written through Django's `patch_cache_control`, which merges rather than replaces. `no-store` is the requirement; `private` is free and still directs a shared cache correctly if it predates or mishandles `no-store`. No third-party package does this job — the dedicated ones (`django-smartcc` 2015, `django-cache-headers` 2018, `django-http-cache-control-view` 2020) are all abandoned, and `drf-extensions` solves server-side caching rather than headers. Django's own `django.utils.cache` supplies the mechanism, which is likely why nobody maintains one.

**`CACHE_POLICY_ENABLED`** is a kill switch, defaulting true, matching the pattern already in `main/settings.py`. If this regresses a consumer it can be turned off without a deploy.

**Extensibility.** The policy map is the seam: public endpoints currently send no `Cache-Control` either, so a later change wanting `public, s-maxage=N` on shared responses edits one mapping rather than every call site. Deliberately not done here — that has real CDN consequences and deserves its own soak.

**Decided by:** @rhysyngsun, implementing `tk-chunk-2-cache-control-no-store-on-user-specific--c0a90d`.

**Still unverified.** `curl -sI https://api.learn.mit.edu/api/v0/users/me/` **with a session** has not been run, so what authenticated responses carry today — in particular whether `Vary: Cookie` is already present, which would limit though not eliminate the current exposure — is still unmeasured. The implementation does not depend on the answer; the baseline for the write-up does. Anonymous responses were checked: the API already sends `nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: origin`, so the issue overstates what is missing there. `Cache-Control` is genuinely absent.

#### D6. Where CSP violation reports are collected (decided)

`@sentry/nextjs` is already a dependency and is the destination. Three things were unsettled: the mechanism, the ingest path, and the volume story.

**Decision: `report-uri` only, pointed at the existing `open-next` Sentry project, with noise handled by Sentry's CSP inbound filters rather than by code.**

##### `report-to` is deliberately not set, and that is the whole decision

Sentry's own setup guide says to configure `report-uri` **and** `report-to` with a `Reporting-Endpoints` header, all pointing at the same Sentry URL. **Following that advice would silently lose most of our reports.**

- Browsers that support `report-to` **ignore** `report-uri` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to)). The two are not additive; the newer one wins where it is understood.
- The Reporting API delivers `POST`s with `Content-Type: application/reports+json` and a different body shape from the legacy `{"csp-report": {…}}`.
- **Sentry cannot ingest that format.** [getsentry/sentry#38940](https://github.com/getsentry/sentry/issues/38940) has been open since 2022-09-15; a Sentry employee confirmed on 2025-11-03 that the work "remains paused as we invest in other higher priority areas". Still open at the time of writing.
- `report-to` reached [Baseline "newly available" in March 2026](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to), so this is a live problem rather than a future one.

Compose those and the failure is exact: a Chromium browser sees `report-to`, ignores `report-uri`, posts `application/reports+json` to Sentry's security endpoint, Sentry cannot parse it, and the report is gone. No console error, no Sentry error, an empty violation stream from the majority of traffic — and an empty stream is precisely what this soak is trying to interpret.

**The directive is omitted on purpose, and chunk 3 carries a comment saying so**, because the obvious future maintenance action — "add `report-to`, `report-uri` is deprecated" — is the thing that breaks it.

##### The endpoint is derived, not pasted

Sentry's security endpoint is `https://<host>/api/<projectId>/security/?sentry_key=<publicKey>`, and all three components are already present in `NEXT_PUBLIC_SENTRY_DSN` (`https://<publicKey>@<host>/<projectId>`). Build it from the DSN at runtime in `csp.ts` rather than hardcoding a second copy that can drift from the one Sentry's SDK already uses. Append `sentry_environment` from `NEXT_PUBLIC_SENTRY_ENV`, so RC and production violations are separable.

A policy with no DSN configured must omit `report-uri` entirely rather than emit a malformed one — local development has no DSN, and `report-uri` pointing at `undefined` would make every page load post to a bogus URL.

##### Volume: Sentry's CSP inbound filters, not sampling in our code

The original concern was that a report-only CSP on a high-traffic public site emits a report per violation per page view, with browser extensions tripping it constantly. That needs no code.

Sentry has CSP-specific inbound filters at **Settings → Projects → open-next → Security Headers → CSP**: an "Additional ignored sources" list matched against `blocked_uri`, `source_file` and `document_uri`, plus an optional built-in default list of known-noisy sources. **Filtered reports are dropped at ingest and do not count against quota** — they appear in Stats as "Filtered". Add `chrome-extension` and `moz-extension` and enable the default list before the soak starts, not after.

##### The shared project is a known cost, accepted

Reports go to `open-next`, the project that already receives frontend errors, because its DSN is already plumbed through production env and a second project would need a second variable in every environment. The cost is real and belongs in the pre-flight rather than discovered mid-soak: CSP violations share quota and alerting with genuine frontend errors, during the one period they are expected to be noisy. **Before chunk 3 deploys, check what alerting is attached to `open-next` and confirm a soak's worth of violations will not page anybody.** If it does, that is the trigger to split the project after all.

##### Not built: a first-party collector

The alternative is a route handler — the repo already has four, e.g. `frontends/main/src/app/public-env.json/route.ts` — that accepts both report formats, filters and samples in our own code, and forwards via the Sentry SDK. That is the workaround the commenters on getsentry/sentry#38940 settled on, and it is the documented upgrade path if `report-uri` support actually erodes or if the Reporting API becomes the only way to collect something we need.

It is not built now because it adds a public unauthenticated POST endpoint to the critical path of a soak, plus code to a chunk already estimated at ~200 lines, to solve a volume problem that Sentry's inbound filters solve for free.

**A note on `connect-src`.** Sentry's documentation warns that its ingest domain must be in `default-src` or `connect-src` or "browsers will block requests that submit policy violations". Per spec a violation report is sent by the user agent and is not itself subject to the policy, so this should not be true — but D10's `connect-src 'self' https:` covers the ingest host either way, so the question is moot here and is recorded only so a future tightening of `connect-src` knows to check it rather than assume.

**Decided by:** @rhysyngsun. **Confirmed during the soak, not before:** that reports actually arrive. An empty stream must be distinguishable from a broken pipeline — see chunk 3's done-condition, which already requires the same proof for `frame-ancestors`.

#### D7. `frame-ancestors` is two values, not one list (decided)

`(site)` routes send `frame-ancestors 'self'`. The two `(embed)` routes — `/video/embed/<id>` and `/podcast/embed/<id>` — send `frame-ancestors *`.

The question was posed as "which origins legitimately embed learn.mit.edu" and asked of the OCW and MITx Online teams at [this comment](https://github.com/mitodl/hq/issues/14080#issuecomment-6373425561), on the assumption that the answer was a closed list. Two facts rule that shape out:

1. **OCW answered: it does not frame learn.mit.edu.** (@nlevesq, 2026-10-26.)
2. **Learn ships its own embed feature, and a closed list cannot express it.** `ShareDialog` exists to hand users an iframe snippet to paste on their own site, wherever that is. Those two routes must be framable from any origin, by design and as a product requirement. No origin list, however carefully gathered, is the right shape for them.

So the question is not "which origins" but "which routes". The split is exact and narrow: the `(embed)` route group is already separate in the App Router, already has its own minimal layout, and already carries `robots: "noindex, nofollow"`. Everything else — dashboard, cart, search, channels, settings — gets `'self'`, which is what closes the clickjacking finding the assessment raised.

**The accepted tradeoff.** Giving up: clickjacking protection on `/video/embed/<id>` and `/podcast/embed/<id>`. Those pages are **deliberately framable by any site, and therefore deliberately clickjackable.** That is inherent to shipping an embed feature; the mitigation is that they are media players with no state-changing controls, no authenticated actions and no cross-origin credentials, so there is nothing on them worth hijacking a click for. To get: `frame-ancestors` on every route that does carry such controls, without breaking a shipped feature. Revisit when: the embed pages grow an interactive or authenticated control, at which point this decision has to be re-argued rather than inherited.

`*` is written explicitly on the embed routes rather than omitting the directive. The two are mechanically identical — `frame-ancestors` does not fall back to `default-src` — but the explicit value is the difference between "deliberately open, because `ShareDialog` hands this URL to arbitrary third parties" and "someone forgot", and it gives the test something to assert against.

**MITx Online never answered.** No evidence of it framing Learn exists in any repo. The `frame-ancestors 'self' {openedx_base_url}` precedent in `ol-infrastructure` points the other way: it is mitxonline being framed _by_ Open edX, which says nothing about mitxonline framing Learn. The relationship in this repo runs in the opposite direction again — Learn _hosts_ the MITxOnline product pages (`proxy.ts` `mitxonlineSurrogateKey`, with per-item Fastly purge keys MITxOnline triggers), which is a canonical-page relationship reached by navigation, not framing.

Silence is therefore being treated as "no" until the soak says otherwise. That is a judgement, not a finding, and it is the one thing in this decision that could still be wrong — **so `frame-ancestors` ships report-only in chunk 3 specifically to check it before chunk 4 enforces.**

**A report-only `frame-ancestors` does emit violation reports; it simply does not block.** The sentence _"MUST be ignored when monitoring a policy, and when contained in a policy defined via a meta element"_ is [CSP Level 2](https://www.w3.org/TR/CSP2/). [CSP3](https://w3c.github.io/webappsec-csp/) dropped the monitoring half: §4.2.5's navigation-response check reports the violation for every policy and sets `Blocked` only when the policy's disposition is `enforce`. Only the `<meta>` restriction survives, which is what MDN still documents.

Two practical notes that follow. Implementations can lag a spec revision, so chunk 3 should confirm reports actually arrive rather than read silence as absence — but as a verification step, not as a reason to omit the directive. And a report-only `frame-ancestors` does not suppress `X-Frame-Options`, which matters for D9's sequencing: the older header keeps enforcing while the reports are watched.

**Would have won if** the embed routes did not exist, or if they shared a layout with the rest of the site so no clean route boundary was available to split on.

#### D8. Two policies from a shared base, not one string with a swapped directive (decided)

The `(site)` and `(embed)` groups get independently tuned policies built from a shared base. The branch is a pathname test in `frontends/main/src/proxy.ts`; the policy builder lives in a new `frontends/main/src/common/csp.ts` rather than in `common/config.ts`, which is thirty lines of env getters that client code already imports (`getCacheSMaxageSeconds` is read by `getQueryClient.ts`) and is the wrong import graph for a policy builder with its own test file.

The simpler option — one body, only `frame-ancestors` differing — was rejected because the embed document has a materially smaller legitimate script surface than the site, and is served into contexts nobody here controls. The embed layout loads no GTM, no Appzi, no HubSpot, no reCAPTCHA and no PostHog (`ConfiguredPostHogProvider` is mounted only from `app/(site)/SiteProviders.tsx`), so its `script-src` host allowlist can drop to `'self'` plus YouTube rather than inheriting the site's union.

**What this does not buy is protection of the embedding page.** A cross-origin iframe executes in **Learn's** origin, and the same-origin policy denies it the embedder's DOM, cookies and storage ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)), so a compromise of a script host trusted here does not reach an embedder's page. Allowlisting a host also does not load anything from it.

What it does buy:

- **Learn-origin compromise for embed viewers.** A malicious script running in the embed document has Learn's origin — its cookies, its storage, its API session. Those users may never visit learn.mit.edu directly, and the page they are on gives us no signal that anything went wrong.
- **Navigation hijacking of the embedding page.** `location.href` is one of the few things a cross-origin frame _can_ write. A compromised embed can redirect the top-level page of any site embedding it. That is a real cross-origin effect, and the only one.
- **Defence in depth on the surface we understand best.** The embed document's legitimate script needs are small and fully enumerable from this repo, unlike the site's, which depend on the GTM container's contents.

That is a narrow case. Re-argue it rather than inherit it if anyone revisits D8.

`'unsafe-inline'` is still forced on both groups by Next's own flight-payload scripts, so none of this makes the embed routes XSS-proof. It shrinks which third parties are trusted there.

**This creates a new invariant: nothing may add GTM, Appzi, HubSpot, reCAPTCHA or PostHog to the `(embed)` layout.** An invariant that exists only in prose will be broken, so it is locked by a test asserting the embed `script-src` contains no analytics host (see Testing & Rollout).

The cost is honest: two policies to maintain, two violation streams to interpret, and a soak that has to be read per group. Accepted for the reason above.

`next.config.js` `headers()` still cannot host any of this, for the reason given in D2 — it is evaluated at build time and the policy contains a per-environment host.

**The matcher must be exact.** Route groups are parenthesised and contribute nothing to the URL, so the rule targets `/video/embed/<id>` and `/podcast/embed/<id>` literally. `/video/<id>` and `/podcast/<podcastId>` are ordinary `(site)` pages; a loose prefix match that caught them would hand the embed policy to a large part of the catalogue. Two subtleties worth encoding in the matcher rather than rediscovering:

- Match **any** id segment, not just digits. Both pages `Number()`-parse the id and call `notFound()` on a non-positive non-integer, and that 404 renders from `(embed)/not-found.tsx` — still inside the embed group. A digits-only matcher would give that 404 the site policy, so a third-party embed of a deleted video would render as a blank frame instead of the embed not-found page.
- The id segment is **required**. `/video/embed` with no id resolves to `(site)/video/[id]` with `id="embed"`, so it is a site route.

**The branch lands in chunk 3, not chunk 4** — see Testing & Rollout. The reason is this decision: the two policies differ in more than `frame-ancestors`, so each has to be soaked against its own policy or the soak measures the wrong thing. That reason holds independently of D7, and it is the one that survived the correction recorded there.

#### D9. `X-Frame-Options: SAMEORIGIN` on `(site)` only, derived from `frame-ancestors` (decided)

`(site)` routes also send `X-Frame-Options: SAMEORIGIN`. `(embed)` routes send no `X-Frame-Options` at all.

The header is strictly redundant — where both are present, `frame-ancestors` wins and `X-Frame-Options` is ignored, in every browser Learn supports. It is set anyway because it costs one derived line and closes the finding by name for the next scanner pass, which is cheaper than arguing it away again in a year.

**It must be computed from the same source of truth as `frame-ancestors`, not written twice.** `xFrameOptions(group)` returns `SAMEORIGIN` if and only if that group's `frame-ancestors` is exactly `'self'`, and `null` otherwise. Hardcoding it is the failure mode: the two drift, and the drift is invisible.

The hazard this decision exists to prevent is specific and worth stating plainly. `X-Frame-Options` has no portable value meaning "any origin" — `DENY` and `SAMEORIGIN` are the only two values browsers agree on, `ALLOWALL` is not in the specification, and `ALLOW-FROM` was never widely implemented and is gone. So **adding `X-Frame-Options: SAMEORIGIN` to the existing `/:path*` rule in `next.config.js` would silently break every third-party embed of a Learn video or podcast.** That is the obvious place to put it, since the `nosniff` and `Referrer-Policy` rule is already there and already matches every path. `X-Frame-Options` has no reporting channel, so the report-only soak would not catch it: every externally embedded player would go blank, with no violation report, no console error and nobody paged. A test asserts that `next.config.js` emits no framing header for any source.

This concerns the frontend only. `django.middleware.clickjacking.XFrameOptionsMiddleware` is active in `main/settings.py` and `X_FRAME_OPTIONS` is unset, so api.learn.mit.edu already sends `DENY` — correct for a JSON API, and left alone.

#### D10. How far `default-src` reaches, and what `media-src` and `connect-src` allow (open)

The directive list in D3 has no `media-src`, and nothing above says whether `default-src` is set at all. The embed feature is what makes that bite.

`/video/embed/<id>` plays OVS HLS through video.js, and `/podcast/embed/<id>` feeds a podcast-RSS audio URL straight into an `<audio>` element. Neither host is enumerable from this repo (see the measured starting point). HLS compounds it: video.js fetches the `.m3u8` manifest and its `.ts` segments over XHR, which **`connect-src`** governs — and D3 scopes `connect-src` to the API, Sentry and the analytics vendors. A `default-src` with no `media-src` beside it, or a `connect-src` that lists only those three, breaks video playback.

This is not confined to the embed routes. `VideoResourcePlayer` is used on ordinary `(site)` video pages too.

**Set `default-src 'self'`.** Omitting it leaves every directive the policy does not name wide open, and `media-src` and `font-src` are evidence of how easy that class of omission is: neither surfaced until the embed feature forced the question. `default-src` is what makes the policy fail closed, so the report-only soak can tell you which fallbacks you broke. That is what the soak is for.

Having set it, these have to be named or they break. Starting point for chunk 3, to be corrected by the soak rather than trusted:

| directive     | value                                                                  | why                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media-src`   | `'self' https: blob:`                                                  | **`blob:` is mandatory.** video.js/VHS plays HLS through MSE via `URL.createObjectURL(mediaSource)`. Omit it and HLS dies — at enforce, silently.           |
| `worker-src`  | `'self' blob:`                                                         | VHS spawns its transmuxer from a blob worker.                                                                                                               |
| `connect-src` | `'self' https: https://www.google.com/recaptcha/`                      | VHS fetches the `.m3u8` and its segments by XHR from a host not knowable here. reCAPTCHA is listed explicitly even though `https:` subsumes it — see below. |
| `img-src`     | `'self' data: blob: https:`                                            | podcast cover art and the video.js `poster` are raw cross-origin URLs, not routed through the image optimizer.                                              |
| `font-src`    | `'self' data: https://use.typekit.net`                                 | the **root** `app/layout.tsx` loads the typekit stylesheet, so this applies to both groups, not just `(site)`.                                              |
| `style-src`   | `'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net` | Emotion and MUI inject `<style>` and inline `style=`; `MITLearnGlobalStyles` is in the embed layout too.                                                    |

**A cross-engine subtlety that will bite at enforce.** Chrome fetches HLS manifests and segments by XHR through MSE, so they fall under `connect-src`. Safari uses native HLS, where the media element fetches them, so they fall under `media-src`. Both must be permissive, and testing in one browser proves nothing about the other. This belongs in chunk 4a's pre-flight, not in a post-mortem.

**`cdn.jsdelivr.net` belongs in `script-src`, for a reason no amount of reading this repo would find.** Its only use in this codebase is `FONTSOURCE_CDN` in the certificate PDF route handler, which fetches in Node where CSP does not apply — so read from here, it belongs in no policy. The page says otherwise: the GTM container's Meta Pixel template injects a script from `cdn.jsdelivr.net`, falling back to `unpkg.com` (D11). A policy assembled from this repo's sources would break the Meta pixel at enforce, silently, on a surface nobody here watches.

Both are path-scoped to the one package in D11's table.

This is the clearest available instance of the warning in the measured starting point — reading source bounds the inventory from below, never from above — and it is why D11's container-inventory command exists rather than an inference from code.

**`ph.ol.mit.edu` belongs in the `(site)` `script-src` too, and for a reason the container inventory cannot reach.** PostHog is proxied at an MIT host (`NEXT_PUBLIC_POSTHOG_API_HOST`), and `posthog-js` loads its optional bundles as `<script>` from whatever that host is - see the measured starting point for the routing detail. So the policy must name it even though it appears in no vendor document, no GTM container and no literal in this repo. `(embed)` does not get it: `ConfiguredPostHogProvider` is mounted only from `app/(site)/SiteProviders.tsx`, and D8's invariant test asserts the embed `script-src` names it nowhere.

Three vendors, each found by a different method - GTM's container by fetching it, reCAPTCHA by reading Google's FAQ, PostHog by reading the library's shipped source. **No single method would have found all three.** Worth remembering before anyone treats a quiet soak as a complete inventory.

**reCAPTCHA: use Google's published values, not inferred hosts.** `react-google-recaptcha` (via `ol-components` `ReCaptcha.tsx`) wraps a HubSpot form in two `(site)` places — `OrgLeadForm` on `/organizational-learning`, and `StayUpdatedModal` on the `/courses/<id>`, `/courses/p/<id>` and `/programs/<id>` product pages. None of its hosts appear as literals in this repo; the library injects them. Google documents the policy directly ([reCAPTCHA FAQ](https://developers.google.com/recaptcha/docs/faq), and the same list in the [Cloud/Enterprise FAQ](https://docs.cloud.google.com/recaptcha/docs/faq)), so take them from the vendor rather than from a scanner or a guess. **Add to the `(site)` policy only:**

| directive     | add                                                                         |
| ------------- | --------------------------------------------------------------------------- |
| `script-src`  | `https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`      |
| `frame-src`   | `https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/` |
| `connect-src` | `https://www.google.com/recaptcha/`                                         |

Three things about that list are easy to get wrong:

- **The sources are path-scoped, not bare hosts.** Google's own guidance is `https://www.google.com/recaptcha/`, which permits that subtree only — materially tighter than allowlisting all of `google.com`, and the reason to read the vendor doc rather than infer from a violation report.
- **`recaptcha.google.com` is a third host**, needed in `frame-src` for the challenge iframe, and it appears nowhere in this codebase. A policy assembled by reading our source would break the challenge.
- **`connect-src` is required.** Our broad `connect-src https:` already covers it by accident. It is listed explicitly anyway, so that a future tightening of `connect-src` cannot silently break reCAPTCHA — an accidental dependency is not a satisfied one.

Google's preferred integration is a nonce, and reCAPTCHA also supports `'strict-dynamic'`. Both are unavailable to us for exactly the reason in D3 — one Fastly-cached HTML body for every viewer. This is the second vendor (after GTM) where that constraint costs something concrete, which is worth weighing if hq#14083 is ever revisited. The explicit-host list is a documented, supported fallback, not a workaround.

`recaptcha.net` is a non-issue today. The Enterprise doc offers it as a `www.google.com` substitute for global accessibility; `react-google-recaptcha` loads from `www.google.com` and nothing here overrides it. If that is ever changed, the policy must change with it.

**reCAPTCHA may not appear in the soak at all.** `HubspotForm` renders the widget only when `recaptchaRequested && Boolean(recaptchaSiteKey)`, where `recaptchaRequested` comes from `form.configuration?.recaptcha_enabled` — a setting in the HubSpot dashboard, outside this repo — and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is unset in local dev. So an empty violation sample is **not** evidence these directives are unnecessary; it may only mean the form config had reCAPTCHA off during the window. This is the same failure shape as GTM, and it is why these come from the vendor doc rather than from the soak.

**Do not wire `OVS_ALLOWED_MEDIA_HOSTS` into the CSP**, tempting as it looks. It is genuinely enumerable — `main/settings_course_etl.py` with a production value of `['.cloudfront.net']`, enforced in `learning_resources/etl/ovs.py` — and CSP's grammar would take `*.cloudfront.net` directly. Rejected because it is a backend ETL setting in a different part of the system: mirroring it into a `NEXT_PUBLIC_*` means the frontend CSP breaks silently whenever that list changes, with no test anywhere that notices. And podcast `audio_url` comes from arbitrary RSS enclosure hosts with no allowlist at all, so `media-src https:` is needed regardless. Recorded as a possible future tightening with the pointer, not as a TODO.

**What is still open:** whether the values above survive contact with production. That is chunk 3's soak to answer.

**Who decides:** whoever picks up `tk-chunk-3-csp-report-only-on-learn-mit-edu-emitted-f8001f`, in review on this RFC.

#### D11. Whether the site `script-src` permits arbitrary HTTPS hosts, or GTM loses its deploy-free workflow (decided)

D3 asserts two things that cannot both be true: that `script-src` keeps a host allowlist, and that GTM can still add third-party tags without a code deploy. `'unsafe-inline'` does not bridge them — it covers inline code only, and an external `<script src>` from a non-allowlisted host is blocked however it was injected. One of the two has to give.

**Decision: option C — keep the host allowlist, seeded by the measured container inventory below rather than by waiting for the soak.** The report-only soak stays, demoted from source of truth to confirmation.

The three options were:

- **Option A — `script-src ... https:`.** Any HTTPS host may serve script. GTM's workflow is genuinely preserved and no marketing change can be broken by this policy. The `script-src` then constrains almost nothing beyond blocking `http:` and `data:` sources.
- **Option B — keep the host allowlist.** Materially stronger: an injected `<script src>` pointing at attacker infrastructure is blocked, which is the one XSS escalation path `'unsafe-inline'` leaves open. The cost falls on another team — a new GTM tag from a new host needs an engineering deploy, and until then it fails silently in a marketing workflow that has never needed one.
- **Option C — allowlist, with the soak as the inventory.** As B, but sized by evidence rather than guesswork.

**What settled it.** The container's owners were asked what it contains ([hq#14080](https://github.com/mitodl/hq/issues/14080#issuecomment-6426627862)) and answered: Google Analytics, Google Ads, and a Meta tracking pixel. That answer was then **verified directly against the production container**, which is public — see "Measuring the GTM container" below. The script surface is six sources, all stable vendor endpoints. B's cost is real but small and now quantified, which is what makes it acceptable to impose.

**The finding that rules out option A.** The Meta Pixel template loads its CAPI parameter builder from `cdn.jsdelivr.net`, falling back to `unpkg.com`. Both serve the _entire_ npm registry. Under option A they would be permitted wide open, as would every other npm package, and nothing would ever report it. Under C they are **path-scoped** to the one package, which keeps most of the allowlist's value at no cost.

**The ongoing cost this accepts.** The container changes without a deploy here, so a new script host can appear at any time and will be blocked once chunk 4b enforces. Two mitigations, both in chunk 3: the report-only soak reports a `script-src` violation before anything enforces, and the container-inventory command below is cheap enough to run on a schedule, which gives warning _before_ the violation rather than after.

**Still open with the container's owners, and not answered by the payload:** how often a genuinely new vendor is added, and whether the GTM environments are used as a staging path. Neither changes the host list; both set the expectation for how disruptive the deploy cost is. Track with the issue thread, not with this RFC.

**Consequences elsewhere.** GTM does not keep a deploy-free workflow for _new hosts_; that is the cost D3's tradeoff accepts. And GTM container write access stays inside the trust boundary but is bounded by this: a compromised container can still fire arbitrary _requests_ at allowlisted hosts and exfiltrate through them, but it cannot load executable script from an attacker-controlled origin.

#### Measuring the GTM container

The container is served as public JavaScript, so its contents are evidence rather than something to be taken on trust. This is the procedure that produced the list above; re-run it whenever the allowlist is in doubt.

```sh
# 1. container id, auth and environment, straight out of production.
#    Derived rather than pasted: all three change when the container's
#    environment does, and a hardcoded copy would fetch a stale container
#    while looking like it worked.
#    Read off the <noscript> iframe, NOT the inline bootstrap -- the latter
#    builds its query string at runtime ("gtm.js?'+q+dl"), so matching on
#    gtm.js here silently captures JavaScript source instead of parameters.
Q=$(curl -s https://learn.mit.edu/ | grep -oE 'ns\.html\?[^"]+' | head -1 | sed 's/^ns\.html?//; s/&amp;/\&/g')

# 2. fetch the container (~556 KB of JavaScript)
curl -s "https://www.googletagmanager.com/gtm.js?$Q" -o gtm.js

# 3. every host it references, anywhere
grep -oE 'https?://[a-zA-Z0-9._-]+\.[a-z]{2,}' gtm.js | sed -E 's|https?://||' | sort -u

# 4. what it may inject as SCRIPT — the authoritative list
grep -oE '"inject_script":\{"urls":\[[^]]*\]' gtm.js | sed 's/\\\//\//g'

# 5. tag inventory by type
grep -oE '"function":"__[a-z0-9_]+"' gtm.js | sort | uniq -c | sort -rn
```

**Tag inventory, measured 2026-10-27.** `__gaawe` ×17 (GA4 events), `__googtag` ×2 (GA4/Ads base), `__awct`, `__awec`, `__gclidw` ×1 each (Ads conversion, enhanced conversions, conversion linker), `__cvt_250259136_30` ×1 (the Meta Pixel custom template), `__html` ×1, `__paused` ×57. The remainder are variables and triggers, not tags.

Three properties of that inventory are what make the allowlist tractable, and each should be re-checked rather than assumed on a later reading:

- **Exactly one Custom HTML tag**, and it loads `https://www.googletagmanager.com/gtag/js?id=AW-18124108938` — a host already on the list. Custom HTML is the unbounded tag type, so its being singular and pointed at an allowlisted host is the strongest single fact here.
- **The 57 paused tags introduce no new hosts.** Every hostname anywhere in the payload is accounted for below, so unpausing one cannot break the policy.
- **Step 4 is authoritative for script.** GTM custom templates must declare script injection in an `inject_script` permission block. Built-in tags (GA4, Ads) declare nothing because they are compiled into the runtime, which is why Google's published guidance is needed alongside it.

**`script-src` sources, and why each is there.**

| source                                                           | why                                     | evidence                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `https://www.googletagmanager.com`                               | GTM core; `gtag/js` for GA4 and Ads     | [Google's CSP guide](https://developers.google.com/tag-platform/security/guides/csp) + container |
| `https://www.googleadservices.com`                               | Google Ads conversion                   | Google's CSP guide                                                                               |
| `https://www.google.com`                                         | Google Ads conversion                   | Google's CSP guide                                                                               |
| `https://connect.facebook.net`                                   | Meta Pixel `fbevents.js`                | container `inject_script`                                                                        |
| `https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/` | Meta CAPI param builder, primary source | container `inject_script`                                                                        |
| `https://unpkg.com/meta-capi-param-builder-clientjs/`            | the same bundle, fallback source        | container `inject_script`                                                                        |

The two CDN entries are **path-scoped deliberately**; CSP source expressions match a path prefix when it ends in `/`. One caveat to carry: the path component is **not** re-checked after a redirect, so path scoping constrains the initial fetch only.

**The non-script directives need no additions.** Google documents `*.google-analytics.com`, `*.google.com`, `*.g.doubleclick.net`, `pagead2.googlesyndication.com`, `ad.doubleclick.net` and `googleads.g.doubleclick.net` across `img-src` and `connect-src`, plus a `*.google.<TLD>` placeholder standing for every Google country domain; Meta adds `www.facebook.com`. GA4's collection host is assembled at runtime as `<region>.google-analytics.com`, so it is not a fixed hostname at all. D10's `connect-src 'self' https:` and `img-src 'self' data: blob: https:` subsume all of it — including the `<TLD>` placeholder, which could not be enumerated. **This is the concrete thing a future tightening of either directive would have to enumerate first**, and the reason neither is tightened here.

#### D12. The OCW-on-Learn route gets its headers from Fastly, because it has no application (decided)

D1 puts headers in the applications. That covers every learn.mit.edu document Next.js renders and misses a class of documents it does not render: `/courses/o/<slug>` is rewritten in VCL and served from the `ocw_site` S3 bucket, so neither Next.js nor Django is in its request path (see the measured starting point). Left alone, a scanner re-running the assessment finds `X-Content-Type-Options`, `Referrer-Policy` and `Content-Security-Policy` still missing on learn.mit.edu after every other chunk lands, and `frame-ancestors 'self'` on `(site)` leaves same-origin OCW pages framable by anyone.

**Decision: split by who serves the document.** Fastly owns the headers on documents Fastly serves from S3. The applications keep the rest, exactly as D1 says.

- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` go on the MIT Learn Fastly service as unconditional `response`-type `ServiceVclHeaderArgs`, beside the `Strict-Transport-Security` entry already there. Unconditional is deliberate: it covers the OCW, media-bucket and Next.js backends alike, and the values are byte-identical to the ones chunk 1 sets, so the overlap is a no-op.
- `frame-ancestors 'self'`, report-only, scoped with a `response_condition` on the existing "OCW course requests" condition.

**The CSP must never be set unconditionally at Fastly.** Fastly's response header rules run after the origin's, so an unconditional `set` replaces whatever the application emitted. Harmless for two static headers with one value each; destructive for the CSP, where it would silently overwrite the per-route-group policy `proxy.ts` builds (D8). This is the mechanical reason the two layers cannot co-own a header, and it is a stronger argument for D1 than the three D1 gives.

**A full CSP for the OCW documents is deliberately not in this RFC.** Their script inventory lives in `ocw-hugo-themes`, not here, and ocw.mit.edu has the identical gap — it sends no security headers at all beyond `Strict-Transport-Security: max-age=300`. That is work owned with the OCW team, with its own inventory and its own soak, and folding it in would make this RFC's soak answer two questions at once. `frame-ancestors` is the exception because it needs no inventory: the question it answers is who frames learn.mit.edu, which chunk 3 is already asking for every other route.

**Would have won if** the OCW route were proxied through Next.js, in which case chunk 1 would already cover it, or if the two backends wanted different static header values, in which case an unconditional `set` would be wrong.

**Decided by:** @rhysyngsun, after @zawan-ila identified the route in review.

### Security Considerations

**What this closes.** After D1–D4 and D7 land: clickjacking via framing on every route except the two embed routes (`frame-ancestors`, D7), plugin-based content injection (`object-src 'none'`), base-tag hijacking that redirects relative script URLs (`base-uri 'none'`), form exfiltration to third-party origins (`form-action 'self'`), MIME-sniffing attacks (`X-Content-Type-Options: nosniff`), full-URL referrer leakage to third parties (`Referrer-Policy`), framework version disclosure (`X-Powered-By`), and shared-cache retention of user-specific API responses (D5).

**What this does not close, and will not.** Cross-site scripting. With `'unsafe-inline'` in `script-src`, an attacker who achieves HTML injection executes script. The CSP constrains where script may be _loaded from_; it does not constrain inline execution. Anyone reading "learn.mit.edu now has a CSP" and inferring XSS protection has inferred wrongly, and a subsequent assessment could reasonably raise the same finding. This is the single most important caveat in this document and the reason hq#14083 exists.

**Residual risk from the permissive `script-src`.** The host allowlist still has value — it blocks loading script from an arbitrary attacker-controlled origin, and `object-src 'none'` plus `base-uri 'none'` remove two common escalation paths.

GTM can load third-party script by design, so everyone with write access to the container is inside the trust boundary. D11 bounds what that access reaches, and the bound is worth stating precisely:

- **What a compromised container can no longer do:** load executable script from an attacker-controlled origin. Adding a tag pointing at a new host produces a blocked request and a violation report, not execution.
- **What it can still do:** anything expressible through the already-allowlisted hosts and the rest of the policy — including firing arbitrary requests at Google's and Meta's endpoints with attacker-chosen payloads, which is an exfiltration channel. `'unsafe-inline'` also means a container-injected _inline_ script still runs.

So GTM write access remains inside the trust boundary; it is no longer unbounded. The two npm CDNs needed by the Meta template are the weakest link and are path-scoped for exactly that reason (D11).

**`Referrer-Policy` governs what Learn sends, not what Learn receives.** The value is `strict-origin-when-cross-origin`.

A `Referrer-Policy` response header controls the `Referer` on requests made **from** the documents it is served with — outbound navigations, subresource loads, `fetch` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy)). It has no effect on the referrer arriving on an inbound navigation: when OCW links to Learn, **OCW's** policy and link attributes decide what Learn sees. So tightening this header to `same-origin` or `no-referrer` would **not** strip the `Referer` on OCW-originated visits, and the OCW search rollout ([mitodl/hq#13617](https://github.com/mitodl/hq/issues/13617), [mitodl/hq#13767](https://github.com/mitodl/hq/issues/13767)) is not an argument for this value in either direction.

The actual case for `strict-origin-when-cross-origin` is outbound disclosure, and it is enough on its own. It is the modern browser default. It sends the full URL same-origin, where paths are already visible, and only the origin cross-origin — so Learn stops leaking the path and query of pages a user came from to third parties, which on a search-driven site means stripping query strings out of what GTM's tags, HubSpot, Appzi and every embedded player see in their `Referer`. `no-referrer` would be tighter still and would cost same-origin diagnostics for no privacy gain against third parties; `same-origin` sends nothing cross-origin, which breaks nothing we know of but also buys nothing over origin-only.

**The embed routes are exempt from the clickjacking protection, on purpose.** D7 states the tradeoff; it is repeated here because this section is what a future assessment reads. `/video/embed/<id>` and `/podcast/embed/<id>` send `frame-ancestors *` and can be framed by anyone. They carry no authenticated actions and no state-changing controls, which is why that is acceptable — and that property is a precondition of the decision, not a coincidence. Adding one to those pages reopens D7.

**The inbound login link from a third party is unaffected by this policy.** OCW (and anything else) can link a user to Learn to log in and get them back. That flow is `GET https://api.learn.mit.edu/login?next=…` → APISIX `openid-connect` 302 (`config/apisix/apisix.yaml`, route `reqauth`) → Keycloak → 302 back → `CustomLoginView.get` 302 (`authentication/views.py`). Every leg is a GET and a redirect; there is no form POST anywhere in it, and the one document that does carry a credential form is served from Keycloak's origin under Keycloak's own CSP. `form-action 'self'` on learn.mit.edu therefore cannot touch it, and neither can `frame-ancestors`. The round trip is already gated by `ALLOWED_REDIRECT_HOSTS` in `main/settings.py`, which is where that trust decision lives and stays. Recorded because it looks like it ought to be a CSP concern and is not.

**`Cache-Control` scoping cuts both ways.** Too narrow and user-specific responses stay cacheable in shared caches, which is the finding. Too broad and public search endpoints lose caching at the moment OCW starts sending them significant traffic.

### Testing & Rollout

Seven chunks. Chunk 1 is stacked on this RFC's own pull request, so it merges after this document does. Chunks 1b, 2, 3 and 3b are independent of it and of each other, and may land in any order or in parallel. Chunk 4a depends on chunk 3 being **deployed and soaked**, not merged; chunk 4b additionally depends on 4a being deployed and on 3b's data having been read. Sizes are estimates taken from the measured starting point and are re-measured during implementation. Epic: `tk-add-missing-security-headers-to-learn-mit-edu-an-4097f6`.

The per-route-group branch lands in chunk 3 rather than at the enforce step, because the two policies differ in more than `frame-ancestors`: a single union policy would soak the wrong experiment for at least one group (D8). Chunk 3 carries `frame-ancestors` rather than omitting it, because report-only reports it (D7).

#### Sequencing

1. **Static headers** — `tk-chunk-1-static-security-headers-on-learn-mit-edu-9062b4`, ~40 lines estimated / 171 actual, touches `frontends/main/next.config.js` and `frontends/main/src/nextConfig.test.ts`.
   Done when `curl -sI https://learn.mit.edu/` shows `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and no `X-Powered-By`. Built and open for review, stacked on this RFC's pull request so it merges after this document does. This covers Next.js-rendered routes only; `/courses/o/<slug>` is chunk 1b's (D12).

2. **Headers on the OCW-on-Learn route** — chunk 1b, ~15 lines in `ol-infrastructure` `src/ol_infrastructure/applications/mit_learn/__main__.py`. D12 decided; independent of every other chunk.
   Adds `X-Content-Type-Options` and `Referrer-Policy` unconditionally on the MIT Learn Fastly service, plus a report-only `frame-ancestors 'self'` scoped to the OCW backend.
   Done when `curl -sI https://learn.mit.edu/courses/o/<slug>/` shows all three **and** `curl -sI https://learn.mit.edu/` still shows chunk 1's values unchanged. The second half is the real check: Fastly's response headers run after the origin's, so it is what proves the unconditional `set` did not clobber the application's.

3. **API cache scoping** — `tk-chunk-2-cache-control-no-store-on-user-specific--c0a90d`, ~80 lines estimated / ~430 actual, touches new `main/cache_policy.py` and `main/middleware/cache_policy.py` plus their tests, `main/utils.py` (the SHARED stamp), `main/utils_test.py` and `main/settings.py`. D5 decided; no open dependency.
   Done when an authenticated response carries `Cache-Control: no-store` and an anonymous search response still carries its existing caching headers, both asserted in tests rather than checked by hand.

4. **CSP report-only, per route group** — `tk-chunk-3-csp-report-only-on-learn-mit-edu-emitted-f8001f`, ~200 lines, touches a new `frontends/main/src/common/csp.ts` and its test, plus `frontends/main/src/proxy.ts`, `frontends/main/src/proxy.test.ts` and `frontends/main/src/nextConfig.test.ts`. Requires D10 only; D6 is decided.
   Ships **both** policies as `Content-Security-Policy-Report-Only`, **including `frame-ancestors`** — report-only reports it without blocking (see D7), which is the pre-enforcement signal on who actually frames the site. Ship the intended values: `'self'` for `(site)`, `*` for `(embed)`.
   Done when both headers are live, violations are arriving at the chosen collector, a violation sample has been gathered **per route group** over a stated soak window, and `frame-ancestors` reporting has been confirmed to actually fire — load a framed page from an off-origin test page and check a report lands, so that later silence can be read as absence rather than as a broken pipeline.

5. **Framing telemetry** — chunk 3b, ~20 lines in `frontends/main/src/app/(site)/SiteProviders.tsx`. Independent of chunk 3; lands alongside it.
   **Supplementary to chunk 3's `frame-ancestors` reports, not a replacement for them.** It earns its ~20 lines because CSP reports identify the blocked frame rather than the framing origin, and `document.referrer` names the embedder directly.
   A client-side probe inside the already-mounted `ConfiguredPostHogProvider`: when `window.self !== window.top`, capture the framing origin. It has to be client-side — learn.mit.edu HTML is Fastly-cached, so a `Sec-Fetch-Dest: iframe` check at the origin would observe only cache misses, and adding that header to the cache key would wreck the hit ratio D3 exists to protect.
   **Do not capture `document.referrer` raw.** Same-origin it is the parent's full `href`, including path and query, and a third-party embedder running a permissive policy can send a full URL too — the referring page controls this, not us ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer)). Normalise to an origin before it reaches PostHog. It can also be the empty string, and `location.ancestorOrigins` does not exist in every engine, so feature-detect it and record an explicit `unknown` bucket rather than dropping those visits — a framed visit we cannot attribute is a different finding from no framed visit, and only one of them is reassuring.
   Done when the probe has run for the length of chunk 3's soak and the set of observed framing origins has been written down, reconciled against the `frame-ancestors` reports from chunk 3.

6. **Enforce the embed policy** — chunk 4a, `frontends/main/src/common/csp.ts` and its test. Requires chunk 3 deployed and soaked.
   Flips the `(embed)` group to enforcing. `frame-ancestors *` is already live from chunk 3; this makes it binding.
   Done when `/video/embed/<an ovs id>` and `/podcast/embed/<id>` play in **both** Chrome (MSE, so `connect-src`) and Safari (native HLS, so `media-src`), and both load correctly from an off-origin test page.

7. **Enforce the site policy** — chunk 4b, `tk-chunk-4-enforce-the-csp-and-add-frame-ancestors-57a453`, ~20 lines. Requires chunk 4a deployed, and both chunk 3's `frame-ancestors` reports and chunk 3b's probe data read.
   Flips the `(site)` group to enforcing and adds `X-Frame-Options: SAMEORIGIN` (D9). `frame-ancestors 'self'` is already live from chunk 3; this is the point at which it starts blocking.
   Done when the header is `Content-Security-Policy` rather than `-Report-Only` and the Fastly HTML hit ratio is unchanged.
   **This is the chunk that can break a third party.** Any origin that showed up in chunk 3's `frame-ancestors` reports or 3b's probe and has not been accounted for must be resolved before the flip, not after — that evidence is the whole reason both exist.

**Why 4 is split.** The two policies have disjoint violation surfaces, and flipping both at once throws away the ability to attribute a regression to one of them. The embed policy goes first because its surface is small and fully derivable from this repo, whereas the site policy's depends on the GTM container's contents. The counter-argument is real and should not be glossed: an embed breakage is _harder_ to notice than a site breakage, because it happens on a page nobody here is watching. That is why 4a's done-condition is a manual two-browser, two-origin check rather than "no reports arrived".

#### Verification

Beyond each chunk's done-condition:

- **Headers are verified against production, not locally.** `curl -sI https://learn.mit.edu/`, `curl -sI https://learn.mit.edu/courses/o/<slug>/` and `curl -sI https://api.learn.mit.edu/api/v0/users/me/` with a session. Five layers can set a header on these hostnames and a local run exercises one of them. The OCW path is a separate check rather than a spot-check of the homepage, because it is served by a different backend entirely (D12).
- **Cache safety is asserted in CI, not inferred from a metric afterwards.** D3 was chosen specifically so the policy is identical for every viewer and the cache is unaffected, and D8's branch keys on pathname only — never on a request header — so Fastly's per-URL caching needs no `Vary` and the hit ratio cannot move. Encode that as a test: call `proxy()` twice for the same path with different `Referer`, `Cookie` and `Sec-Fetch-Dest`, and assert the policy is byte-identical. The post-deploy hit-ratio check after chunk 4b stays as a backstop; a drop means something made responses vary per request, which is a bug and not an accepted cost.
- **The soak's violation budget is written down before the flip.** An enforce with unexplained violations in the sample means the policy is still wrong for somebody who has not been identified.
- **OCW's integration is exercised after chunk 2.** A public search request from a browser on ocw.mit.edu should still be served with its existing caching headers.
- **Both route groups are checked, separately.** `curl -sI https://learn.mit.edu/video/embed/<id>` and `curl -sI https://learn.mit.edu/` must show different policies, and `/video/<id>` must show the site one. A single spot-check of the homepage cannot distinguish a working branch from a branch that never fires.

Five of chunk 3's tests are load-bearing rather than routine, in the sense that the bug each prevents is silent:

1. **A `routeGroup()` table**, written first. `embed`: `/video/embed/123`, `/video/embed/123/`, `/podcast/embed/137277`, `/video/embed/abc`. `site`: `/video/123`, `/video/123/slug`, `/podcast/137277`, `/podcast/137277/podcast_episode/1`, `/video-playlist/5`, `/video/embed`, `/`, `/search`, `/courses/course-v1:MITxT+5.601x`. This is the regression test for the parenthesised-route-group trap in D8.
2. **A gap guard**: every policy either sets `default-src` or names every one of `media-src`, `font-src`, `connect-src`, `img-src`, `worker-src`, `frame-src`, `style-src`, `script-src`. This is what stops D10's class of omission recurring.
3. **An HLS guard**: `media-src` and `worker-src` both contain `blob:` on both groups. The failure it prevents appears only at enforce.
4. **The D8 invariant**: the embed `script-src` contains no GTM, Appzi, HubSpot, reCAPTCHA or PostHog host.
5. **No framing header from `next.config.js`**, for any source — asserted through Next's own `buildCustomRoute`, as chunk 1's tests already do. This is the guard against the one mistake in this design that breaks a user-facing feature silently on third-party sites.

Assert per directive against a parsed policy, not against the whole header string: whole-string assertions rot on every reorder and say nothing useful when they fail.

#### Rollback

Chunks 1, 2, 4a and 4b revert cleanly — headers appear and disappear with the deploy, and no data or external contract moves. Chunk 3 is report-only and carries no user-visible behaviour to roll back, though a misconfigured collector can generate significant report volume; D6 settles that with Sentry's CSP inbound filters, which drop noise at ingest without consuming quota. Chunk 3b writes only telemetry.

One asymmetry to plan for: a 4a regression surfaces on **other people's sites**, not ours. Nobody here is watching an embedded player on a third-party page, and an enforced-CSP breakage there looks like a blank frame to that site's visitors. Reverting is trivial; noticing is the hard part, which is why 4a's done-condition is an explicit manual check rather than an absence of alerts.

### Non-goals

- **Gateway TLS and HSTS.** Tracked separately. Fastly already sets `Strict-Transport-Security`.
- **A strict `script-src`.** Deliberately deferred — see D3 and [mitodl/hq#14083](https://github.com/mitodl/hq/issues/14083). This RFC should not be amended to add it; that work replaces part of this policy and gets its own RFC if it needs one.
- **Changing the HTML caching strategy.** The entire shape of D3 follows from leaving it alone.
- **The shared APISIX CORS configuration.** Already addressed by `ol-infrastructure` [#5755](https://github.com/mitodl/ol-infrastructure/pull/5755), which replaced the wildcard default with required per-app origin lists.
- **A full `Content-Security-Policy` for the OCW-on-Learn documents.** D12 gives that route its static headers and a report-only `frame-ancestors`, and stops there. The rest needs an inventory from `ocw-hugo-themes` and a soak of its own, and ocw.mit.edu has the same gap, so it belongs to a piece of work owned with the OCW team.
- **`Content-Security-Policy` on api.learn.mit.edu.** The assessment lists it, but a CSP on a JSON API has no document context to constrain and buys nothing. If a reader disagrees, that is a decision to open as a new D-number rather than an omission.
- **Enumerating OVS and podcast media hosts in the policy.** `media-src` and `connect-src` stay broad. See D10 for why mirroring `OVS_ALLOWED_MEDIA_HOSTS` into the frontend is a worse trade than it looks, and why podcast audio has no allowlist to mirror in the first place.
- **Removing the embed routes' `frame-ancestors *`.** That is the feature, not a finding. Narrowing it is a product decision about `ShareDialog`, not a security fix, and would be a different RFC.

### Open questions

|     | Question                                                                                               | Who answers                                        |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| D10 | Whether D10's directive values survive production, and which reCAPTCHA hosts the policy actually needs | Chunk 3's soak, read by the implementer of chunk 3 |

D6 is closed. It was "where CSP violation reports are collected", and the answer is narrower than it looks: `report-uri` to the existing `open-next` Sentry project, with `report-to` **deliberately omitted** because Sentry cannot ingest the Reporting API format and browsers that understand `report-to` ignore `report-uri` — so following Sentry's own setup guide would have produced an empty violation stream from most traffic, silently. Volume is handled by Sentry's CSP inbound filters rather than by code. See D6.

D5 is closed. It was "which mechanism scopes `no-store` to user-specific responses", and it was answered by building it: a fail-closed response middleware over a classification layer that reuses the view-cache decorators already in `main/utils.py`. The one thing it still owes is a production baseline — an authenticated `curl` against `/api/v0/users/me/`, which needs a session nobody has run yet. See D5.

D11 is closed. It was "may `script-src` keep a host allowlist", asked of the GTM container's owners [here](https://github.com/mitodl/hq/issues/14080#issuecomment-6426627862). They answered that the container holds Google Analytics, Google Ads and a Meta pixel; that answer was then verified against the production container directly, which turned the question from a negotiation into a measurement. Six script sources, all enumerable. Two follow-ups stay with that team and gate nothing here: how often a genuinely new vendor is added, and whether the GTM environments are usable as a staging path. See D11.

D7 is closed. It was "which origins legitimately embed learn.mit.edu", asked of the OCW and MITx Online teams [here](https://github.com/mitodl/hq/issues/14080#issuecomment-6373425561). OCW answered no; MITx Online never answered, and rather than waiting, chunk 3 ships `frame-ancestors` report-only and chunk 3b probes from the client. Both must be read before chunk 4b enforces. See D7.

### Risks

**The violation inventory is incomplete.** The third-party host list was assembled by reading source, and runtime behaviour differs — GTM loads tags configured outside this repo, and those tags load whatever they like. Mitigated by D4's soak, which is the only way to find them. Residual risk: a low-frequency tag that fires for a small audience may not appear in the sample and will break at enforce. Accepted; the reporting stays on after the flip so it surfaces as a report rather than a silent failure.

**D7 still ships on a judgement, but the soak now checks it.** `frame-ancestors` is the directive the assessment most directly motivates, and whether anything other than Learn frames `(site)` is the one part of D7 that remains inference. Chunk 3 ships the directive report-only and chunk 3b probes from the client, so there are two independent instruments. Residual risk: a low-traffic embedder whose users simply do not visit during the soak window. If either instrument returns an unexpected origin, `frame-ancestors 'self'` on `(site)` has to be reconsidered before chunk 4b, not after.

**Uncited browser-behaviour claims are the ones to distrust.** Several decisions here turn on what a browser does with a directive, and the cited ones carry a link to a specification or to MDN for that reason. Any claim in this document without one deserves the same treatment before chunk 4 enforces anything.

**The OCW-on-Learn documents stay partly uncovered.** D12 gives `/courses/o/<slug>` its static headers and a report-only `frame-ancestors`, but no `script-src`, `object-src`, `base-uri` or `form-action` — and those documents do load third-party script on the learn.mit.edu origin. So "learn.mit.edu has a CSP" will be true of the routes Next.js renders and false of these, which is a distinction a future assessment is entitled to draw. The mitigation is that the gap is named and owned, not that it is closed.

**An embed-policy regression is invisible from here.** Chunk 4a enforces a policy on documents that render inside other people's pages. A breakage shows up as a blank frame to that site's visitors, with no report, no error and no alert on our side. Mitigated by 4a's manual two-browser, two-origin done-condition and by keeping the embed violation stream separate from the site one. This is the reason chunk 4 is split rather than flipped at once.

**The embed routes' exemption could be inherited rather than re-decided.** D7's `frame-ancestors *` is safe only because those pages carry no state-changing or authenticated controls. Nothing structurally enforces that. If someone adds an interactive control to the embed player, the decision silently becomes wrong. Partially mitigated by D8's test guard against analytics creeping into the embed layout, which is adjacent but not the same invariant.

**Line numbers in this document rot.** Anchored to `0deaee154` and `a3a258ee4` as noted in the header. If an anchor does not match, the code moved; re-derive from the symbol name rather than assuming this RFC is describing something that no longer exists.

**GTM container write access is part of the trust boundary, now bounded rather than unbounded.** Anyone reasoning about the site's script trust boundary should still start from the GTM container's access list. D11 chose the allowlist, so a compromised container can only load script from already-allowlisted hosts — see Security Considerations for what that does and does not rule out. The cost accepted in exchange is that a legitimate new tag from a new host is blocked until the allowlist is updated and deployed.

**The container can change without a deploy in this repo, and the allowlist cannot.** This is the live risk D11 creates rather than removes. A new script host appears the moment someone saves the container; the policy only learns about it from a violation report, after the fact. Chunk 3's soak catches it while nothing is enforced, and D11's inventory command catches it earlier still if run on a schedule — but between chunk 4b and whenever someone looks, a new tag fails silently. **Who holds that responsibility is not yet assigned**, and assigning it is part of the handover this RFC owes whoever runs the container.

**The allowlist was measured once, on 2026-10-27.** Every claim in D11 about what the container contains is a point-in-time observation of `GTM-NMJ2CT6T` / `env-1`. Re-run the inventory before trusting it; a reader two quarters from now should assume it has drifted.
