import { useState } from "react"
import { useLive } from "live_vite"

export default function Counter({ count }: { count: number }) {
  const live = useLive()
  const [diff, setDiff] = useState(1)

  return (
    <div>
      Current count
      <div data-pw-counter>{count}</div>
      <label style={{ display: "block", marginTop: "2rem" }}>Diff: </label>
      <input
        type="range"
        min="1"
        max="10"
        value={diff}
        onChange={e => setDiff(Number(e.target.value))}
        style={{ marginTop: "1rem" }}
      />
      <button
        onClick={() => live.pushEvent("increment", { value: diff })}
        style={{ marginTop: "1rem", display: "block" }}
      >
        Increase counter by {diff}
      </button>
    </div>
  )
}
