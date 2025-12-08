import { vi } from "vitest"

// Set environment variables BEFORE any modules are loaded
// This is critical because some modules check env vars at module load time
process.env.NEXT_PUBLIC_MITOL_API_BASE_URL =
  "http://api.test.learn.odl.local:8063"
process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL =
  "http://api.test.mitxonline.odl.local:8053"
process.env.NEXT_PUBLIC_ORIGIN = "http://test.learn.odl.local:8062"
process.env.NEXT_PUBLIC_EMBEDLY_KEY = "fake-embedly-key"

// Provide Jest-compatible globals for packages that still use Jest APIs
// This must be loaded before any modules that use jest.fn() etc.
if (typeof globalThis.jest === "undefined") {
  globalThis.jest = {
    fn: vi.fn,
    mock: vi.mock,
    doMock: vi.doMock,
    requireActual: vi.importActual,
    requireMock: vi.importMock,
    clearAllMocks: vi.clearAllMocks,
    resetAllMocks: vi.resetAllMocks,
    restoreAllMocks: vi.restoreAllMocks,
    spyOn: vi.spyOn,
    mocked: vi.mocked,
  } as any
}
