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

/**
 * Put each $$...$$ on lines of its own. remark-math reads a $$ that starts a
 * line as a fence, like a code fence: the rest of that line is dropped and
 * only a $$ on a line of its own closes it. Converted PDFs often write
 * "$$y = \begin{cases}...\end{cases}$$", which would lose "y =" and leave
 * the closing $$ inside the math.
 */
const fenceDisplayMath = (markdown: string) =>
  markdown.replace(
    DISPLAY_MATH,
    (_, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`,
  )

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
