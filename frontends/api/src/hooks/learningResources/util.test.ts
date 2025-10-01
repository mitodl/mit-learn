import { faker } from "@faker-js/faker/locale/en"
import { randomizeGroups, hasPosition } from "./util"

faker.seed(12345) // Seed faker for consistent test results
jest
  .spyOn(Math, "random")
  .mockImplementation(() => faker.number.float({ min: 0, max: 1 }))

describe("randomizeGroups", () => {
  it("should group by position and randomize within groups with duplicates", () => {
    const items = [
      { id: "a1", position: 1 },
      { id: "a2", position: 1 },
      { id: "b1", position: 12 },
      { id: "b2", position: 12 },
      { id: "c1", position: 2 },
      { id: "c2", position: 2 },
      { id: "d1", position: 3 },
    ]

    const result = randomizeGroups(items)

    // Should be grouped by position in numerical order
    expect(result[0].position).toBe(1)
    expect(result[1].position).toBe(1)
    expect(result[2].position).toBe(2)
    expect(result[3].position).toBe(2)
    expect(result[4].position).toBe(3)
    expect(result[5].position).toBe(12)
    expect(result[6].position).toBe(12)

    // Should contain all items
    expect(result).toHaveLength(7)
    expect(result.map((item) => item.id).sort()).toEqual([
      "a1",
      "a2",
      "b1",
      "b2",
      "c1",
      "c2",
      "d1",
    ])
  })

  it("should handle positions greater than 10 correctly (avoid lexicographical sorting)", () => {
    const items = [
      { id: "item15", position: 15 },
      { id: "item2", position: 2 },
      { id: "item11", position: 11 },
      { id: "item1", position: 1 },
      { id: "item20", position: 20 },
    ]

    const result = randomizeGroups(items)

    // Should be numerically sorted: 1, 2, 11, 15, 20
    // NOT lexicographically sorted: 1, 11, 15, 2, 20
    const positions = result.map((item) => item.position)
    expect(positions).toEqual([1, 2, 11, 15, 20])
  })

  it("should handle empty array", () => {
    const items: Array<{ id: string; position: number }> = []
    const result = randomizeGroups(items)
    expect(result).toEqual([])
  })
})

describe("hasPosition", () => {
  it("should return true for objects with non-null position", () => {
    const obj = { id: "test", position: 5 }
    expect(hasPosition(obj)).toBe(true)
  })

  it("should return false for objects with null position", () => {
    const obj = { id: "test", position: null }
    expect(hasPosition(obj)).toBe(false)
  })

  it("should return true for objects with position 0", () => {
    const obj = { id: "test", position: 0 }
    expect(hasPosition(obj)).toBe(true)
  })

  it("should act as a type guard", () => {
    const obj: { id: string; position: number | null } = {
      id: "test",
      position: 5,
    }

    if (hasPosition(obj)) {
      // TypeScript should now know that obj.position is number, not number | null
      const position: number = obj.position
      expect(position).toBe(5)
    }
  })
})
