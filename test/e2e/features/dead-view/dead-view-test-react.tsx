export default function DeadViewTestReact({ message }: { message: string }) {
  return (
    <div data-pw-dead-view-react>
      <p>React component in dead view:</p>
      <p data-pw-react-message>{message}</p>
    </div>
  )
}
