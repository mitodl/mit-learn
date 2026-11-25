import React from "react"
import ReactMarkdown from "react-markdown"
import type { Options as MarkdownOptions } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import styled from "@emotion/styled"
import "katex/dist/katex.min.css"

const Markdown = styled.div(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  overflowWrap: "anywhere",
  "> :first-child": { marginTop: 0 },
  "> :last-child": { marginBottom: 0 },
  p: { margin: "0 0 12px" },
  img: { maxWidth: "100%", height: "auto" },
  ".katex-display": {
    overflowX: "auto",
    overflowY: "hidden",
    margin: "12px 0",
  },
  table: { borderCollapse: "collapse", margin: "12px 0" },
  "th, td": {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "4px 8px",
  },
  "pre, code": { ...theme.typography.body2, fontFamily: "monospace" },
  pre: {
    overflowX: "auto",
    padding: "12px",
    background: theme.custom.colors.lightGray1,
  },
}))

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
}

const remarkTableBreaks = () => (tree: MarkdownNode) => {
  const visit = (node: MarkdownNode) => {
    if (node.type === "tableCell") {
      node.children = node.children?.map((child) =>
        child.type === "html" && /^<br\s*\/?>$/i.test(child.value ?? "")
          ? { type: "break" }
          : child,
      )
    }
    node.children?.forEach(visit)
  }
  visit(tree)
}

/**
 * GFM for the pipe tables the OCR assembler emits. singleTilde is off so a
 * "~" used for "approximately" in problem text is not read as strikethrough.
 */
const REMARK_PLUGINS: MarkdownOptions["remarkPlugins"] = [
  [remarkGfm, { singleTilde: false }],
  remarkMath,
  remarkTableBreaks,
]

const DISPLAY_MATH = /\$\$([\s\S]+?)\$\$/g
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g

const isTableDelimiter = (line: string | undefined) =>
  line !== undefined && line.includes("|") && TABLE_DELIMITER.test(line)

/**
 * Split markdown into runs of lines, marking fenced code blocks and pipe
 * tables, whose text must be left as it is. Joining the runs' lines with
 * newlines gives back the input.
 */
const splitBlocks = (markdown: string) => {
  const lines = markdown.split("\n")
  const blocks: { lines: string[]; verbatim: boolean }[] = []
  const push = (blockLines: string[], verbatim: boolean) => {
    const last = blocks[blocks.length - 1]
    if (last && last.verbatim === verbatim) last.lines.push(...blockLines)
    else blocks.push({ lines: blockLines, verbatim })
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(FENCE_OPEN)?.[1]
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`)
      let end = i + 1
      while (end < lines.length && !close.test(lines[end])) end++
      push(lines.slice(i, end + 1), true)
      i = end + 1
    } else if (line.includes("|") && isTableDelimiter(lines[i + 1])) {
      let end = i + 2
      while (end < lines.length && lines[end].includes("|")) end++
      push(lines.slice(i, end), true)
      i = end
    } else {
      push([line], false)
      i++
    }
  }
  return blocks
}

const fenceText = (text: string) =>
  text.replace(
    DISPLAY_MATH,
    (_, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`,
  )

/**
 * Put each $$...$$ on lines of its own. remark-math reads a $$ that starts a
 * line as a fence, like a code fence: the rest of that line is dropped and
 * only a $$ on a line of its own closes it. Converted PDFs often write
 * "$$y = \begin{cases}...\end{cases}$$", which would lose "y =" and leave
 * the closing $$ inside the math.
 *
 * Math in code (fenced blocks and inline spans) and in table cells is left
 * alone: code is literal, and a newline would split a table row.
 */
const fenceDisplayMath = (markdown: string) =>
  splitBlocks(markdown)
    .map(({ lines, verbatim }) => {
      const text = lines.join("\n")
      if (verbatim) return text
      let out = ""
      let last = 0
      for (const span of text.matchAll(CODE_SPAN)) {
        out += fenceText(text.slice(last, span.index)) + span[0]
        last = span.index + span[0].length
      }
      return out + fenceText(text.slice(last))
    })
    .join("\n")

/**
 * Markdown read from a PDF, with LaTeX math ($...$ and $$...$$) rendered by
 * KaTeX and GFM pipe tables (which the OCR assembler emits) rendered as
 * tables. Raw HTML in the markdown is not rendered.
 */
const ProblemMarkdown: React.FC<{ children: string; className?: string }> = ({
  children,
  className,
}) => (
  <Markdown className={className}>
    <ReactMarkdown
      skipHtml
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={[rehypeKatex]}
    >
      {fenceDisplayMath(children)}
    </ReactMarkdown>
  </Markdown>
)

export default ProblemMarkdown
export { fenceDisplayMath }
