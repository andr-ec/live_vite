defmodule LiveVite.Plugin.React do
  @moduledoc "React framework plugin. Handles `.tsx` and `.jsx` component files."
  @behaviour LiveVite.Plugin

  @impl true
  def name, do: :react

  @impl true
  def file_extensions, do: [".tsx", ".jsx"]

  @impl true
  def render_fn, do: :react
end
