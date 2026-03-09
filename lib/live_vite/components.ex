defmodule LiveVite.Components do
  @moduledoc """
  Macros to generate component helper functions for rendering framework components.

  Discovers component files in the given root directories and generates a function for each
  component name. The framework is detected from the file extension via the plugin registry.

  ## Examples

  ```elixir
  # Discovers .vue, .tsx, and .jsx files in the given directories
  use LiveVite.Components, component_root: ["./assets/vue", "./lib/my_app_web"]

  # Legacy option (equivalent to component_root for Vue-only discovery)
  use LiveVite.Components, vue_root: ["./assets/vue"]
  ```

  ## Plugin Configuration

  Plugins register their file extensions. See `LiveVite.Plugin` for details.

  ```elixir
  # config/config.exs
  config :live_vite, :plugins, [
    LiveVite.Plugin.Vue,
    LiveVite.Plugin.React
  ]
  ```
  """

  alias LiveVite.Plugin.Registry

  @doc """
  Generates functions local to your current module that can be used to render framework components.

  ## Options

    * `:component_root` - List of directories to search for components (default: `["./assets/vue"]`)
    * `:vue_root` - Legacy alias for `:component_root` (deprecated, prefer `:component_root`)

  ## Examples

  ```elixir
  use LiveVite.Components, component_root: ["./assets/vue", "./lib/my_app_web"]
  ```
  """
  defmacro __using__(opts) do
    roots =
      Keyword.get(opts, :component_root) ||
        Keyword.get(opts, :vue_root, ["./assets/vue"])

    roots = List.wrap(roots)
    extension_map = Registry.extension_to_framework_map()

    Enum.flat_map(roots, fn root ->
      if String.contains?(root, "*"),
        do:
          raise("""
          Glob pattern is not supported in :component_root, please specify a list of directories.

          Example:

          use LiveVite.Components, component_root: ["./assets/vue", "./lib/my_app_web"]
          """)

      discover_components(root, extension_map)
    end)
    |> Enum.uniq_by(fn {name, _framework} -> name end)
    |> Enum.map(fn {name, framework} -> name_to_function(name, framework) end)
  end

  # Discovers component files in the given root directory.
  # Returns a list of `{component_name, framework}` tuples.
  defp discover_components(root, extension_map) do
    extension_map
    |> Enum.flat_map(fn {ext, framework} ->
      root
      |> Path.join("**/*#{ext}")
      |> Path.wildcard()
      |> Enum.map(fn path ->
        name = Path.basename(path, ext)
        {name, framework}
      end)
    end)
  end

  defp name_to_function(name, framework) do
    render_fn = Registry.render_fn(framework) || :vue

    quote do
      def unquote(:"#{name}")(assigns) do
        assigns
        |> Map.put(:"v-component", unquote(name))
        |> LiveVite.unquote(render_fn)()
      end
    end
  end
end
