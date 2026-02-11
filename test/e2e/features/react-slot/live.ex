defmodule LiveVite.E2E.ReactSlotTestLive do
  @moduledoc false
  use Phoenix.LiveView

  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  def render(assigns) do
    ~H"""
    <div>
      <h1>React Non-ASCII Slot Test</h1>

      <LiveVite.react v-component="slot_test" v-socket={@socket} label="Test 1: Polish">
        Zażółć gęślą jaźń
      </LiveVite.react>

      <LiveVite.react v-component="slot_test" v-socket={@socket} label="Test 2: Japanese">
        こんにちは世界
      </LiveVite.react>

      <LiveVite.react v-component="slot_test" v-socket={@socket} label="Test 3: Emoji">
        Hello 🌍 World 🎉 Party 🚀
      </LiveVite.react>

      <LiveVite.react v-component="slot_test" v-socket={@socket} label="Test 4: Mixed">
        Привет мир! 你好世界! مرحبا بالعالم
      </LiveVite.react>

      <LiveVite.react v-component="slot_test" v-socket={@socket} label="Test 5: Special chars">
        Ñoño café résumé naïve
      </LiveVite.react>
    </div>
    """
  end
end
