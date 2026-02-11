defmodule LiveVite.Components do
  @moduledoc """
  Macros to generate component helper functions for rendering framework components.

  Discovers component files in the given root directories and generates a function for each
  component name. The framework is detected from the file extension:

    * `.vue` files generate helpers that render via `LiveVite.vue/1`
    * `.tsx` and `.jsx` files generate helpers that render via `LiveVite.react/1`

  ## Examples

  ```elixir
  # Discovers .vue, .tsx, and .jsx files in the given directories
  use LiveVite.Components, component_root: ["./assets/vue", "./lib/my_app_web"]

  # Legacy option (equivalent to component_root for Vue-only discovery)
  use LiveVite.Components, vue_root: ["./assets/vue"]
  ```

  ## Framework Configuration

  By default, all frameworks are enabled. Use the `:frameworks` application config
  to control which frameworks are active:

  ```elixir
  # config/config.exs
  config :live_vite, frameworks: [:vue, :react]
  ```
  """

  # Maps file extensions to their framework identifiers and the render function to call.
  @extension_framework %{
    ".vue" => :vue,
    ".tsx" => :react,
    ".jsx" => :react
  }

  @framework_extensions %{
    vue: [".vue"],
    react: [".tsx", ".jsx"]
  }

  @framework_render_fn %{
    vue: :vue,
    react: :react
  }

  @active_frameworks Application.compile_env(:live_vite, :frameworks, [:vue, :react])

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
    active_frameworks = @active_frameworks

    Enum.flat_map(roots, fn root ->
      if String.contains?(root, "*"),
        do:
          raise("""
          Glob pattern is not supported in :component_root, please specify a list of directories.

          Example:

          use LiveVite.Components, component_root: ["./assets/vue", "./lib/my_app_web"]
          """)

      discover_components(root, active_frameworks)
    end)
    |> Enum.uniq_by(fn {name, _framework} -> name end)
    |> Enum.map(fn {name, framework} -> name_to_function(name, framework) end)
  end

  # Discovers component files in the given root directory for the active frameworks.
  # Returns a list of `{component_name, framework}` tuples.
  defp discover_components(root, active_frameworks) do
    extensions = extensions_for_frameworks(active_frameworks)

    extensions
    |> Enum.flat_map(fn ext ->
      root
      |> Path.join("**/*#{ext}")
      |> Path.wildcard()
      |> Enum.map(fn path ->
        name = Path.basename(path, ext)
        framework = Map.fetch!(@extension_framework, ext)
        {name, framework}
      end)
    end)
  end

  defp extensions_for_frameworks(frameworks) do
    Enum.flat_map(frameworks, fn fw -> Map.get(@framework_extensions, fw, []) end)
  end

  defp name_to_function(name, framework) do
    render_fn = Map.fetch!(@framework_render_fn, framework)

    quote do
      def unquote(:"#{name}")(assigns) do
        assigns
        |> Map.put(:"v-component", unquote(name))
        |> LiveVite.unquote(render_fn)()
      end
    end
  end
end
