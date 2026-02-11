import { useEventReplyReact } from "live_vite"

interface IncrementReply {
  counter: number
  timestamp: string
}

interface UserReply {
  id: number
  name: string
  email: string
}

interface SlowReply {
  message: string
  completed_at: string
}

interface PingReply {
  response: string
  timestamp: string
}

interface ValidateReply {
  valid: boolean
  error?: string
  message?: string
}

export default function ReactEventReplyTest({ counter }: { counter: number }) {
  const incrementReply = useEventReplyReact<IncrementReply>("increment")
  const userReply = useEventReplyReact<UserReply>("get-user")
  const errorReply = useEventReplyReact("error-event")
  const slowReply = useEventReplyReact<SlowReply>("slow-event")
  const pingReply = useEventReplyReact<PingReply>("ping")
  const dataTypeReply = useEventReplyReact("get-data-type")
  const validateReply = useEventReplyReact<ValidateReply>("validate-input")

  const handleIncrement = async (by: number) => {
    try {
      await incrementReply.execute({ by })
    } catch (error) {
      console.error("Increment error:", error)
    }
  }

  const fetchUser = async (id: number) => {
    try {
      await userReply.execute({ id })
    } catch (error) {
      console.error("User fetch error:", error)
    }
  }

  const triggerError = async () => {
    try {
      await errorReply.execute()
    } catch (error) {
      console.error("Expected error:", error)
    }
  }

  const startSlowEvent = async (delay: number) => {
    try {
      await slowReply.execute({ delay })
    } catch (error) {
      console.error("Slow event error:", error)
    }
  }

  const cancelSlowEvent = () => {
    slowReply.cancel()
  }

  const ping = async () => {
    try {
      await pingReply.execute()
    } catch (error) {
      console.error("Ping error:", error)
    }
  }

  const testDataType = async (type: string) => {
    try {
      await dataTypeReply.execute({ type })
    } catch (error) {
      console.error(`Data type ${type} error:`, error)
    }
  }

  const validateShortInput = async () => {
    try {
      await validateReply.execute({ input: "Hi" })
    } catch (error) {
      console.error("Validation error:", error)
    }
  }

  const validateValidInput = async () => {
    try {
      await validateReply.execute({ input: "Valid Input" })
    } catch (error) {
      console.error("Validation error:", error)
    }
  }

  const validateLongInput = async () => {
    try {
      await validateReply.execute({ input: "This is a very long input that exceeds the maximum allowed length" })
    } catch (error) {
      console.error("Validation error:", error)
    }
  }

  return (
    <div className="event-reply-test" data-pw-event-reply-test>
      <h2>useEventReplyReact Tests</h2>

      {/* Server State Display */}
      <div className="server-state" data-pw-server-state>
        <p data-pw-server-counter>Server Counter: {counter}</p>
      </div>

      {/* Basic Increment Test */}
      <div className="section">
        <h3>Increment Test</h3>
        <div className="controls">
          <button onClick={() => handleIncrement(1)} data-pw-increment-1>+1</button>
          <button onClick={() => handleIncrement(5)} data-pw-increment-5>+5</button>
        </div>
        <div className="state">
          <div data-pw-increment-loading>Loading: {String(incrementReply.isLoading)}</div>
          <div data-pw-increment-data>Data: {JSON.stringify(incrementReply.data)}</div>
        </div>
      </div>

      {/* User Data Test */}
      <div className="section">
        <h3>User Data Test</h3>
        <div className="controls">
          <button onClick={() => fetchUser(1)} data-pw-fetch-user-1>Fetch User 1</button>
          <button onClick={() => fetchUser(2)} data-pw-fetch-user-2>Fetch User 2</button>
          <button onClick={() => fetchUser(999)} data-pw-fetch-user-999>Fetch User 999</button>
        </div>
        <div className="state">
          <div data-pw-user-loading>Loading: {String(userReply.isLoading)}</div>
          <div data-pw-user-data>Data: {JSON.stringify(userReply.data)}</div>
        </div>
      </div>

      {/* Error Handling Test */}
      <div className="section">
        <h3>Server Error Response Test</h3>
        <div className="controls">
          <button onClick={triggerError} data-pw-trigger-error>Trigger Server Error Response</button>
        </div>
        <div className="state">
          <div data-pw-error-loading>Loading: {String(errorReply.isLoading)}</div>
          <div data-pw-error-data>Data: {JSON.stringify(errorReply.data)}</div>
        </div>
      </div>

      {/* Cancellation Test */}
      <div className="section">
        <h3>Cancellation Test</h3>
        <div className="controls">
          <button onClick={() => startSlowEvent(2000)} data-pw-start-slow>Start Slow (2s)</button>
          <button onClick={cancelSlowEvent} data-pw-cancel-slow>Cancel</button>
        </div>
        <div className="state">
          <div data-pw-slow-loading>Loading: {String(slowReply.isLoading)}</div>
          <div data-pw-slow-data>Data: {JSON.stringify(slowReply.data)}</div>
        </div>
      </div>

      {/* No Parameters Test */}
      <div className="section">
        <h3>No Parameters Test</h3>
        <div className="controls">
          <button onClick={ping} data-pw-ping>Ping</button>
        </div>
        <div className="state">
          <div data-pw-ping-loading>Loading: {String(pingReply.isLoading)}</div>
          <div data-pw-ping-data>Data: {JSON.stringify(pingReply.data)}</div>
        </div>
      </div>

      {/* Data Types Test */}
      <div className="section">
        <h3>Data Types Test</h3>
        <div className="controls">
          <button onClick={() => testDataType("string")} data-pw-test-string>String</button>
          <button onClick={() => testDataType("number")} data-pw-test-number>Number</button>
          <button onClick={() => testDataType("boolean")} data-pw-test-boolean>Boolean</button>
          <button onClick={() => testDataType("array")} data-pw-test-array>Array</button>
          <button onClick={() => testDataType("object")} data-pw-test-object>Object</button>
          <button onClick={() => testDataType("null")} data-pw-test-null>Null</button>
        </div>
        <div className="state">
          <div data-pw-datatype-loading>Loading: {String(dataTypeReply.isLoading)}</div>
          <div data-pw-datatype-data>Data: {JSON.stringify(dataTypeReply.data)}</div>
        </div>
      </div>

      {/* Input Validation Test */}
      <div className="section">
        <h3>Input Validation Test</h3>
        <div className="controls">
          <button onClick={validateShortInput} data-pw-validate-short>Short Input</button>
          <button onClick={validateValidInput} data-pw-validate-valid>Valid Input</button>
          <button onClick={validateLongInput} data-pw-validate-long>Long Input</button>
        </div>
        <div className="state">
          <div data-pw-validate-loading>Loading: {String(validateReply.isLoading)}</div>
          <div data-pw-validate-data>Data: {JSON.stringify(validateReply.data)}</div>
        </div>
      </div>

      {/* Concurrent Execution Test */}
      <div className="section">
        <h3>Concurrent Execution Test</h3>
        <div className="controls">
          <button onClick={() => startSlowEvent(1000)} data-pw-concurrent-first>Start First</button>
          <button onClick={() => startSlowEvent(500)} data-pw-concurrent-second>Try Second (Should Fail)</button>
        </div>
      </div>
    </div>
  )
}
