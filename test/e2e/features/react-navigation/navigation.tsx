import { useLiveNavigationReact } from "live_vite"

interface Props {
  params: Record<string, any>
  query_params: Record<string, any>
}

export default function Navigation({ params, query_params }: Props) {
  const { patch, navigate } = useLiveNavigationReact()

  const patchQuery = () => {
    patch({ foo: "bar", timestamp: Date.now().toString() })
  }

  const navigateToAlt = () => {
    navigate("/react-navigation/alt/test2?baz=qux")
  }

  const navigateBack = () => {
    navigate("/react-navigation/test1")
  }

  return (
    <div>
      <h1>Navigation Test</h1>
      <div id="current-params">{JSON.stringify(params)}</div>
      <div id="current-query">{JSON.stringify(query_params)}</div>

      <button id="patch-btn" onClick={patchQuery}>
        Patch Query
      </button>
      <button id="navigate-btn" onClick={navigateToAlt}>
        Navigate to Alt
      </button>
      <button id="navigate-back-btn" onClick={navigateBack}>
        Navigate Back
      </button>
    </div>
  )
}
