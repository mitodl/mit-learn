import cartesianProduct from "./cartesianProduct"

describe("cartesianProduct", () => {
  it("should return an empty array when given empty arrays", () => {
    const result = cartesianProduct([], [])
    expect(result).toEqual([])
  })

  it("should handle single array", () => {
    const result = cartesianProduct([{ a: 1 }, { a: 2 }])
    expect(result).toEqual([{ a: 1 }, { a: 2 }])
  })

  it("should generate cartesian product of two arrays", () => {
    const result = cartesianProduct(
      [
        { a: 0, x: 10 },
        { a: 1, x: 20 },
      ],
      [{ y: "a" }, { y: "b" }, { y: "c" }],
      [{ z: true }, { z: false }],
    )
    expect(result).toEqual([
      { a: 0, x: 10, y: "a", z: true },
      { a: 0, x: 10, y: "a", z: false },
      { a: 0, x: 10, y: "b", z: true },
      { a: 0, x: 10, y: "b", z: false },
      { a: 0, x: 10, y: "c", z: true },
      { a: 0, x: 10, y: "c", z: false },
      { a: 1, x: 20, y: "a", z: true },
      { a: 1, x: 20, y: "a", z: false },
      { a: 1, x: 20, y: "b", z: true },
      { a: 1, x: 20, y: "b", z: false },
      { a: 1, x: 20, y: "c", z: true },
      { a: 1, x: 20, y: "c", z: false },
    ])
  })
})
