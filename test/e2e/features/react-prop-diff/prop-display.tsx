export default function PropDisplay({ data }: { data: any }) {
  return (
    <div>
      <h2>Props Display Component</h2>
      <pre data-testid="props-json">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
