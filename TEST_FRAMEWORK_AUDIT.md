# TEST_FRAMEWORK_AUDIT

## Concurrency & Sharding
**Current Architecture:**
Playwright is configured to run tests completely serially. In `playwright.config.ts`, `fullyParallel` is set to `false`, and `workers` is strictly set to `1` for both CI and local execution.

**Analysis:**
The framework is not maximizing multi-core execution. The single-worker constraint is likely a heavy-handed architectural workaround to prevent data collisions and race conditions within the Firebase emulators.

**Recommendations:**
To safely enable concurrent execution (`fullyParallel: true` and `workers: '50%'` or multiple workers), the testing strategy must decouple shared database state:
1. **Unique Entity IDs:** Generate unique user IDs and document IDs per test context (e.g., appending a UUID) so parallel tests operate on entirely isolated Firestore documents rather than colliding on a single `admin-user` or `student-user`.
2. **Worker-Isolated Emulator Projects:** Alternatively, dynamically spin up separate Firebase emulator project IDs (e.g., `demo-project-${workerIndex}`) per Playwright worker to achieve true, airtight database isolation without cross-test data locks.

## Global Setup & Auth State
**Current Architecture:**
`global-setup.ts` waits for the necessary emulator ports and seeds the initial database state. However, `test-utils.ts` intercepts execution with a `test.beforeEach` hook that executes `clearFirestore()`, `clearAuth()`, and entirely reseeds the database before *every single test*, subsequently forcing a hardcoded `setTimeout` of 3000ms. Additionally, `login-helper.ts` handles authentication by navigating to the `/login` route and injecting custom tokens into the window context for every test.

**Analysis:**
- **Massive I/O Overhead:** Dropping and rebuilding the entire Firebase emulator state before *every single test* destroys test suite performance. The 3-second hardcoded pause compounds this, adding artificial latency and negating any efficiency gained by the initial `global-setup.ts` seeding.
- **Missing Auth State Caching:** We are unnecessarily performing a full UI/client-level login injection for every test. Playwright's native `storageState` caching is entirely unused.

**Recommendations:**
1. **Refactor Data Seeding:** Remove the destructive wipe-and-seed logic from the `test.beforeEach` hook. Foundation data should be seeded once globally. Tests should manage their own atomic data creation and cleanup (e.g., in an `afterEach` hook) or use test-isolated records.
2. **Implement `storageState` Auth Contexts:** Refactor the framework to authenticate core personas (Admin, Student, Coordinator) exactly once during `global-setup.ts` or a setup project. Save their resulting browser contexts (localStorage, IndexedDB, cookies) to `.auth/` JSON files, and inject these states into tests using `test.use({ storageState: '.auth/admin.json' })`. This entirely bypasses redundant login flows.

## Flakiness Mitigation
**Current Architecture:**
- **Retries:** Configured well (2 retries in CI, 0 locally).
- **Trace Viewers & Video:** Correctly configured for cloud UAT and debugging per requirements. CI sets `trace: 'on'` and `video: 'on'`.
- **Timeouts:** The architecture currently lacks global expect/test timeouts, and heavily leverages static pauses (`page.waitForTimeout(1000)` in `login-helper.ts`, `setTimeout` in `test-utils.ts`).

**Analysis:**
While the artifact generation (traces/videos) is optimally set up to catch CI race conditions without bloating local runs, the structural reliance on static waits introduces deep flakiness. Static timeouts inevitably lead to test failures when CI runner latency spikes (e.g., an emulator takes 1.2s instead of 1.0s to sync auth), and needlessly bloat execution time when the system resolves faster than the hardcoded pause.

**Recommendations:**
1. **Eradicate Static Waits:** Replace all instances of `waitForTimeout` and `setTimeout` with deterministic Playwright auto-waiting assertions. Use assertions like `await expect(page.locator('selector')).toBeVisible()` or `await page.waitForResponse(url)` to ensure the DOM or network has reached the required state before proceeding.
2. **Define Strict Global Timeouts:** Explicitly define `timeout` (e.g., 30000ms) and `expect.timeout` (e.g., 5000ms) inside `playwright.config.ts` to fail fast on stuck processes and enforce responsive UI state assertions.
