interface Props {
  label?: string
  default?: any
}

export default function SlotTest({ label, default: defaultSlot }: Props) {
  return (
    <div className="slot-test">
      {label && <span data-pw-label>{label}</span>}
      <div data-pw-slot>{defaultSlot ?? null}</div>
    </div>
  )
}
