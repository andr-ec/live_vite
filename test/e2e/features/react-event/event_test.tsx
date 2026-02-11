import { useState } from "react"
import { useLive, useLiveEventReact } from "live_vite"

interface NotificationEvent {
  message: string
  timestamp: number
}

interface CustomEvent {
  data: string
  count: number
}

export default function EventTest({ message, event_count }: { message: string; event_count: number }) {
  const live = useLive()
  const [messageInput, setMessageInput] = useState("")
  const [customDataInput, setCustomDataInput] = useState("")
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([])
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([])

  useLiveEventReact<NotificationEvent>("notification", data => {
    setNotificationEvents(prev => [...prev, data])
  })

  useLiveEventReact<CustomEvent>("custom_event", data => {
    setCustomEvents(prev => [...prev, data])
  })

  const sendNotification = () => {
    if (messageInput.trim()) {
      live.pushEvent("send_notification", { message: messageInput })
      setMessageInput("")
    }
  }

  const sendCustomEvent = () => {
    if (customDataInput.trim()) {
      live.pushEvent("send_custom_event", { data: customDataInput })
      setCustomDataInput("")
    }
  }

  return (
    <div>
      <h1>Event Test</h1>

      <div>
        <label htmlFor="message-input">Message:</label>
        <input
          id="message-input"
          type="text"
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
        />
        <button id="send-notification-btn" onClick={sendNotification}>
          Send Notification
        </button>
      </div>

      <div>
        <label htmlFor="custom-data-input">Custom Data:</label>
        <input
          id="custom-data-input"
          type="text"
          value={customDataInput}
          onChange={e => setCustomDataInput(e.target.value)}
        />
        <button id="send-custom-btn" onClick={sendCustomEvent}>
          Send Custom Event
        </button>
      </div>

      <div id="received-events">
        <h3>Received Events:</h3>
        <div id="notification-events">
          <strong>Notifications:</strong>
          <ul>
            {notificationEvents.map((event, index) => (
              <li key={index} className="notification-event">
                {event.message} ({event.timestamp})
              </li>
            ))}
          </ul>
        </div>
        <div id="custom-events">
          <strong>Custom Events:</strong>
          <ul>
            {customEvents.map((event, index) => (
              <li key={index} className="custom-event">
                {event.data} (count: {event.count})
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div id="event-counters">
        <div id="notification-count">Notification Count: {notificationEvents.length}</div>
        <div id="custom-count">Custom Event Count: {customEvents.length}</div>
      </div>
    </div>
  )
}
