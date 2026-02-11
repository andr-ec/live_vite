defmodule LiveVite.E2E.MixedFrameworkLive do
  @moduledoc false
  use Phoenix.LiveView

  def mount(_params, _session, socket) do
    {:ok, assign(socket, :counter, 0)}
  end

  def handle_event("increment", %{"value" => value}, socket) do
    {:noreply, assign(socket, :counter, socket.assigns.counter + value)}
  end

  def render(assigns) do
    ~H"""
    <div id="mixed-test">
      <div id="vue-section">
        <LiveVite.vue count={@counter} v-component="mixed_counter" v-socket={@socket} />
      </div>
      <div id="react-section">
        <LiveVite.react count={@counter} v-component="mixed_counter" v-socket={@socket} />
      </div>
    </div>
    """
  end
end
