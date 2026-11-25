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

  test("leaves display math in table cells alone", () => {
    const markdown =
      "Before $$a$$.\n\n| Quantity | Formula |\n| --- | --- |\n| Energy | $$E=mc^2$$ |\n\nAfter."
    expect(fenceDisplayMath(markdown)).toBe(
      "Before \n\n$$\na\n$$\n\n.\n\n| Quantity | Formula |\n| --- | --- |\n| Energy | $$E=mc^2$$ |\n\nAfter.",
    )
  })

  test("leaves display math in fenced code alone", () => {
    const markdown = "```\nprint('$$x$$')\n```\n\n~~~~tex\n$$y$$\n~~~~"
    expect(fenceDisplayMath(markdown)).toBe(markdown)
  })

  test("leaves an unclosed code fence alone to the end", () => {
    const markdown = "$$a$$\n```\n$$b$$"
    expect(fenceDisplayMath(markdown)).toBe("\n\n$$\na\n$$\n\n\n```\n$$b$$")
  })

  test("leaves display math in inline code alone", () => {
    expect(fenceDisplayMath("Write `$$x$$` or ``$$y$$`` for $$z$$.")).toBe(
      "Write `$$x$$` or ``$$y$$`` for \n\n$$\nz\n$$\n\n.",
    )
  })
})
