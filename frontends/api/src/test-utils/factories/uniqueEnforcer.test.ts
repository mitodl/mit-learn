import { EnforceLimitError } from "enforce-unique"
import { UniqueEnforcer } from "./uniqueEnforcer"

const blockFor = (ms: number) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    // Simulates a worker stalled by a busy CI runner.
  }
}

describe("UniqueEnforcer", () => {
  test("does not give up on a generator that is merely slow", () => {
    const enforcer = new UniqueEnforcer()
    expect(
      enforcer.enforce(() => {
        blockFor(60)
        return 1
      }),
    ).toBe(1)
  })

  test("still throws when the generator keeps colliding", () => {
    const enforcer = new UniqueEnforcer()
    enforcer.enforce(() => 1)
    expect(() => enforcer.enforce(() => 1)).toThrow(EnforceLimitError)
  })
})
