defmodule LiveVite.Plugin.Vue do
  @moduledoc "Vue framework plugin. Handles `.vue` component files."
  @behaviour LiveVite.Plugin

  @impl true
  def name, do: :vue

  @impl true
  def file_extensions, do: [".vue"]

  @impl true
  def render_fn, do: :vue
end
