# Learnings

Detailed notes and insights gathered across Claude sessions. Brief summaries belong in [CLAUDE.md](../CLAUDE.md); expand on them here.

## React Form Hook Pitfalls

### Null values make inputs uncontrolled
Ecto schema fields default to `nil`, which becomes `null` in JSON. In React, `<input value={null} />` makes the input **uncontrolled** — it keeps its DOM value even when React re-renders. Always coalesce: `value: field.value ?? ""`.

### Reset/submit must replace, not mutate
`Object.assign(store.currentValues, newValues)` mutates in place. This works for Vue (reactivity tracks mutations) but not reliably for React. Use `store.currentValues = deepClone(store.initialValues)` to replace the entire reference, ensuring all field getters read fresh values.

### Submit reset order matters
When resetting after submit, do NOT copy `currentValues` → `initialValues` first. That overwrites the original empty state with filled values, making the subsequent "reset" a no-op.
