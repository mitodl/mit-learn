Release Notes
=============

Version 0.38.1 (Released July 22, 2025)
--------------

- Ensure default favorites list gets created for new scim users (#2364)
- Only ingest published canvas content (#2363)
- remove MITOL_NOINDEX from django settings (unused) (#2361)
- Add path prefixed MITx Online API config to local dev APISIX (#2360)
- Handle stale auth better (#2342)
- Fix Renovate PR #2334: Update @chromatic-com/storybook to compatible v3.2.7 (#2350)

Version 0.38.0 (Released July 16, 2025)
--------------

- Fix CI docker build and remove old NextJS Release actions (#2359)
- add a healthcheck route (#2357)
- fix price separator display (#2348)
- chore(deps): update dependency eslint-plugin-jest to v29 (#2356)
- canvas - separate courses per session (#2347)
- fix(deps): update dependency litellm to v1.74.2 (#2354)
- fix(deps): update dependency ruff to v0.12.3 (#2353)
- fix(deps): update dependency onnxruntime to v1.22.1 (#2352)
- chore(deps): update redis docker tag to v7.4.5 (#2351)
- Set language attribute on resource title and descriptions (#2346)
- Add Canvas platform for learning resources (#2345)
- Shanbady/summary flashcard sync (#2339)
- Testimonial spacing to allow 2 line attestation title (#2344)
- Remove the chat demo pages (#2341)
- Return to page after sign up (#2340)

Version 0.37.0 (Released July 14, 2025)
--------------

- Add a Sitemap  (#2338)
- chore(deps): update yarn to v4.9.2 (#2325)
- fix(deps): update dependency ruff to v0.12.2 (#2333)
- Updated Designs for 404 and Error pages (#2337)
- New honor code page and copy updates to privacy policy and terms.  (#2336)
- Display certificate type on list cards (#2335)
- add one click enroll functionality to dashboard cards (#2319)
- adding favorites list plugin (#2322)
- fix(deps): update dependency onnxruntime to v1.22.0 (#2332)
- fix(deps): update dependency llama-index-llms-openai to ^0.4.0 (#2331)
- fix(deps): update dependency litellm to v1.73.6 (#2330)
- fix(deps): update dependency cairosvg to v2.8.2 (#2329)
- chore(deps): update node.js to v22.17.0 (#2328)
- chore(deps): update nginx docker tag to v1.29.0 (#2327)
- fix(deps): update dependency django to v4.2.23 (#2326)

Version 0.36.5 (Released July 08, 2025)
--------------

- Fix flaky test by ensuring consistent ordering of children in serializers (#2321)
- Canvas course webhook and ingestion format changes (#2320)
- chore(deps): update actions/setup-python digest to a26af69 (#2254)
- chore(deps): update actions/setup-node digest to 49933ea (#2253)
- fix(deps): update dependency next-router-mock to v1 (#2267)
- dashboard email settings dialog functionality (#2312)
- Update django-health-check digest to 8c69e53 (#2294)
- Update dependency posthog to v5 (#2318)
- include canonical url in generatemetadata (#2316)
- align LearningResourceListCard with figma (#2314)
- Design QA (#2308)
- [pre-commit.ci] pre-commit autoupdate (#2298)

Version 0.36.3 (Released June 24, 2025)
--------------

- Ingest canvas courses (#2307)
- Update dependency urllib3 to v2.5.0 [SECURITY] (#2311)
- unpin dep (#2309)
- dashboard unenroll dialog functionality (#2303)
- update smoot to proper release (#2306)
- Use smoot components; fix radio button focus ring (#2304)
- update spinner usage (#2301)
- Feature Flag for MITxOnline API Call (#2305)
- Upgrade Smoot Design (#2302)
- Update dependency requests to v2.32.4 [SECURITY] (#2299)

Version 0.36.1 (Released June 10, 2025)
--------------

- Import files for all active runs (#2292)
- locking qdrant client to specific version (#2297)
- minor copy change (#2296)

Version 0.36.0 (Released June 10, 2025)
--------------

- Update dependency Django to v4.2.22 [SECURITY] (#2293)
- Ignore authentication based 403's when querying enrollments from the dashboard home enrollment display (#2290)
- more copy updates (#2291)
- Use the org slug in the URL instead of the ID (#2288)

Version 0.35.1 (Released June 05, 2025)
--------------

- Add permissions for content file content (#2249)
- About page copy changes (#2282)

Version 0.35.0 (Released June 04, 2025)
--------------

- integrate mitxonline api (#2256)

Version 0.34.3 (Released June 03, 2025)
--------------

- Feature flag syllabus chat for programs (#2284)
- Remove django-hijack (#2280)
- [pre-commit.ci] pre-commit autoupdate (#2255)
- Syllabus bot for programs (#2273)
- Update legal docs (#2274)

Version 0.34.1 (Released June 02, 2025)
--------------

- chore(deps): update yarn to v4.9.1 (#2278)

Version 0.34.0 (Released June 02, 2025)
--------------

- chore(deps): update redis docker tag to v7.4.4 (#2277)
- chore(deps): update opensearchproject/opensearch docker tag to v2.19.2 (#2276)
- chore(deps): update codecov/codecov-action action to v5.4.3 (#2275)
- adding endpoint fix (#2270)
- change hero text (#2271)
- Upgrades Smoot Design (#2261)

Version 0.33.1 (Released May 29, 2025)
--------------

- fix(deps): update dependency django-anymail to v13 (#2201)
- Prevent test courses from being overwritten (#2262)
- fix(deps): update dependency django-guardian to v3 (#2266)
- fix(deps): update dependency ulid-py to v1 (#2268)
- chore(deps): update dependency jest-extended to v5 (#2264)
- fix(deps): update dependency cryptography to v45 (#2265)
- fix(deps): update dependency moment-timezone to ^0.6.0 (#2263)
- fix(deps): update dependency tika to v3 (#2202)
- Tweaks to the nextjs dockerfile to give a build target for production. (#2260)

Version 0.33.0 (Released May 28, 2025)
--------------

- remove the backend heroku deploy step from the RC Github Actions build since that happens in Kubernetes now (#2258)
- config: Allow health endpoints to bypass SSL redirect
- config: Remove syslog handler (#2250)
- feat: Add health check (#2247)
- Ensure celery tasks execute once (#2242)
- Fix flaky test (#2246)
- [pre-commit.ci] pre-commit autoupdate (#2248)
- Set card link on org dashboard pages to courseware url (#2239)
- [pre-commit.ci] pre-commit autoupdate (#2215)
- chore(deps): pin dependencies (#2245)
- fix(deps): update dependency youtube-transcript-api to v1 (#2206)
- Tracking user account creation event in posthog  (#2237)
- Fix ordering of modules in UAI dashboard (#2232)

Version 0.31.3 (Released May 12, 2025)
--------------

- Less noisy openapi-diff action. (#2236)
- ingestion of test/sandbox courses (#2224)
- Remove ai_chat app (#2238)
- Adjust default env values for mit-learn (#2235)
- Remove param based onboarding navigation   (#2233)
- Retry requests on connection errors and additional behavior (#2230)
- fix(deps): update dependency django to v4.2.21 [security] (#2234)
- chore(deps): update dependency eslint-import-resolver-typescript to v4 (#2200)
- UAI dashboard - unenrolled module card changes (#2231)
- fix: Continue summarizer on error and add more logging (#2220)
- embedding content updates and removals (#2217)
- test (#2226)
- update coursenumber weight in search (#2219)
- Static header for accessible drawer content at page magnification (#2221)
- Force https for urls in scraper (#2222)
- add a loading state to DashboardCard (#2216)
- [pre-commit.ci] pre-commit autoupdate (#2203)
- Increase local dev container session lifespan to 2 weeks (#2212)
- Drawer/chat accessibility fixes (#2214)
- chore(deps): update yarn to v4.9.0 (#2198)
- redirect new users to onboarding (#2204)
- Reduce memory usage for nextjs in dev mode (#2211)
- add email settings and unenroll dialogs as default context menu items in dashboard cards (#2210)
- Rename the realm file to work under keycloak 26.2+ (#2209)
- fix(deps): update dependency litellm to v1.66.1 (#2205)
- fix some hardcoded dates (#2208)
- fix(deps): update dependency html2text to v2025 (#2207)
- multi page marketing site scraping (#2196)
- fix(deps): update dependency litellm to v1.65.7 (#2199)
- fix(deps): update dependency ruff to v0.11.5 (#2197)
- enrollments dashboard expand collapse (#2195)
- Add OpenTelemetry Config (#2194)
- backpopulate edx files by learning_resource_id (#2174)
- UAI Dashboard (#2189)

Version 0.31.1 (Released April 29, 2025)
--------------

- enrollment dashboard mobile layout (#2187)
- Add a default worker concurrency for local dev (#2190)
- Scrape marketing sites with dynamic content (#2180)
- remove initial messages (#2185)
- Changes to use posthog proxy (#2188)
- [pre-commit.ci] pre-commit autoupdate (#2138)
- chore(deps): update dependency @storybook/addon-webpack5-compiler-swc to v3 (#2131)
- fix(deps): update material-ui monorepo (#2164)
- chore(deps): update yarn to v4.8.1 (#2183)
- add a prop to DashboardCard to optionally disable the not complete icon (#2182)
- chore(deps): update actions/setup-python digest to 8d9ed9a (#2163)
- Migrated AiChat entry screen (#2124)
- Rename EnrollmentCard to DashboardCard  (#2179)
- Fade search results while fetching (#2177)
- chore(deps): update yarn to v4.8.0 (#2165)
- fix user profile type error (#2178)
- reorganize dashboard tabs (#2171)
- Update mitxonline api client (#2172)
- Switch to using mitol-django-scim (#2136)

Version 0.31.0 (Released April 08, 2025)
--------------

- adding selenium dependency (#2173)
- Make /users/me/ api endpoint accessible for anonymous users (#2156)
- first pass at docker image optimization (#2161)
- version: Increase poetry version to latest supported 1.8 release
- Decrease lookback window for embedding new resources and contentfiles (#2162)
- fix: Don't try to install mit-learn as a package
- version: Loosen the version of Python (#2167)
- config: Increase the Nginx buffer size for headers and cookies
- Remove SCIM fields from Profile (#2160)
- Fix for potential missing file attribute in contentfile json (#2158)
- chore(deps): update dependency faker to v37 (#2132)
- chore(deps): update actions/setup-node digest to cdca736 (#2146)
- Make gemini optional by request (#2159)
- Enrollment card updates & sorting (#2142)
- Enable redirects on logout (#2145)
- Fix broken test test_certificate_display (#2155)
- make black link typography match design system (#2154)

Version 0.30.10 (Released March 27, 2025)
---------------

- fix dedupe issue (#2153)
- fix(deps): update dependency ruff to v0.11.2 (#2148)
- typeerror nonetype error (#2152)
- qdrant performance tweaks (#2144)
- Fix JS test (#2151)
- feat: content summaries and flashcards generation (#2118)
- Log out user if no apisix (#2149)
- fix(deps): update dependency litellm to v1.63.14 (#2147)
- chore(deps): update dependency node to v22 (#2133)
- fix(deps): update dependency ipython to v9 (#2134)
- Consolidate learning resource display logic into the backend (#2139)
- global_id migrations based on scim id (#2141)
- Updated github workflows to use parameterized BASE_URL provided to gh by pulumi code. (#2140)
- Fix contentfile embeddings (#2135)
- fix(deps): update dependency ruff to v0.11.0 (#2130)
- fix(deps): update dependency litellm to v1.63.11 (#2128)
- fix(deps): update dependency onnxruntime to v1.21.0 (#2129)
- Remove comma from ci files (#2126)
- Remove social auth login/logout, apisix middleware should handle both (#2119)
- chore(deps): update thollander/actions-comment-pull-request action to v3 (#2102)
- fix(deps): update dependency @mui/lab to v6.0.0-beta.30 (#2095)
- [pre-commit.ci] pre-commit autoupdate (#2039)
- Show mitxonline enrollments in dashboard (#2122)
- Chatbot UI issues (#2110)
- Store (and embed) marketing page info as a contentfile (#2120)
- chore(deps): update react monorepo to v19 (major) (#2101)
- chore(deps): update yarn to v4.7.0 (#2099)

Version 0.30.9 (Released March 13, 2025)
--------------

- fix asset ids (#2121)
- Always show chat entry screen when navigating courses (#2114)
- fix(deps): update dependency django to v4.2.20 [security] (#2117)

Version 0.30.8 (Released March 06, 2025)
--------------

- removing school from departments display (#2115)
- edx_block_id -> edx_module_id (#2109)
- Fix stale rendering on Syllabus chat (#2111)
- Remove env control on session replay (#2081)
- embed course metadata as contentfile (#2050)

Version 0.30.7 (Released March 06, 2025)
--------------

- Increase nginx header size limit to 12k (#2107)
- Handle "next" query string param in CustomLogoutView (#2064)
- Fix SCIM startIndex parsing (#2105)
- Update README to point to separate keycloak readme (#2103)
- add a comment in release actions about spaces (#2093)
- chore(deps): update codecov/codecov-action action to v5.4.0 (#2098)
- fix(deps): update dependency ruff to v0.9.9 (#2097)
- chore(deps): update opensearchproject/opensearch docker tag to v2.19.1 (#2094)
- fix(deps): update dependency litellm to v1.61.20 (#2096)
- Fix the casing of the sort field for SCIM search (#2089)
- remove an erroneous space (#2090)
- remove next prefix from app origin (#2087)
- fix: env based _JAVA_OPTIONS for opensearch container (#2082)
- Add comma between build args (#2083)
- Fix the user search URL (#2084)
- Tie chatbots to URL parameters (#2076)
- Add all Contentfile metadata to chunk responses (#2075)
- Make embedding generation task use correct run (#2074)
- add MITOL_LOGOUT_SUFFIX to github actions (#2079)
- Fix user migrations for SCIM (#2078)
- Fix SCIM view tests (#2073)
- Accessibility improvements (#2071)
- APISIX integration (#2061)
- Added SCIM fields to User and populate (#2062)
- Fix SCIM search API sort and pagination (#2066)
- fix: Opensearch container on ARM64 based architecture (#2069)
- Update dependency @dnd-kit/sortable to v10 (#1974)
- Update akhileshns/heroku-deploy digest to e3eb99d (#2068)
- Update dependency @sentry/nextjs to v9 (#2034)
- Update dependency @mui/lab to v6.0.0-beta.28 (#2051)
- Update dependency tldextract to v5 (#2031)

Version 0.30.6 (Released February 26, 2025)
--------------

- Full width slide down syllabus chat for the resource drawer (#2063)
- Update dependency faker to v36 (#2057)

Version 0.30.5 (Released February 21, 2025)
--------------

- Fixed SCIM search for large queries (#2049)
- Latest smoot-design (#2059)
- Recommendation bot styling and text updates (#2058)
- Open Learning Library CSV update (#2014)
- Update dependency litellm to v1.61.5 (#2056)
- Update opensearchproject/opensearch Docker tag to v2.19.0 (#2055)
- Update dependency tiktoken to ^0.9.0 (#2054)
- Update dependency litellm to v1.61.4 (#2053)
- Update Node.js to v22.14.0 (#2052)
- Celery task to embed new contentfiles (#2044)
- Design update for the homepage AskTIM action (#2047)
- Point the chatbots to the Learn AI endpoints (#2045)
- Recommendation bot UI (#2019)
- Update React Query to v5 (#2043)

Version 0.30.4 (Released February 12, 2025)
--------------

- Rename auth_user table to users_user (#2016)
- fix for staying under openai limits (#2041)
- Update dependency cryptography to v44.0.1 [SECURITY] (#2042)
- Remove `@lukemorales/query-key-factory`, unblock react-query v5 upgrade (#2040)

Version 0.30.3 (Released February 12, 2025)
--------------

- Add custom user model (#2015)
- Update dependency ruff to v0.9.6 (#2033)
- Update dependency @mui/lab to v6.0.0-beta.26 (#2023)
- Remove django-debug-toolbar (#2021)
- Update actions/setup-python to use pyproject.toml (#2020)
- Update actions/setup-python digest to 4237552 (#2022)
- Update dependency stylelint-config-standard-scss to v14 (#2029)
- Update dependency syncpack to v13 (#2030)

Version 0.30.2 (Released February 10, 2025)
--------------

- Update dependency litellm to v1.60.8 (#2028)
- Update dependency drf-spectacular to ^0.28.0 (#2027)
- Update nginx Docker tag to v1.27.4 (#2026)
- Skip existing embeddings (#2017)
- Update dependency ruff to v0.9.5 (#2025)
- Update dependency Django to v4.2.19 (#2024)
- Update akhileshns/heroku-deploy digest to c3187cb (#1829)
- [pre-commit.ci] pre-commit autoupdate (#1976)
- Update dependency eslint-config-prettier to v10 (#1995)
- Update actions/setup-node digest to 1d0ff46 (#2009)
- Added SCIM /Bulk API endpoint (#1985)
- Add initial migration for users app (#2013)

Version 0.30.1 (Released February 10, 2025)
--------------

- Remove imports for builtin django User model (#2012)
- track additional browse events in posthog (#2011)
- Update dependency faker to v35 (#1996)
- Fix support for hardware accelerated embedding generation via ollama (#2008)

Version 0.30.0 (Released February 06, 2025)
--------------

- Syllabus chatbot UI (#1999)
- Update dependency attrs to v25 (#1994)

Version 0.29.0 (Released February 04, 2025)
--------------

- Semantic Chunking of Content Files (#2005)
- add edx block ids to content files (#2000)
- Better React Testing Library Errors (#2006)
- disable daily embed task in development (#2001)
- reverse nav drawer posthog events (#2003)
- track browse actions in posthog (#1997)
- remove react router (#1988)
- Env var to enable Posthog session replay (disable by default) (#1998)
- Shanbady/chunk size dropdown (#1989)
- Update codecov/codecov-action action to v5.3.1 (#1992)
- Update dependency ruff to v0.9.3 (#1991)
- Update dependency litellm to v1.59.7 (#1990)
- move LearningResourceExpanded to main (#1987)

Version 0.28.1 (Released January 29, 2025)
--------------

- drawer topic carousels should not be filtered on just courses (#1984)
- Use Smoot Design lib in MIT Learn (#1979)
- variable contentfile chunk sizes (#1980)
- remove the v1 drawer and rename v2 drawer (#1982)
- drawer v2 podcast carousels (#1981)
- drawer v2 other videos in series / videos in playlist (#1968)
- Remove prolearn from ETLSource enum (#1966)

Version 0.28.0 (Released January 23, 2025)
--------------

- remove two unused entries (#1977)
- Update dependency litellm to v1.59.0 (#1972)
- Update dependency ruff to v0.9.2 (#1973)
- Update dependency bpython to ^0.25 (#1971)
- Update Node.js to v22.13.0 (#1970)
- Update redis Docker tag to v7.4.2 (#1969)
- [pre-commit.ci] pre-commit autoupdate (#1820)
- fix line clamping of HTML description (#1967)
- Onboarding Accessibility Improvements (#1960)
- add proper mocking in drawer v2 tests handling items queries if resource is a program (#1965)
- add "courses in program" carousel (#1964)
- Update dependency @storybook/addon-webpack5-compiler-swc to v2 (#1942)
- Update dependency Django to v4.2.18 [SECURITY] (#1963)

Version 0.27.0 (Released January 16, 2025)
--------------

- Basic Syllabus Bot for demo (#1961)
- drawer v2 design review fixes (#1959)
- fix text box text (#1951)
- Fix Posthog multiple inits (#1953)
- make useSearchParams mock return stable reference (#1958)
- Shanbady/rename vector search endpoints (#1955)
- Dashboard Tab Keyboard Navigation (#1949)
- fix podcast cta (#1920)
- constraining resources for celery service (#1950)

Version 0.26.6 (Released January 14, 2025)
--------------

- Fix SCIM API error on patch with nested attributes (#1952)
- consistent image sizes in subscription emails (#1946)
- Do not store multiple copies of duplicate edx files (#1945)
- Disable About page prefetching (#1938)

Version 0.26.5 (Released January 07, 2025)
--------------

- pin ubuntu due to 24 dropping heroku cli (#1943)
- fix(deps): update dependency litellm to v1.56.9 (#1941)
- fix(deps): update dependency ruff to v0.8.5 (#1939)

Version 0.26.4 (Released January 07, 2025)
--------------

- Import AI agent within view post code (#1936)
- Duration and/or commitment for Sloan and Professional Education (#1906)
- Remove latest change to uwsgi.ini (#1934)
- Duration and time commitment (#1650)
- Shanbady/qdrant docs (#1932)
- chore(deps): update yarn to v4.6.0 (#1933)
- chore(deps): update dependency stylelint to v16 (#1931)
- remove unncessary wrapper (#1916)
- fix(deps): update dependency onnxruntime to v1.20.1 (#1928)
- fix(deps): update dependency litellm to v1.55.9 (#1929)
- fix(deps): update dependency ruff to v0.8.4 (#1927)
- fix(deps): update dependency litellm to v1.55.8 (#1926)
- chore(deps): update codecov/codecov-action action to v5.1.2 (#1925)
- Track chatbot activity in posthog (#1923)
- Content File Vector Search Endpoint (#1907)
- Gives LR Drawer role "dialog" and a name. (#1914)
- Fix certification parameter, update prompts, catch json parsing error… (#1921)
- Demo Course Recommendation Chatbot (not production-ready, for RC only) (#1918)
- adding extra settings to allow us to use ollama locally (#1915)
- adding new management command for creating collections and fixing init script (#1911)
- config: Ignore env, venv, and kompose directories in Docker images
- feat(generate_env.py): add script to generate .env file using hvac and OIDC authentication
- Update dependency @testing-library/react to v16.1.0 (#1884)
- Update version of react used in tests to same as production (#1917)
- add topics carousels to v2 drawer (#1912)
- fix v2 drawer scrolling issues (#1908)
- restore main tag in root layout (#1909)
- Reduce the initial JS size (#1901)
- Contentfile chunk embeddings (#1905)
- remove the opensearch based carousel from the drawer and rename the vector based one as the default (#1902)
- Update dependency ruff to v0.8.3 (#1903)
- drawer v2 - share resource (#1893)
- Fix shellcheck issue
- App env vars for use with local vault agent (#1868)
- add bordered button variant (#1900)
- fix storybook (#1899)
- Filter params for vector search (#1889)
- add nprogress loading bar (#1897)
- populate file extensions for ocw (#1891)

Version 0.26.3 (Released December 18, 2024)
--------------

- simplify font loading (#1895)
- Update dependency onnxruntime to v1.20.1 (#1886)
- subscription email language update (#1892)
- Bump cross-spawn from 7.0.3 to 7.0.6 (#1834)
- Update dependency cryptography to v44 (#1887)

Version 0.26.2 (Released December 10, 2024)
--------------

- add a trailing slash to non contentfile OCW resources (#1877)
- Update codecov/codecov-action action to v5.1.1 (#1883)
- Update Node.js to v22.12.0 (#1882)
- Update nginx Docker tag to v1.27.3 (#1881)
- Update dependency ruff to v0.8.2 (#1880)
- Update dependency Django to v4.2.17 [SECURITY] (#1879)
- specify non-free course for differing prices test (#1878)
- Server render search results (search and channel pages) (#1836)
- Server render homepage and listing pages. Client-only drawer navigation. (#1872)
- fix price comparison in differing runs table (#1876)
- OpenAI embeddings for vector search (#1869)
- Simplify Theme (#1870)
- Add parent id to podcast api (#1857)
- Fix edx file import (#1867)
- Update codecov/codecov-action action to v5 (#1855)

Version 0.26.1 (Released December 09, 2024)
--------------

- Update Yarn to v4.5.3 (#1865)
- fix certification type none display (#1873)
- fix card line clamping (#1871)
- Update dependency eslint-plugin-react-hooks to v5 (#1817)
- Update dependency eslint-plugin-testing-library to v7 (#1856)
- v2 drawer qa adjustments (#1850)
- Fixes issue with learning path membership being called for non-admins (#1864)
- Consolidate qdrant functionality into its own app (#1860)
- Revert "Server rendering for homepage, units and topics listing pages (#1847)" (#1866)
- Filter out content type on similar resources endpoint (#1863)
- Select random hero image index on server (#1859)
- returnning all resource types for similar (#1849)

Version 0.26.0 (Released November 26, 2024)
--------------

- Refactor date/time parsing for mitpe events (#1840)
- Server rendering for homepage, units and topics listing pages (#1847)
- Query membership endpoints for resources belonging to user lists and learning paths (#1846)
- Remove some unused exports from ol-components (#1844)
- Update Yarn to v4.5.2 (#1851)
- Update postgres Docker tag to v12.22 (#1854)
- Update dependency ruff to v0.8.0 (#1853)
- Consistent qdrant point ids (#1839)
- set min cpu and memory. also add qdrant container (#1845)
- similar resources carousel (#1835)
- Refactor user lists and learning paths hooks out of learning resources (#1842)
- Revert "Server rendering for homepage, units and topics listing pages (#1822)" (#1838)
- Server rendering for homepage, units and topics listing pages (#1822)
- Update dependency @mui/lab to v6.0.0-beta.15 (#1830)
- vector search endpoint (#1827)
- Update dependency django-anymail to v12 (#1815)
- Update dependency safety to v3 (#1819)
- Update dependency pytest-cov to v6 (#1818)
- separate starts and as taught in, show anytime availability (#1828)

Version 0.25.0 (Released November 25, 2024)
--------------

- LocalDate and NoSSR components to render localized dates only on client (#1831)
- Revert "LocalDate and NoSSR components to render localized dates only on client"
- LocalDate and NoSSR components to render localized dates only on client
- v2 learning resource drawer formats and location (#1826)
- v2 drawer certification updates (#1823)
- Mechanism to sync server prefetch with client API calls (#1798)
- show more button for v2 drawer dates (#1809)
- Add data-ph- elements to CTA buttons (#1821)
- Endpoints for userlist/learningpath memberships (#1808)
- Clear resource_type filter when leaving Learning Materials search tab (#1780)
- Update opensearchproject/opensearch Docker tag to v2.18.0 (#1812)
- Update dependency postcss-styled-syntax to ^0.7.0 (#1811)
- Update dependency ruff to v0.7.3 (#1810)
- Update dependency @chromatic-com/storybook to v3 (#1764)
- learning resource drawer v2 run comparison table (#1782)

Version 0.24.3 (Released November 14, 2024)
--------------

- remove sentence transformers dependency (#1806)
- Add playlist id to video results (#1802)
- Remove unnecessary percolate calls (#1801)
- Update actions/checkout digest to 11bd719 (#1755)
- Update actions/setup-node digest to 39370e3 (#1756)
- [pre-commit.ci] pre-commit autoupdate (#1790)
- Update akhileshns/heroku-deploy digest to e86b991 (#1715)
- Empty commit to try and fix heroku
- identify users in posthog via user id (#1799)
- qdrant integration for vector based similar resources endpoint (#1784)
- calculate min_score before score adjustments (#1797)
- Update actions/setup-python digest to 0b93645 (#1757)

Version 0.24.2 (Released November 07, 2024)
--------------

- HTTPS youtube URLs (#1795)
- Card bug fixes (#1793)
- upgrade stories & events grid to grid2 (#1792)
- Fixes to address scim-form-keycloak weirdness (#1789)
- Maintain API instructor order (#1783)
- Fix DST issue (#1788)
- Update Node.js to v22 (#1786)
- Update dependency ruff to v0.7.2 (#1785)
- Image and video optimizations (#1769)
- Upgrade to Next.js v15 (#1776)
- Fix issue with hero image causing horizontal scroll (#1777)
- add new learning resource drawer layout (#1711)
- Change frontend to use resource_prices field instead of prices field (#1737)
- move facets first in tab order (#1751)
- Card Accessibility Improvements (#1778)

Version 0.24.1 (Released October 30, 2024)
--------------

- Fix prolearn bug for existing resources whose urls have changed (#1775)
- [pre-commit.ci] pre-commit autoupdate (#1629)
- Update typescript-eslint monorepo to v8 (#1534)
- fixing intermittent test failure (#1773)
- Professional Education ETL Pipeline (#1210)

Version 0.24.0 (Released October 29, 2024)
--------------

- adding fix for pruning percolate queries (#1770)
- Handle dupe prices during import (#1767)
- Add the ol-profile openid scope to auth (#1765)
- remove learning_path from search (#1753)
- Update dependency @mui/base to v5.0.0-beta.60 (#1758)
- New LearningResourcePrice model (#1736)
- Update codecov/codecov-action action to v4.6.0 (#1763)
- Update Node.js to v20.18.0 (#1762)
- Update redis Docker tag to v7.4.1 (#1761)
- Update nginx Docker tag to v1.27.2 (#1760)
- Update dependency eslint to v8.57.1 (#1759)
- move nextjs hash.txt generation after heroku deploy (#1752)
- Replace plain <a> tags with Next.js <Link> components (#1739)
- Shanbady/similar resources endpoint (#1743)
- restore images in subscription emails (#1747)
- fix list duplication when editing lists (#1749)
- remove elasticsearch (#1734)
- Update dependency pygithub to v2 (#1748)
- Update dependency ruff to v0.7.1 (#1745)
- Update opensearchproject/opensearch Docker tag to v2.17.1 (#1746)
- Update dependency moto to v5 (#1740)
- Update dependency urllib3 to v2 (#1741)
- ol-template is not used (#1738)
- Update dependency @faker-js/faker to v9 (#1735)
- Update dependency faker to v30 (#1732)
- Update dependency toolz to v1 (#1733)
- Fixes to make learn work with scim-for-keycloak (#1727)
- Navigation Accessibility (#1726)
- Middleware for SSL redirect (#1729)
- Clean out the static frontend (#1731)
- Update Yarn to v4.5.1 (#1716)
- Search count inside label (#1730)
- Announce search count for screen readers (#1713)
- Update actions/checkout digest to eef6144 (#1686)

Version 0.23.0 (Released October 22, 2024)
--------------

- Revert "Fixed issue with full name not being pulled in (#1682)" (#1723)
- Fix path to Storybook build (#1722)
- Update for Storybook's new home in ol-components (#1721)
- bundle analyzer, fix search page + channel page JS sizes (#1707)
- Update ckeditor monorepo to v43 (major) (#1204)
- Update actions/setup-node digest to 0a44ba7 (#1623)
- Read Sentry rates from the Actions secrets
- Fixed issue with full name not being pulled in (#1682)
- Remove unnecessary Heroku vars
- fix textarea placeholder color (#1712)
- Reinstate backend release steps
- Capture the search_update event after making the adjustments to search terms (#1709)
- Move deploy jobs to respective workflow. Docker build for dry run
- Appzi env vars and Sentry config
- NextJS Sentry Integration (#1701)
- Increase cache duration (#1705)
- remove unnecessary webpack customizations (#1704)
- NextJS - re-enable program letter tests (#1696)
- Copy yarn releases to the Docker container (fixes build) (#1703)
- Config to set cache control headers (#1700)
- restoring up and down chevrons (#1690)
- synonyms in analyzer (#1697)
- NextJS Sentry Integration (#1701)
- Prod deployment. Add Posthog vars
- Increase cache duration (#1705)
- Update dependency @ckeditor/ckeditor5-react to v9 (#1532)
- remove unnecessary webpack customizations (#1704)
- NextJS - re-enable program letter tests (#1696)
- Update dependency @ckeditor/ckeditor5-dev-utils to v43 (#1552)
- Copy yarn releases to the Docker container (fixes build) (#1703)
- Update dependency @ckeditor/ckeditor5-dev-translations to v43 (#1551)
- Config to set cache control headers (#1700)
- Shanbady/improve bookmark button label (#1699)
- Shanbady/xpro logo for all xpro offerings (#1695)
- search facet accessibility fixes (#1698)
- exclude topics with no associated channel from Topic querySets (#1693)
- restoring up and down chevrons (#1690)
- Merge `main` into `nextjs` (#1687)
- Reinstate background steps image
- Handle 404 errors from API during server render (#1678)
- Fix search page history stack (#1680)
- fix spacing issues on nextjs branch (#1685)
- Make metadataBase apply to all pages, not just homepage (#1677)
- Positioning for search utils input close button (#1617)
- fix tests
- bump course search utils
- fix metadata baseurl
- switch search page to dynamic render
- Next.js Migration Bug Fixes  (#1626)
- adding new og-image
- Various post-merge bug fixes:
- Adds PostHog back into the NextJS build (#1644)
- Restore nextjs main workspace tests (#1639)
- Migrate remaining images to Next.js (#1614)
- Add error handling (#1613)
- adding env vars (#1609)
- Merge latest from main (#1602)
- Fix homepage image hydration errors (#1605)
- Migrate useMediaQuery hooks (#1563)
- [NextJS] configure query client like on `main` (#1591)
- [NextJS] Make noindex tag opt-out (like main) rather than opt-in (#1592)
- CI to push to Heroku (#1569)
- [NextJS] Load correct font and a few other global things (#1583)
- Reinstate head metadata (#1572)
- set single react types resolution (#1586)
- Dockerfile for the Next.js frontend and Action to build and publish (#1542)
- [NextJS] Fix tests, re-enable on CI (#1560)
- fix carousel initial positioning (#1546)
- [NextJS] Local docker setup (#1538)
- [NextJS] fix frontend tests outside of `main` workspace (#1527)
- Migrate Storybook for Next.js (#1525)
- Fixes for successful build (#1516)
- Fix linting on nextjs branch (#1509)
- Next.js Initial Migration (#1505)

Version 0.22.1 (Released October 15, 2024)
--------------

- increase learning path listing limit to 100 (#1692)
- Shanbady/consolidate static fixtures (#1684)

Version 0.22.0 (Released October 15, 2024)
--------------

- Make add to list dialog scrollable (#1689)
- make search defaults settable (#1681)
- Shuffling around where the search_update event is fired so it happens in more places (#1679)
- prevent featured course carousel from re-randomizing (#1673)

Version 0.21.3 (Released October 15, 2024)
--------------

- removing invalid flag from clear cache command (#1675)
- Clear Cache on Deploy (#1668)
- Update Yarn to v4.5.0 (#1624)
- topic detail banner / subtopic logic revisions (#1646)
- Restore program letter intercept view (#1643)

Version 0.21.2 (Released October 10, 2024)
--------------

- Content File Score Adjustment (#1667)
- remove unnecessary padding adjustment on Input base styles (#1666)

Version 0.21.1 (Released October 09, 2024)
--------------

- Always delete past events during ETL, and filter them out from api results too just in case (#1660)
- Add location field to LearningResource and LearningResourceRun models (#1604)
- Cached department and topic page counts (#1661)
- Shanbady/randomize featured resources (#1653)
- Ignore NotFoundErrors in switch_indices function (#1654)

Version 0.21.0 (Released October 07, 2024)
--------------

- update og:image to use new logo (#1658)
- Use a partial match mode as the search mode for instructor fields(#1652)

Version 0.20.4 (Released October 07, 2024)
--------------

- add is_incomplete_or_stale to default sort (#1641)
- set default minimum score cutoff (#1642)
- Adds base infra for the Unified Ecommerce frontend (#1634)
- reset search page in SearchField (#1647)
- updating email template with new logo (#1638)

Version 0.20.3 (Released October 03, 2024)
--------------

- add is_incomplete_or_stale (#1627)
- "unfollow" confirmation modal and "Unfollow All" button  (#1628)
- raise SystemExit as a RetryError (#1635)

Version 0.20.2 (Released October 01, 2024)
--------------

- remove border and shadow (#1636)
- set card root to auto height (#1633)

Version 0.20.1 (Released October 01, 2024)
--------------

- fix Safari MIT logo bug (#1631)
- Retry recreate_index subtasks on worker exit (#1615)
- Email for saved searches (#1619)

Version 0.20.0 (Released October 01, 2024)
--------------

- updated header (#1622)
- Switch to using full name (#1621)
- Update dependency lxml to v5 (#1554)
- Remove health checks against opensearch (#1620)
- Add additional event capturing for some interactions (#1596)
- Revert "changes for formatting search subscription emails"
- changes for formatting search subscription emails
- Add custom label for percolate query subscriptions (#1610)
- Update Python to v3.12.6 (#1593)
- [pre-commit.ci] pre-commit autoupdate (#1601)

Version 0.19.6 (Released September 27, 2024)
--------------

- Add task_reject_on_worker_lost=True to finish_recreate_index, use return instead of raise for replaced tasks (#1608)

Version 0.19.5 (Released September 26, 2024)
--------------

- Add separate field for ocw topics, use best field to assign related topics (#1600)

Version 0.19.4 (Released September 25, 2024)
--------------

- new -> recently added (#1594)
- Pace and format fields for learning resources (#1588)

Version 0.19.3 (Released September 23, 2024)
--------------

- Make search mode defaults settable env variables (#1590)
- follow/unfollow popover (#1589)
- Fix extract_openedx_data and backpopulate_mit_edx_data commands to work with course/program datafiles (#1587)

Version 0.19.2 (Released September 23, 2024)
--------------

- Codespace opensearch service fix (#1582)
- Remove learning_format, use delivery for search filter/facet (#1567)
- Signup popover owns url (#1576)
- [pre-commit.ci] pre-commit autoupdate (#1541)
- Remove an unused dependency (#1571)

Version 0.19.1 (Released September 18, 2024)
--------------

- fix testimonial color title attribute (#1580)
- fix adornment color (#1578)
- fix homepage testimonials font (#1568)
- properly add Mit-AdornmentButton class (#1574)
- fixing cache clear method (#1573)
- add SignupPopover to learning resource drawer bookmark button (#1565)
- Delivery and availability fields for runs (#1470)
- add caching to remaining views (#1555)
- Fix refreshes and deterministic sort order (#1564)
- align items center (#1566)
- add noindex setting (#1559)
- always use dfs_query_then_fetch (#1558)
- updated OLL csv file (#1557)
- input / search input styling updates (#1545)
- Update dependency pytest to v8 (#1548)

Version 0.19.0 (Released September 16, 2024)
--------------

- Update docker-compose config to support OS cluster (#1540)
- Update dependency faker to v28 (#1550)
- Update actions/upload-artifact digest to 5076954 (#1528)
- Update dependency attrs to v24 (#1535)
- Update dependency @faker-js/faker to v9 (#1533)
- Update dependency pytest-cov to v5 (#1549)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v8 (#1260)
- ETL pipeline for MIT edX programs (#1536)
- license_cc and continuing_ed_credits fields (#1544)
- Fix data migration erroring if a record exists (#1543)
- learning resource drawer list buttons (#1537)
- Add LearningResource.delivery field (eventually to replace learning_format) (#1510)
- Update mcr.microsoft.com/playwright Docker tag to v1.47.0 (#1531)
- Update dependency ruff to v0.6.4 (#1530)
- Update dependency Django to v4.2.16 (#1529)
- display sub topics on topic channels (#1511)
- Sort news items by publish_date (#1522)

Version 0.18.2 (Released September 12, 2024)
--------------

- Use new OLL column for secondary topic; fix semester capitalization mismatch (#1519)
- Shanbady/fix course panel start date (#1521)
- Update dependency cryptography to v43 [SECURITY] (#1513)
- [pre-commit.ci] pre-commit autoupdate (#1504)
- Update dependency @ckeditor/ckeditor5-dev-utils to v42 (#1503)
- Update dependency @testing-library/react to v16.0.1 (#1496)
- Update dependency @ckeditor/ckeditor5-dev-translations to v42 (#1502)
- Update actions/setup-python digest to f677139 (#1493)
- Cache unit page counts (#1507)
- dfs_query_then_fetch (#1518)
- Add completeness discount to search (#1512)

Version 0.18.1 (Released September 05, 2024)
--------------

- Remove unnecessary searchparms check (#1514)
- Ingest OLL courses from a spreadsheet/csv (#1508)

Version 0.18.0 (Released September 04, 2024)
--------------

- Setup sentry tracing and profiling (#1492)
- Update Yarn to v4.4.1 (#1494)
- Update postgres Docker tag to v12.20 (#1501)
- Update opensearchproject/opensearch Docker tag to v2.16.0 (#1500)
- Update mcr.microsoft.com/playwright Docker tag to v1.46.1 (#1499)
- Update Node.js to v20.17.0 (#1498)
- Update dependency ruff to v0.6.3 (#1497)
- Update dependency @testing-library/react to v16.0.1 (#1495)

Version 0.17.14 (Released August 30, 2024)
---------------

- put hero image into its own component and set the random image in a state variable so it doesn't change on re-render (#1490)
- fix codespace backend (#1488)
- score cutoff (#1466)

Version 0.17.13 (Released August 30, 2024)
---------------

- Fix a flaky test (#1487)
- homepage search revisions (#1485)
- Better Headings Structure (#1473)
- Fix dialog spacing + reset AddToListDialog (#1484)

Version 0.17.12 (Released August 29, 2024)
---------------

- Remove Pathways (Coming Soon) (#1482)
- add to list dialog updates (#1463)
- Fix syntax that a pre-commit check was failing (#1480)

Version 0.17.11 (Released August 29, 2024)
---------------

- Switched imagekit caching from in-memory to redis (#1475)
- [pre-commit.ci] pre-commit autoupdate (#1468)
- OCW course completeness score (#1461)
- Shanbady/fix multiple instances of subscriptions (#1469)

Version 0.17.10 (Released August 28, 2024)
---------------

- Remove the in-memory cache for now (#1477)
- change drawer CTA label (#1471)
- update the footer logo (#1467)
- Add caching for imagekit (#1472)
- [pre-commit.ci] pre-commit autoupdate (#1215)
- Update redis Docker tag to v7 (#1261)

Version 0.17.9 (Released August 28, 2024)
--------------

- Update newrelic agent (#1464)
- Update actions/upload-artifact digest to 834a144 (#1396)
- Update snok/install-poetry digest to 76e04a9 (#1397)
- Update dependency ruff to v0.6.2 (#1426)
- Carousel accessibility improvements (#1462)
- Add search mode selector to admin (#1456)
- Update Python to v3.12.5 (#1398)
- Sloan ETL pipeline (#1394)
- Setup codespaces (#1444)
- fix certification search url (#1460)
- randomize the hero image (#1459)

Version 0.17.8 (Released August 26, 2024)
--------------

- search box adornment buttons should be 56px wide on mobile (#1457)
- homepage hero search updates (#1454)
- Fix departments and schools fixtures (#1453)
- Renaming the s3 buckets used for storing the app. (#1455)

Version 0.17.7 (Released August 21, 2024)
--------------

- Add SP as a department  (#1451)
- adding test for redirect view (#1448)
- News and events for MIT Professional Education (#1365)

Version 0.17.6 (Released August 21, 2024)
--------------

- change default og:image (#1449)

Version 0.17.5 (Released August 21, 2024)
--------------

- restorin g redirect route (#1446)

Version 0.17.4 (Released August 21, 2024)
--------------

- update departments fixture (#1439)
- department is optional (#1437)
- restrict learning path pages to learning path editors (#1442)
- remove privacy chip from add to user list dialog (#1440)

Version 0.17.3 (Released August 21, 2024)
--------------

- allow empty APPZI_URL (#1441)
- Get availability value from xpro api (#1432)
- add appzi for feedback (#1435)
- Fix frontend sentry_env and release version (#1386)
- Remove remaining frontend routes (#1424)
- Only process best/next run contentfiles, and make sure other run contentfiles are deindexed (#1383)

Version 0.17.2 (Released August 20, 2024)
--------------

- Add locust load testing (#1422)

Version 0.17.1 (Released August 19, 2024)
--------------

- Replace topic chips with info section text (#1379)
- Handle topics with colons from xpro in ETL pipeline (#1429)
- Set default sort to featured (#1414) (#1423)

Version 0.17.0 (Released August 19, 2024)
--------------

- Add migration to adjust mappings, make some minor changes to the dump to yaml util function (#1408)
- uncapitalize with (#1428)
- Update nginx Docker tag to v1.27.1 (#1425)
- search query clean up (#1393)
- remove elementary / primary school as an education option (#1415)
- Per Page metadata tags  (#1411)

Version 0.16.1 (Released August 15, 2024)
--------------

- set csrf cookie name from env var (#1420)
- Expose the SESSION_COOKIE_NAME setting (#1418)
- Update the ETL pipelines times (#1416)
- Add accessibility linting (#1395)
- Undo Change to default sort (#1414)
- Make MITOL_ settings optional in app.json (#1412)
- Rename the variables on release workflows (#1409)
- Fix typo in env variable prefix (#1406)
- cache learning resources search api view (#1392)
- rename MIT Open to MIT Learn (#1389)
- Rename env var prefix MITOPEN_ to MITOL_ (#1388)
- adding fix for logo in email (#1404)
- Change Default sort to featured (#1377)
- Empty user list items view (#1376)

Version 0.16.0 (Released August 13, 2024)
--------------

- Update values of hostnames to use learn.mit.edu (#1401)
- Add featured ranks to the opensearch index (#1381)
- Fix homepage contrast issues (#1371)
- copy update for mitx channel page (#1400)
- Update Yarn to v4.4.0 (#1399)
- Update search term event handler to clear page if the term changes and is submitted, updating tests for this (#1387)
- fix prettier and eslint in pre-commit (#1391)
- Rename MIT Open to MIT Learn for subscription emails (#1390)
- enable mailgun and analytics (#1370)
- update suppport email (#1385)
- Update topic boxes to support multiple lines (#1380)
- Update dependency Django to v4.2.15 [SECURITY] (#1384)
- adding version specifier for renovate (#1378)
- Create, Edit and Delete User List modal UI (#1356)

Version 0.15.1 (Released August 07, 2024)
--------------

- Update dependency redis to v5 (#1244)
- sort before comparing (#1372)
- Rename my 0008 to 0009 to prevent conflict (#1374)
- Add Manufacturing topic; update upserter to make adding child topics easier (#1364)
- Publish topic channels based on resource count (#1349)
- Update dependency opensearch-dsl to v2 (#1242)
- Update dependency opensearch-py to v2 (#1243)
- Fix issue with User List cards not updating on edit (#1361)
- Update dependency django-anymail to v11 (#1207)
- Update CI to check data migrations for conflicts (#1368)
- Fix frontend sentry configuration (#1362)
- Migrate config renovate.json (#1367)
- Update dependency sentry-sdk to v2 [SECURITY] (#1366)
- add a bullet about collecting demographics to PrivacyPage.tsx (#1355)
- user list UI updates (#1348)
- Subscription email template updates (#1311)

Version 0.15.0 (Released August 05, 2024)
--------------

- Performance fixes on LR queries (#1303)
- Subscription management page (#1331)
- Add certificate badge to drawer (#1307)
- Lock file maintenance (#1360)
- Update mcr.microsoft.com/playwright Docker tag to v1.45.3 (#1358)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.23 (#1357)

Version 0.14.7 (Released August 01, 2024)
--------------

- Renaming my topic update migration from 0006 to 0007 (#1353)
- Update the mappings for PWT topic "Programming & Coding"  (#1344)

Version 0.14.6 (Released August 01, 2024)
--------------

- Use resource_delete_actions instead of resource.delete directly (#1347)
- Show "Start Anytime" based on resource "availability" property (#1336)
- Handle alternate unique id fields better in load_course (#1342)
- topic / privacy / onboarding / profile copy updates (#1334)

Version 0.14.5 (Released July 31, 2024)
--------------

- Flatten OCW topics so all of them get mapped to PWT topics when running the ETL pipeline (#1343)

Version 0.14.4 (Released July 31, 2024)
--------------

- fix bug (#1340)
- dev mode (#1333)
- Updated designs for the unit page (#1325)
- Avoid course overwrites in program ETL pipelines (#1332)
- Assign mitxonline certificate type from api values (#1335)
- add default yearly_decay_percent (#1330)
- Modal dialog component and styles
- tab widths (#1309)
- Resource availability: backend changes (#1301)
- styling and icon updates (#1316)

Version 0.14.3 (Released July 29, 2024)
--------------

- Remove some styling for topic box names so they wrap, adjusting icons (#1328)
- Lock file maintenance (#1262)
- fix flaky tests (#1324)
- urlencode search_filter (#1326)
- Moves all env vars to global APP_SETTINGS (#1310)
- Remap topic icons according to what's in the topics listing (#1322)
- Fix podcast duration frontend display (#1321)
- Update topics code for PWT topic mappings (#1275)
- Convert durations to ISO8601 format (podcast episodes) (#1317)
- No prices for archived runs or resources w/out certificates (#1305)

Version 0.14.2 (Released July 25, 2024)
--------------

- Reorder where the testimonial displays in the unit/offeror page to fix spacing and background (#1314)
- fix banner background width (#1315)
- fix price display and update vertical cards (#1296)
- Fix channel views test (#1318)
- free section css (#1312)
- Extract department info for mitxonline from correct external API fields (#1308)
- Determine can edit and can sort permission upstream (#1299)

Version 0.14.1 (Released July 24, 2024)
--------------

- Add a database index on FeedEventDetail.event_datetime (#1304)
- Update platform logos (#1302)

Version 0.14.0 (Released July 23, 2024)
--------------

- Save resource prices in a new database model and calculate during ETL/nightly task (#1290)
- set search page size to 20 (#1298)
- Add a slider to prioritize newer resources (#1283)
- Fix bug with background image obscuring search controls (#1293)
- allow hitting local edx datafile in dev mode (#1297)
- fix restricted redirect (#1287)

Version 0.13.23 (Released July 18, 2024)
---------------

- Revert "Fix bug with background image obscuring search controls (#1286)" (#1289)
- Improve channels api performance (#1278)

Version 0.13.22 (Released July 18, 2024)
---------------

- Optimize queries for learning resource APIs
- Fix bug with background image obscuring search controls (#1286)
- Draggable list card styles (#1282)
- Update actions/setup-node digest to 1e60f62 (#1267)
- Update actions/upload-artifact digest to 0b2256b (#1269)
- Update actions/setup-python digest to 39cd149 (#1268)

Version 0.13.21 (Released July 17, 2024)
---------------

- Unit Detail Banner Updates (#1272)
- Shanbady/clicking item routes away from list fix (#1280)
- adding migrations for copy update (#1276)
- Shanbady/ingest sloan events (#1270)
- fix keyboard drag and drop (#1279)
- Use newer Learning Resource list cards in Learning Paths lists (#1256)
- Improve offeror api performance (#1274)
- Shanbady/clicking item routes away from list (#1273)
- refactor profile and onboarding (#1266)
- add a story showing platform logos (#1277)
- Add profile option for silky to settings (#1271)
- Take is_enrollable attribute into account for publish status of edx resources (#1264)
- Update react monorepo to v18.3.1 (#874)

Version 0.13.20 (Released July 17, 2024)
---------------

- Make static/hash.txt served again (#1259)
- Update actions/checkout digest to 692973e (#1263)
- adjust department names (#1253)
- Update eslint-config and friends (#1246)

Version 0.13.19 (Released July 12, 2024)
---------------

- remove erronous export string (#1257)
- Install django-silk nad fix topics api perf (#1250)
- change xpro ETL dict key back (#1252)
- reindexing fixes (#1247)
- Pin dependencies (#1225)
- Plain text news/events titles/authors; standardize html cleanup (#1248)
- Condensed list card components for user lists (#1251)
- Change readable_id values for podcasts and episodes (#1232)
- adjust / refactor channel detail header (#1234)
- use main not "$default-branch" (#1249)
- Update dependency ruff to v0.5.1 (#1241)
- Update dependency Django to v4.2.14 (#1240)

Version 0.13.18 (Released July 10, 2024)
---------------

- Fix logout view (#1236)
- remove manage widgets (#1239)
- Unit and detail page copy updates (#1235)
- Align departments listing colors to designs (#1238)
- resource drawer UI fixes (#1237)
- Remove "Top picks" carousel if no results (#1195)
- fix learning path count, increase item page size (#1230)
- Use ovewrite=True when calling pluggy function from upsert_offered_by (#1227)
- open resources in new tab (#1220)
- extra weight for instructors (#1231)
- Homepage and nav drawer copy edits (#1233)
- Update dependency eslint-plugin-jest to v28 (#1038)
- Only publish enrollable mitxonline courses (#1229)
- Navigation UI fixes (#1228)
- better spacing around pagination component (#1219)
- Update resource drawer text and URL for podcast episodes (#1191)
- resource type (#1222)
- Data fixtures app for loading static fixtures (#1218)
- Webpack build config loads .env files for running outside of Docker (#1221)
- Updates icons to use Remixicons where they don't already (#1157)
- make primary buttons shadowy, remove edge=none (#1213)
- resource category tabs (#1211)
- Fix storybook github pages publishing (#1200)
- Fix and reenable onboarding page tests (#1216)
- Removed nginx serving of frontend locally (#1179)
- Update actions/checkout digest to 692973e (#961)
- Privacy policy updates (#1208)

Version 0.13.17 (Released July 02, 2024)
---------------

- Fix default image height in resource cards (#1212)
- update unit names (#1198)
- Update opensearchproject/opensearch Docker tag to v2.15.0 (#1205)
- Update mcr.microsoft.com/playwright Docker tag to v1.45.0 (#1203)
- Update dependency ruff to v0.5.0 (#1202)
- Update Node.js to v20.15.0 (#1201)
- Shanbady/log out flow (#1199)
- update mitpe unit data (#1194)
- update sloan executive education offerings (#1193)
- adding post logout redirect to keycloak (#1192)
- stop publishing github pages every pr (#1197)
- setting 100px as default width for buttons (#1185)
- Don't display carousel tabs if there's no data to display (#1169)
- Filled vs Unfilled Bookmarks (#1180)
- Square aspect ratio for media resource images (#1183)
- Add resource category to apis (#1188)
- Scroll results into view when paginating (#1189)
- Drawer CSS fixes (#1190)
- Updates to ChoiceBox; Checkbox, Radio components (#1174)

Version 0.13.16 (Released June 28, 2024)
---------------

- adding command to remove old tables (#1186)
- New default image for learning resources (#1136)
- Swap search and login button (#1181)
- Adding the PostHog settings to the "Build frontend" step (#1182)
- facet order (#1171)
- rename field to channel (#1170)
- fixing width of unit page logo for small devices (#1151)

Version 0.13.15 (Released June 27, 2024)
---------------

- fix content file search (#1167)
- Set default ordering by position for userlist and learningresource relationships (#1165)
- fix flaky test (#1168)
- Update favicons (#1153)
- de-flake a test (#1166)
- Shanbady/search page card mobile updates (#1156)
- remove course filter from featured carousel (#1164)
- Update Select and Dropdown components (#1160)
- Adds a separate pane for the filter CTAs, adds an apply button on mobile (#1144)
- Search facet styles and animation (#1143)
- Modifications to api/search filtering with comma values (#1122)
- [pre-commit.ci] pre-commit autoupdate (#1110)
- Update Yarn to v4.3.1 (#1145)

Version 0.13.14 (Released June 26, 2024)
---------------

- better chunk sizes (#1159)
- Use course_description_html field for OCW courses (#1154)
- Update dependency eslint-plugin-mdx to v3 (#1149)
- sort by -views instead (#1158)
- exposing hijack routes via nginx conf (#1152)
- sort the media carousel tabs by "new" (#1155)
- Update dependency faker to v25 (#1150)
- Update codecov/codecov-action action to v4.5.0 (#1148)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.22 (#1147)
- Update dependency ruff to v0.4.10 (#1146)

Version 0.13.13 (Released June 21, 2024)
---------------

- Some copy edits and minor about page styling updates (#1141)
- creating profile automatically for logged in user (#1140)

Version 0.13.12 (Released June 21, 2024)
---------------

- Search facet checkbox and label styles (#1137)
- Applies new fixes for the homepage and unit page testimonial sliders (#1131)
- fixing sort method for panel detail display (#1130)
- add learning materials tab (#1132)

Version 0.13.11 (Released June 21, 2024)
---------------

- about page updates (#1134)

Version 0.13.10 (Released June 20, 2024)
---------------

- Channel page updates (#1126)

Version 0.13.9 (Released June 20, 2024)
--------------

- removing check for live attribute (#1128)
- Shanbady/copy edits for milestone demo (#1125)
- Signup Popover (#1109)
- show podcast_episode in media carousel all (#1123)
- Updates to page titles (#1121)
- Shanbady/minor UI updates (#1118)
- Shanbady/navigation UI fixes (#1119)
- mitx - only ingest published courses (#1102)
- Make resource.prices = most recent published run prices if there is no next run (#1116)
- switch default sort to use popular instead of created on (#1120)
- Fix populate_featured_lists mgmt command (#1097)

Version 0.13.8 (Released June 20, 2024)
--------------

- add is_learning_material filter show courses and programs first in default sort (#1104)
- dashboard my lists style fixes (#1107)
- Updates to learning resource price display (#1108)
- Add profile edit page (#1029)
- Append `/static` to the front of the testimonial marketing card image (#1115)
- two separate search inputs (#1111)

Version 0.13.7 (Released June 18, 2024)
--------------

- Redoing the marketing image selector (#1113)
- Update Python to v3.12.4 (#1035)
- Update the conditional for the marketing image test to drop out if we haven't seen a marketing image at all yet (#1112)
- Update Yarn to v4.3.0 (#1095)
- Homepage Stories & Events layout fixes (#1103)
- Add marketing images to homepage testimonial, fix some styling issues (#1077)
- Contentfile archive comparison fix (#1078)
- Sort run prices on save; make learning resource prices equal "next run" prices (#1085)
- units page fixes (#1083)
- Rename test appropriately and increase the timeout (#1105)
- Fixed typo in the fastly api key secret name. (#1106)
- breadcrumbs component (#1089)
- Update dependency eslint-config-mitodl to v2 (#1037)

Version 0.13.6 (Released June 17, 2024)
--------------

- update course-search-utils (#1100)
- fix safari image stretching, cap image width (#1096)
- excluding users from serializer (#1090)
- All MITx runs should include a price of $0 (#1094)
- Search page styling (#1051)
- fix dashboard home certificate course carousel (#1082)
- Shanbady/browse by topics UI fix (#1081)
- Update OCW unit name in offerors.json (#1084)
- Add -E flag to worker subcommand for sending task events

Version 0.13.5 (Released June 14, 2024)
--------------

- Shanbady/topic channel page header fixes (#1063)
- Learning Resource cards, list view (#1054)

Version 0.13.4 (Released June 14, 2024)
--------------

- Expose thenew user login url as an environment var (#1086)
- Homepage "Personalize" (#1068)
- Revert "Add flag for Celery to send task state change events"
- Adds learner testimonials component for interior pages (#1001)
- Fixing image width and position on the homepage carousel; prefer cover image over avatar if it exists (#1073)
- Add pytest-xdist and use it for CI builds (#1074)
- Update names in offerors.json (#1079)
- Add flag for Celery to send task state change events

Version 0.13.3 (Released June 14, 2024)
--------------

- Adds ScrollRestoration to the spot in the routes; sets it up so it works only if the path change; adds a mit-learn mock for window.scrollTo (#1071)
- Change LOGIN_REDIRECT_URL and LOGOUT_REDIRECT_URL to use the base URL (#1075)
- dashboard home (#1062)

Version 0.13.2 (Released June 13, 2024)
--------------

- Update education options and add to schema (#1069)
- local dev: Read `MITOL_AXIOS_BASE_PATH` from env (#1065)
- Add featured courses carousel to unit channel page (#1059)
- Add ordering to testimonials, adjust view on homepage testimonial carousel (#1067)
- Change channel type and url from "offeror" to "unit" (#1031)
- Update dependency ruff to v0.4.8 (#1036)

Version 0.13.1 (Released June 11, 2024)
--------------

- [pre-commit.ci] pre-commit autoupdate (#1055)
- make slick fail more gracefully when parent width unconstrained (#1060)
- Copies static assets to root build directory (#1053)
- Absolute login return URL (#1052)
- resource card fallback image and alt text fix (#1050)
- pass cardProps to loading state (#1048)
- search prefs learning format as list (#1056)
- Use login redirect URL setting for social auth as well
- Expose the login/logout redirects as an environment variable (#1046)
- homepage hero bug fixes (#1034)

Version 0.13.0 (Released June 10, 2024)
--------------

- adding configurable csrf settings and including withXSRFToken in axio… (#1042)
- Fixing authentication issue, and fixing some filtering and test issues (#1039)
- dashboard menu (#1009)
- Add a setting for CSRF_COOKIE_DOMAIN (#1032)
- Add backpopulate command for user profiles (#1030)
- mitxonline etl v2 api (#1026)
- Carousel Makeover: New tabs and Fixed Width Cards (#1020)
- Update dependency @testing-library/react to v16 (#799)
- Offerer banner UI (#1010)
- Add learner testimonials homepage UI (#916)
- Update dependency @ckeditor/ckeditor5-react to v7 (#997)
- Update dependency django-json-widget to v2 (#998)
- OLL contentfiles (#1008)
- Profile-based search filter preferences (#1017)
- Move Heroku deploy step prior to S3 publish
- Fix bug with onboarding steps not saving (#1024)
- Purge the fastly cache on deploy (#1021)
- Write the commit hash to the frontend build for doof (#1023)
- Point the webpack dev server proxy to the new API subdomain (#1022)
- Learning Resource Card (#1015)
- certification_type (#1018)
- Insert learning_path_parents/user_list_parents values into search results (#992)
- Add channel links to unit cards (#1016)
- [pre-commit.ci] pre-commit autoupdate (#1004)
- Add onboarding ux (#964)
- Style tab components to match figma (#1012)
- Toggle Professional (#1005)
- Absolute URL to backend for login routes (#1011)
- Add nullalbe offerors and channels to the testimonials model/API (#1006)

Version 0.12.1 (Released June 05, 2024)
--------------

- Update profile fields to align to LR data (#1003)
- Shanbady/additional details on offeror channel pages (#975)
- Configure JS bundles to use a separate API domain for backend (#1002)
- units page (#974)
- Add "tertiary" button and align button terminology with Figma (#991)

Version 0.12.0 (Released June 04, 2024)
--------------

- Sortby parameter for news_events (#989)
- Reduce functions occurring under atomic transactions; fix dedupe comparison in load_course function (#984)
- Update nginx Docker tag to v1.27.0 (#996)
- Update Node.js to v20.14.0 (#995)
- Update dependency ruff to v0.4.7 (#993)
- Update mcr.microsoft.com/playwright Docker tag to v1.44.1 (#994)
- More code sharing between search and field pages (#980)
- Certification types for learning resources (#977)
- Revert "Error if using npm to install (#986)" (#990)
- Learning resource drawer design updates (#958)
- Adding the EMBEDLY_KEY to the populated envvars for building the release static assets. (#987)
- Error if using npm to install (#986)
- Fix celerybeat schedule (#985)
- Lock file maintenance (#982)
- extract images for news articles (#973)

Version 0.11.0 (Released May 30, 2024)
--------------

- remove package-lock.json (#978)
- Randomize featured api order by offeror, keep sorting by position (#971)
- Updated hero page (#969)
- Fix flaky test by specifying a sort of program courses in serializer (#972)
- Clean up resource descriptions (#957)
- Fix Featured API requests (#970)
- add the footer & privacy, terms and about us pages (#956)
- Adding call to update program topics during ETL loads (#952)
- Upgrade NukaCarousel to v8 (#960)
- Fix detect-secrets baseline file (#967)
- Update dependency @faker-js/faker to v8 (#797)

Version 0.10.2 (Released May 30, 2024)
--------------

- Update dependency @ckeditor/ckeditor5-dev-utils to v40 (#933)
- Topics Listing Page (#946)
- Do not ingest prolearn courses/programs from the past (#955)
- Update dependency @ckeditor/ckeditor5-dev-translations to v40 (#932)
- add All tab (#966)
- fix flaky test (#965)
- [pre-commit.ci] pre-commit autoupdate (#963)
- Update codecov/codecov-action action to v4.4.1 (#962)
- Featured Courses Carousel (#959)
- horizontal facets (#949)
- workflow changes to publish static assets to s3 (#922)
- daily subscription email to subscribers (#937)
- Filtering by free=true should exclude all professional courses (#948)
- Fix flaky test (#954)

Version 0.10.1 (Released May 24, 2024)
--------------

- Homepage News and Events section (#945)
- side nav updates (#951)
- Remove 3 offerors and provide featured resources from all remaining ones (#943)
- Additional offeror details (#923)

Version 0.10.0 (Released May 23, 2024)
--------------

- Update dependency django-ipware to v7 (#935)
- fix install and storybook (#942)
- Fixes button styles to match design (#941)
- header updates (#910)
- Update dependency django-imagekit to v5 (#934)
- [pre-commit.ci] pre-commit autoupdate (#938)
- Work on onboarding updates to profile API (#907)
- Fix several ETL bugs (#939)
- Add Free, Certification, and Professional Facets to Search UI (#917)
- use docker profiles, mount root to watch (#936)
- serve static react app for django 40x (#911)
- Update postgres Docker tag to v12.19 (#931)
- Update opensearchproject/opensearch Docker tag to v2.14.0 (#930)
- Update mcr.microsoft.com/playwright Docker tag to v1.44.0 (#929)
- Update dependency drf-nested-routers to ^0.94.0 (#928)
- Update Node.js to v20.13.1 (#926)
- Update codecov/codecov-action action to v4.4.0 (#927)
- Update dependency ruff to v0.4.4 (#925)
- Update dependency Django to v4.2.13 (#924)
- Browse by Topics section for the home page (#901)
- Fix schema for news_events feed items (#919)

Version 0.9.14 (Released May 20, 2024)
--------------

- Fix schema issue that was breaking redoc (#920)
- Fix flaky python test (#912)
- adding fix for program letter route in nginx (#914)
- Give video/podcast/learning_path resources a default learning format of ["online"] (#892)
- Fix schema generation errors (#895)
- Button Updates (#915)
- Pin actions/upload-artifact action to 6546280 (#868)
- Use our ActionButton, no more MUI IconButton (#909)
- Update Python to v3.12.3 (#349)
- Update Yarn to v4.2.2 (#897)
- Update dependency django-cors-headers to v4 (#840)
- Handle nulls in attestation cover field (#906)
- navigation menu (#890)

Version 0.9.13 (Released May 16, 2024)
--------------

- Adds learner testimonials support (#891)
- Null start dates for OCW course runs (#899)
- Featured API endpoint (#887)

Version 0.9.12 (Released May 14, 2024)
--------------

- use neue-haas-grotesk font (#889)
- Shanbady/add subscribe button to pages (#878)
- bump course-search-utils (#900)
- Replace react-dotdotdot with CSS (#896)
- Switch django migrations to release phase (#898)
- Do not show unpublished runs in learning resource serializer data (#894)
- Fix some n+1 query warnings (#884)

Version 0.9.11 (Released May 13, 2024)
--------------

- add format facet (#888)
- Free everything (#885)
- Add nesting learning resource topics (#844)

Version 0.9.10 (Released May 09, 2024)
--------------

- search dropdown (#875)
- Add certificate as a real database field to LearningResource (#862)
- allow Button to hold a ref (#883)
- Display loading view for search page (#881)

Version 0.9.9 (Released May 09, 2024)
-------------

- fix spacing between department groups (#880)
- #4053 Alert UI component (#861)

Version 0.9.8 (Released May 08, 2024)
-------------

- Departments Listing Page (#865)
- only show clear all if it would do something (#877)
- create exported components bundle (#867)
- Update Yarn to v4.2.1 (#872)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.21 (#871)
- Update dependency ruff to v0.4.3 (#870)
- Update codecov/codecov-action action to v4.3.1 (#869)

Version 0.9.7 (Released May 06, 2024)
-------------

- Api sort fixes (#846)
- configure api BASE_PATH (#863)

Version 0.9.6 (Released May 03, 2024)
-------------

- Additional routes to the Django app (#858)
- allow configuring Axios defaults.withCredentials (#854)
- Alert handler for percolate matches (#842)
- Adds the missing OIDC auth route (#855)
- Learning format filter for search/db api's (#845)
- Corrects the path to write hash.txt (#850)
- Lock file maintenance (#578)
- Self contained front end and fixes for building on Heroku (#829)
- remove pytz (#830)
- Update dependency dj-database-url to v2 (#839)
- Update dependency cryptography to v42 (#838)
- Add format field to LearningResource model and ETL pipelines (#828)

Version 0.9.5 (Released April 30, 2024)
-------------

- Minor updates for PostHog settings (#833)
- Update nginx Docker tag to v1.26.0 (#836)
- Update dependency @types/react to v18.3.1 (#835)
- Update dependency ruff to v0.4.2 (#834)
- Don't initialize PostHog if it's disabled (#831)

Version 0.9.4 (Released April 30, 2024)
-------------

- Text Input + Select components (#827)
- Update ckeditor monorepo to v41 (major) (#795)
- Do not analyze webpack by default (#785)
- Populate prices for mitxonline programs (#817)
- Filter for free resources (#810)
- Add drop down for certification in channel search (#802)
- Pin dependencies (#735)
- Update dependency @dnd-kit/sortable to v8 (#796)
- Design system buttons (#800)
- Reverts decoupled front end and subsequent commits to fix Heroku build errors (#825)
- Remove package manager config (#823)
- Set engines to instruct Heroku to install yarn (#821)
- Deployment fixes for static frontend on Heroku (#819)
- fixing compose mount (#818)
- Move hash.txt location to frontend build directory (#815)
- Build front end to make available on Heroku (#813)
- Updating the LearningResourceViewEvent to cascade delete, rather than do nothing, so things can be deleted (#812)
- Self contained front end using Webpack to build HTML and Webpack Dev Server to serve (#678)
- create api routes for user subscribe/unsubscribe to search (#782)
- Retrieve OL events via API instead of HTML scraping (#786)

Version 0.9.3 (Released April 23, 2024)
-------------

- Fix index schema (#807)
- Merge the lrd_view migration and the schools migration (#804)
- School model and api (#788)
- Adds ETL to pull PostHog view events into the database; adds popular resource APIs (#789)
- Update dependency @typescript-eslint/eslint-plugin to v7 (#801)
- Update opensearchproject/opensearch Docker tag to v2.13.0 (#794)
- Update mcr.microsoft.com/playwright Docker tag to v1.43.1 (#793)
- Update dependency ruff to v0.4.1 (#792)
- Update nginx Docker tag to v1.25.5 (#791)
- Update dependency @types/react to v18.2.79 (#790)
- Capture page views with more information (#746)

Version 0.9.2 (Released April 22, 2024)
-------------

- adding manual migration to fix foreign key type (#752)
- Add channel url to topic, department, and offeror serializers (#778)
- Filter channels api by channel_type (#779)

Version 0.9.1 (Released April 18, 2024)
-------------

- Homepage hero section (#754)
- Add necessary celery client configurables for celery monitoring (#780)

Version 0.9.0 (Released April 16, 2024)
-------------

- Customize channel page facets by channel type (#756)
- Update dependency sentry-sdk to v1.45.0 (#775)
- Update dependency posthog-js to v1.121.2 (#774)
- Update dependency ipython to v8.23.0 (#773)
- Update dependency google-api-python-client to v2.125.0 (#772)
- Update all non-major dev-dependencies (#768)
- Update dependency @testing-library/react to v14.3.1 (#771)
- Update dependency @sentry/react to v7.110.0 (#770)
- Update codecov/codecov-action action to v4.3.0 (#769)
- Update material-ui monorepo (#767)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.20 (#765)
- Update dependency uwsgi to v2.0.25 (#766)
- Update dependency ruff to v0.3.7 (#763)
- Update dependency qs to v6.12.1 (#762)
- Update dependency drf-spectacular to v0.27.2 (#761)
- Update dependency boto3 to v1.34.84 (#760)
- Update Node.js to v20.12.2 (#759)
- Pin dependency @types/react to 18.2.73 (#758)
- Add a channel for every topic, department, offeror (#749)
- Update dependency djangorestframework to v3.15.1 (#628)
- Shanbady/define percolate index schema (#737)

Version 0.8.0 (Released April 11, 2024)
-------------

- Channel Search (#740)
- fixing readonly exception in migration (#741)
- fix channel configuration (#743)
- Configurable, Tabbed Carousels (#731)
- add userlist bookmark button and add to user list modal (#732)
- Adds Posthog support to the frontend. (#693)
- Channel types (#725)
- Remove dupe line from urls.py file (#730)
- adding initial models for user subscription (#723)
- Shanbady/add record hash field for hightouch sync (#717)
- fix flaky test (#720)
- Revert "bump to 2024.3.22" (#719)
- add UserList modals and wire up buttons (#718)
- bump to 2024.3.22
- Migrate config renovate.json (#713)
- try ckeditor grouping again (#711)

Version 0.7.0 (Released April 01, 2024)
-------------

- Basic learning resources drawer (#686)
- Update actions/configure-pages action to v5 (#706)
- display image and description in userlists (#695)
- Update dependency sentry-sdk to v1.44.0 (#705)
- Update dependency google-api-python-client to v2.124.0 (#704)
- Update dependency @sentry/react to v7.109.0 (#703)
- Update Node.js to v20.12.0 (#702)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.19 (#701)
- Update dependency safety to v2.3.5 (#700)
- Update dependency nh3 to v0.2.17 (#699)
- Update dependency boto3 to v1.34.74 (#698)
- Update all non-major dev-dependencies (#696)
- Update dependency @emotion/styled to v11.11.5 (#697)
- Add botocore to ignored deprecation warnings, remove old python 3.7 ignore line (#692)
- Add UserListDetails page (#691)
- Add Posthog integration to backend (#682)
- Update postgres Docker tag to v12.18 (#670)
- remove depricated ACL setting (#690)
- fix new upcoming (#684)
- Remove Cloudfront references (#689)
- updating spec (#688)
- Shanbady/endpoint to retrieve session data (#647)
- Sloan Executive Education blog ETL (#679)

Version 0.6.1 (Released April 01, 2024)
-------------

- Search page cleanup (#675)
- Shanbady/retrieve environment config (#653)
- Update codecov/codecov-action action to v4 (#671)
- Add userlists page and refactor LearningResourceCardTemplate (#650)
- fields pages (#633)
- [pre-commit.ci] pre-commit autoupdate (#677)
- fix learningpath invalidation (#635)

Version 0.6.0 (Released March 26, 2024)
-------------

- News & Events API (#638)
- Update opensearchproject/opensearch Docker tag to v2.12.0 (#669)
- Update mcr.microsoft.com/playwright Docker tag to v1.42.1 (#667)
- Update dependency yup to v1.4.0 (#666)
- Update dependency type-fest to v4.14.0 (#668)
- Update dependency sentry-sdk to v1.43.0 (#665)
- Update dependency rc-tooltip to v6.2.0 (#664)
- Update dependency qs to v6.12.0 (#663)
- Update dependency pytest-mock to v3.14.0 (#662)
- Update dependency google-api-python-client to v2.123.0 (#661)
- Update dependency @sentry/react to v7.108.0 (#660)
- Update material-ui monorepo (#659)
- Update dependency ruff to v0.3.4 (#657)
- Update dependency boto3 to v1.34.69 (#656)
- Update all non-major dev-dependencies (#654)
- generate v0 apis (#651)
- MIT news/events ETL  (#612)
- Remove all usages of pytz (#646)
- allow filtering by readable id in the api (#639)
- Update jest-dom, make TS aware (#637)
- fixing ordering of response data in test (#634)
- [pre-commit.ci] pre-commit autoupdate (#610)
- Update dependency eslint-plugin-testing-library to v6 (#354)
- Update Yarn to v3.8.1 (#455)

Version 0.5.1 (Released March 19, 2024)
-------------

- Add a Search Page (#618)
- pushing fix for test failure (#631)
- shanbady/separate database router and schema for program certificates (#617)
- Update dependency django-anymail to v10.3 (#627)
- Update dependency @sentry/react to v7.107.0 (#626)
- Update react-router monorepo to v6.22.3 (#625)
- Update material-ui monorepo (#624)
- Update dependency boto3 to v1.34.64 (#623)
- Update dependency axios to v1.6.8 (#622)
- Update dependency @ckeditor/ckeditor5-dev-utils to v39.6.3 (#621)
- Update dependency @ckeditor/ckeditor5-dev-translations to v39.6.3 (#620)
- Update all non-major dev-dependencies (#619)
- Endpoint for user program certificate info and program letter links (#608)
- Update Node.js to v20 (#507)
- Program Letter View (#605)

Version 0.5.0 (Released March 13, 2024)
-------------

- Avoid duplicate courses (#603)
- Type-specific api endpoints for videos and video playlists (#595)
- Update dependency ipython to v8.22.2 (#600)
- Update dependency html-entities to v2.5.2 (#599)
- Update dependency boto3 to v1.34.59 (#598)
- Update dependency Django to v4.2.11 (#597)
- Update all non-major dev-dependencies (#596)
- Assign topics to videos and playlists (#584)
- Add daily micromasters ETL task to celerybeat schedule (#585)

Version 0.4.1 (Released March 08, 2024)
-------------

- resource_type changes (#583)
- Update nginx Docker tag to v1.25.4 (#544)
- Youtube video ETL and search (#558)

Version 0.4.0 (Released March 06, 2024)
-------------

- Update dependency ruff to ^0.3.0 (#577)
- Update dependency html-entities to v2.5.0 (#576)
- Update dependency python-rapidjson to v1.16 (#575)
- Update dependency python-dateutil to v2.9.0 (#574)
- Update dependency google-api-python-client to v2.120.0 (#573)
- Update dependency @sentry/react to v7.104.0 (#572)
- Update react-router monorepo to v6.22.2 (#571)
- Update dependency storybook-addon-react-router-v6 to v2.0.11 (#570)
- Update dependency sentry-sdk to v1.40.6 (#569)
- Update dependency markdown2 to v2.4.13 (#568)
- Update dependency ddt to v1.7.2 (#567)
- Update dependency boto3 to v1.34.54 (#566)
- Update dependency @ckeditor/ckeditor5-dev-utils to v39.6.2 (#565)
- Update dependency @ckeditor/ckeditor5-dev-translations to v39.6.2 (#564)
- Update all non-major dev-dependencies (#563)
- Create program certificate django model (#561)
- fix OpenAPI response for content_file_search (#559)
- Update material-ui monorepo (#233)
- next/previous links for search api (#550)
- Remove livestream app (#549)
- Assign best date available to LearningResourceRun.start_date field (#514)
- Update dependency ipython to v8.22.1 (#547)
- Update dependency google-api-python-client to v2.119.0 (#546)
- Update dependency @sentry/react to v7.102.1 (#545)
- Update mcr.microsoft.com/playwright Docker tag to v1.41.2 (#543)
- Update dependency sentry-sdk to v1.40.5 (#542)
- Update dependency iso-639-1 to v3.1.2 (#540)
- Update dependency boto3 to v1.34.49 (#541)
- Update all non-major dev-dependencies (#539)

Version 0.3.3 (Released March 04, 2024)
-------------

- Save user with is_active from SCIM request (#535)
- Add SCIM client (#513)
- CI and test fixtures for E2E testing (#481)
- Update postgres Docker tag to v12.18 (#530)
- Update dependency responses to ^0.25.0 (#529)
- Update dependency google-api-python-client to v2.118.0 (#528)
- Update dependency @sentry/react to v7.101.1 (#527)
- Update react-router monorepo to v6.22.1 (#526)
- Update nginx Docker tag to v1.25.4 (#524)
- Update dependency ruff to v0.2.2 (#525)
- Update dependency social-auth-core to v4.5.3 (#523)
- Update dependency sentry-sdk to v1.40.4 (#522)
- Update dependency iso-639-1 to v3.1.1 (#521)
- Update dependency boto3 to v1.34.44 (#520)
- Update all non-major dev-dependencies (#519)
- Update Node.js to v18.19.1 (#518)

Version 0.3.2 (Released February 20, 2024)
-------------

- Update ruff and adjust code to new criteria (#511)
- Avoid using get_or_create for LearningResourceImage object that has no unique constraint (#510)
- Update SimenB/github-actions-cpu-cores action to v2 (#508)
- Update dependency sentry-sdk to v1.40.3 (#506)
- Update dependency react-share to v5.1.0 (#504)
- Update dependency pytest-django to v4.8.0 (#503)
- Update dependency google-api-python-client to v2.117.0 (#502)
- Update dependency faker to v22.7.0 (#501)
- Update dependency @sentry/react to v7.100.1 (#499)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.18 (#498)
- Update dependency uwsgi to v2.0.24 (#497)
- Update all non-major dev-dependencies (#500)
- Update dependency boto3 to v1.34.39 (#496)
- Update dependency Django to v4.2.10 (#495)
- Update dependency @ckeditor/ckeditor5-dev-utils to v39.6.1 (#493)
- Update dependency @ckeditor/ckeditor5-dev-translations to v39.6.1 (#492)
- Update all non-major dev-dependencies (#491)
- fix topics schema (#488)
- Use root document counts to avoid overcounting in aggregations (#484)

Version 0.3.1 (Released February 14, 2024)
-------------

- Avoid integrity errors when loading instructors (#478)
- Load fixtures by default in dev environment (#483)
- upgrading version of poetry (#480)
- Fix multiword search filters & aggregations, change Non Credit to Non-Credit
- Update dependency nplusone to v1 (#381)
- Update dependency pytest-env to v1 (#382)

Version 0.3.0 (Released February 09, 2024)
-------------

- Allow for blank OCW terms/years (adjust readable_id accordingly), raise an error at end of ocw_courses_etl function if any exceptions occurred during processing (#475)
- Remove all references to open-discussions (#472)
- Fix prolearn etl (#471)
- Multiple filter options for learningresources and contenfiles API rest endpoints (#449)
- Lock file maintenance (#470)
- Update dependency pluggy to v1.4.0 (#468)
- Update dependency jekyll-feed to v0.17.0 (#467)
- Update dependency @types/react to v18.2.53 (#469)
- Update dependency ipython to v8.21.0 (#466)
- Update dependency google-api-python-client to v2.116.0 (#465)
- Update dependency django-debug-toolbar to v4.3.0 (#464)
- Update dependency @sentry/react to v7.99.0 (#463)
- Update apache/tika Docker tag to v2.5.0 (#461)
- Update docker.elastic.co/elasticsearch/elasticsearch Docker tag to v7.17.17 (#460)
- Update dependency prettier to v3.2.5 (#462)
- Update dependency social-auth-core to v4.5.2 (#458)
- Update dependency toolz to v0.12.1 (#459)
- Update dependency moto to v4.2.14 (#457)
- Update dependency drf-spectacular to v0.27.1 (#456)
- Update dependency boto3 to v1.34.34 (#454)
- Update dependency beautifulsoup4 to v4.12.3 (#453)
- Update dependency axios to v1.6.7 (#452)
- Update codecov/codecov-action action to v3.1.6 (#451)
- Update all non-major dev-dependencies (#450)
- Added support to set SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS (#429)
- do not allow None in levels/languages (#446)

Version 0.2.2 (Released February 02, 2024)
-------------

- Fix webhook url (#442)
- Update akhileshns/heroku-deploy digest to 581dd28 (#366)
- Poetry install to virtualenv (#436)
- rename oasdiff workflow (#437)
- Upgrade tika and disable OCR via headers (#430)
- Add a placeholder dashboard page (#428)
- Update dependency faker to v22 (#378)
- Update dependency jest-fail-on-console to v3 (#380)
- Save OCW contentfiles as absolute instead of relative (#424)
- Check for breaking openapi changes on ci (#425)
- Initial E2E test setup with Playwright (#419)
- Use DRF NamespaceVersioning to manage OpenAPI api versions (#411)

Version 0.2.1 (Released January 30, 2024)
-------------

- Modify OCW webhook endpoint to handle multiple courses (#412)
- Optionally skip loading OCW content files (#413)
- Add /api/v0/users/me API (#415)

Version 0.2.0 (Released January 26, 2024)
-------------

- Get rid of tika verify warning (#410)
- Improve contentfile api query performance (#409)
- Search: Tweak aggregations formattings, add OpenAPI schema for metadata (#407)
- Remove unused django apps (#398)

Version 0.1.1 (Released January 19, 2024)
-------------

- Replace Sass styles with Emotion's CSS-in-JS (#390)
- move openapi spec to subdir (#397)
- Add Storybook to present front end components (#360)
- remove legacy search (#365)
- Remove author from LearningPath serializer (#385)

Version 0.1.0 (Released January 09, 2024)
-------------

- chore(deps): update dependency github-pages to v228 (#379)
