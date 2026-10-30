---
parent: How-To
nav_order: 3
---

# Adding a new vendor to GTM when learn.mit.edu has a CSP

learn.mit.edu sends a Content-Security-Policy that names which hosts may serve JavaScript. The GTM container is configured outside this repo and can start loading a script from a new host at any time, with no deploy here. When that host is not in the policy, the browser refuses to load it.

This is what to do about it, from both sides: the person adding the tag in GTM, and the engineer who changes the policy.

## The short version

| What you are adding                                                  | Needs a code change? |
| -------------------------------------------------------------------- | -------------------- |
| A new tag using a vendor already in the container                    | No                   |
| A new trigger, variable, or GA4 event                                | No                   |
| A tracking pixel (an image) or a beacon from any host                | No                   |
| **A new vendor template that loads its own script**                  | **Yes**              |
| **An existing vendor that starts loading from a new host**           | **Yes**              |
| **A tag that renders an iframe from a host we do not already frame** | **Yes**              |

Only `script-src` and `frame-src` are narrow allowlists. `img-src` and `connect-src` permit any HTTPS host, so pixels, beacons and XHR to a new vendor need nothing from engineering. See [RFC 0007](../rfcs/0007-security-headers.md) D3 and D10 for why those two are permissive and the other two are not.

## Why GTM's deploy-free workflow stops at the host

GTM exists so marketing can add tags without a code deploy, and that still holds for everything in the "No" rows above.

It does not hold for a new script host. The policy allows inline script (`'unsafe-inline'`), which is what GTM's own bootstrap needs, but `'unsafe-inline'` covers inline code only. An external `<script src>` pointing at a host outside the allowlist is blocked whether it was written into the page or injected by already-running JavaScript - which is exactly how GTM loads a vendor's script. There is no way to express "trust whatever GTM decides to load" without permitting every HTTPS host, which would give away most of what the allowlist is for.

This cost was accepted deliberately. RFC 0007 D11 records the alternatives and why this one won.

## Which state is production in

The consequence of a missing host depends on whether the policy is enforcing yet:

```sh
curl -sI https://learn.mit.edu/ | grep -i content-security-policy
```

- **`Content-Security-Policy-Report-Only`** - nothing is blocked. A new host is _reported_ to Sentry and the tag still works. This is a warning, and it is the cheapest time to fix it.
- **`Content-Security-Policy`** - the script is blocked. The tag does nothing, there is no visible error on the page, and the only signal is the violation report.

## How a new host gets noticed

In descending order of how early it catches the problem:

1. **The container inventory**, run against production. This is the only check that sees a host _before_ a visitor does. The procedure is in [RFC 0007](../rfcs/0007-security-headers.md) under "Measuring the GTM container"; step 4 lists what the container may inject as script, which is authoritative for custom templates.
2. **A CSP violation report in Sentry**, in the `open-next` project. `blocked_uri` names the host. Under report-only this arrives while the tag is still working.
3. **Somebody noticing a tag stopped reporting.** This is the state to avoid: it only happens after the policy is enforcing, and the lag is however long it takes marketing to look at a dashboard.

Nobody is currently assigned to (1). Until someone is, (2) is the real detection channel.

## Before you publish the tag (GTM side)

GTM requires a custom template to declare every URL it may load as script in an `inject_script` permission block, so the template itself tells you whether this applies. If it declares any, send that list to engineering before publishing to the production environment, and give the policy change time to merge and deploy.

A built-in Google tag (GA4, Google Ads) declares nothing, because it is compiled into the GTM runtime. Those hosts are already covered.

## Changing the policy (engineering side)

1. **Confirm the host from the container, not from the violation report alone.** Browser extensions generate violation reports that look like real ones. Run the inventory procedure in RFC 0007 and check the host actually appears in an `inject_script` block or in the vendor's published CSP guidance.

2. **Pick the directive.** A script goes in `script-src`. An iframe goes in `frame-src`. Anything else - pixel, beacon, XHR, font, stylesheet - is already permitted and needs no change; if a violation report says otherwise, that is worth understanding before editing anything.

3. **Path-scope a general-purpose CDN.** If the host serves more than this one vendor - `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com` - allowlist the package path rather than the host, as the existing entries do. A CSP source matches a path prefix when it ends in `/`:

   ```
   https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/
   ```

   Caveat worth knowing: the path component is not re-checked after a redirect, so this constrains the initial fetch only.

4. **Edit `frontends/main/src/common/csp.ts`** - `GTM_SCRIPT_SOURCES` for a script host, `SITE_FRAME_SOURCES` for a frame host. Both are `(site)`-only. Do not add a vendor to the `(embed)` group: those routes run inside third-party pages and a test asserts their `script-src` names no analytics host (RFC 0007 D8).

5. **Add it to `csp.test.ts`** in the list the "carries the measured GTM host list" test walks, so a later cleanup cannot quietly drop it.

6. **Ship it the normal way** and wait for the deploy. This is the lead time that makes the whole thing worth planning around.

7. **Verify against production**, not locally. Four layers can set a header on this hostname:

   ```sh
   curl -sI https://learn.mit.edu/ | grep -i content-security-policy
   ```

   Then confirm the violations stop arriving in Sentry.

## If a tag is already live and blocked

**Reverting the tag in GTM is the fast path**, and it is the right first move. It takes effect immediately with no deploy. There is no runtime switch that turns the CSP off - undoing it on our side means reverting a commit and waiting for a deploy, which is slower than undoing it on the GTM side.

Pause or unpublish the tag, then ship the policy change, then republish.

## See also

- [RFC 0007: Security Headers](../rfcs/0007-security-headers.md) - the full design. D3 (why `script-src` is shaped this way), D8 (the two policies), D10 (directive values), D11 (why an allowlist, and what it costs).
- [Google Tag Manager](../architecture/gtm.md) - how the container is loaded and how events are pushed.
- [Google's CSP guide for tag products](https://developers.google.com/tag-platform/security/guides/csp) - the published host lists for GTM, GA4 and Google Ads.
