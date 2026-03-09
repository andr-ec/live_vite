defmodule LiveVite.Plugin do
  @moduledoc """
  Behaviour for LiveVite plugins.

  Renderer plugins (Vue, React) declare file extensions and render functions
  for component auto-discovery and dispatch. Content plugins (Markdown) may
  omit these and provide their own component functions instead.

  ## Example

      defmodule MyApp.SveltePlugin do
        @behaviour LiveVite.Plugin

        def name, do: :svelte
        def file_extensions, do: [".svelte"]
        def render_fn, do: :vue  # uses the generic renderer
      end

  Register plugins in your config:

      config :live_vite, :plugins, [
        LiveVite.Plugin.Vue,
        LiveVite.Plugin.React,
        MyApp.SveltePlugin
      ]
  """

  @doc "Plugin identifier atom."
  @callback name() :: atom()

  @doc "File extensions this plugin handles for auto-discovery (e.g. `[\".vue\"]`)."
  @callback file_extensions() :: [String.t()]

  @doc "Render function atom to dispatch to (e.g. `:vue`, `:react`)."
  @callback render_fn() :: atom()

  @optional_callbacks [file_extensions: 0, render_fn: 0]
end
