defmodule LiveVite.E2E.ReactEventLive do
  @moduledoc false
  use Phoenix.LiveView

  def mount(_params, _session, socket) do
    {:ok, assign(socket, message: "", event_count: 0)}
  end

  def handle_event("send_notification", %{"message" => message}, socket) do
    send(self(), {:broadcast_event, "notification", %{message: message, timestamp: :os.system_time(:millisecond)}})
    {:noreply, assign(socket, message: message, event_count: socket.assigns.event_count + 1)}
  end

  def handle_event("send_custom_event", %{"data" => data}, socket) do
    send(self(), {:broadcast_event, "custom_event", %{data: data, count: socket.assigns.event_count + 1}})
    {:noreply, assign(socket, event_count: socket.assigns.event_count + 1)}
  end

  def handle_info({:broadcast_event, event_name, payload}, socket) do
    {:noreply, push_event(socket, event_name, payload)}
  end

  def render(assigns) do
    ~H"""
    <div id="react-event-test">
      <div id="message-display">Message: {@message}</div>
      <div id="event-count">Event Count: {@event_count}</div>
      <LiveVite.react message={@message} event_count={@event_count} v-component="event_test" v-socket={@socket} />
    </div>
    """
  end
end
