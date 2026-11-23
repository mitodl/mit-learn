import { fenceDisplayMath } from "./ProblemMarkdown"

describe("fenceDisplayMath", () => {
  test("puts display math on lines of its own", () => {
    const markdown =
      "Text before.\n\n$$y=f(k)=\n\\begin{cases}a & b\\\\c & d\\end{cases}$$\n\nAfter."
    expect(fenceDisplayMath(markdown)).toBe(
      "Text before.\n\n\n\n$$\ny=f(k)=\n\\begin{cases}a & b\\\\c & d\\end{cases}\n$$\n\n\n\nAfter.",
    )
  })

  test("leaves inline math alone", () => {
    expect(fenceDisplayMath("Let $x$ and $y_t$ be given.")).toBe(
      "Let $x$ and $y_t$ be given.",
    )
  })

  test("fences each display equation separately", () => {
    expect(fenceDisplayMath("$$a$$ and $$b$$")).toBe(
      "\n\n$$\na\n$$\n\n and \n\n$$\nb\n$$\n\n",
    )
  })
})
