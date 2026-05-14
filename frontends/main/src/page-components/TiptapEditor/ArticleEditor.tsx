/**
 * Backward-compatible re-export.
 * The news editor logic now lives in contentTypes/news/NewsEditor.tsx.
 * All /news pages continue to import from this path without changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export { NewsEditor as ArticleEditor } from "./contentTypes/news/NewsEditor"
export type { NewsEditorProps as ArticleEditorProps } from "./contentTypes/news/NewsEditor"
