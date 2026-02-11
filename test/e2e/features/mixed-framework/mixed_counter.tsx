import { useLive } from "live_vite"

export default function MixedCounter({ count }: { count: number }) {
  const live = useLive()

  return (
    <div>
      <div data-pw-react-counter>{count}</div>
      <button onClick={() => live.pushEvent("increment", { value: 1 })} data-pw-react-increment>
        React +1
      </button>
    </div>
  )
}
