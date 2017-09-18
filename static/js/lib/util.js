// @flow
import R from "ramda"

import type { Match } from "react-router"

export const getChannelName = (props: { match: Match }): string =>
  props.match.params.channelName || ""

export const getPostID = (props: { match: Match }): string =>
  props.match.params.postID || ""

/**
 * Returns a promise which resolves after a number of milliseconds have elapsed
 */
export const wait = (millis: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, millis))

/**
 * Adds on an index for each item in an iterable
 */
export function* enumerate<T>(
  iterable: Iterable<T>
): Generator<[number, T], void, void> {
  let i = 0
  for (const item of iterable) {
    yield [i, item]
    ++i
  }
}

export const isEmptyText = R.compose(R.isEmpty, R.trim, R.defaultTo(""))
