/**
 * Each column's share of a desktop row. Every cell in a column must be given
 * the same value, which is why these live in one map rather than being
 * repeated at each header and cell — see B2BTable's doc comment.
 */
const COLUMN_FLEX = {
  learner: 2.5,
  status: 1.5,
  progress: 1.5,
  lastActivity: 1.5,
} as const

export { COLUMN_FLEX }
