export interface CounterState {
  /** The text of the counter, for example `12 / 200`. */
  text: string
  /** The value is longer than the limit. */
  over: boolean
}

/**
 * The character counter of a form field (UI-F03-S01, spec R2). It counts what a person sees as
 * characters, so an emoji or an accented letter written as two parts counts once.
 */
export function describeCounter(value: string, max: number): CounterState {
  const count = [...value.normalize("NFC")].length

  return { text: `${count} / ${max}`, over: count > max }
}
