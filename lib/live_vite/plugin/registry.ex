defmodule LiveVite.Plugin.Registry do
  @moduledoc """
  Plugin registry for LiveVite.

  Reads registered plugins from application config and provides lookup
  functions for component auto-discovery and framework detection.

  ## Configuration

      config :live_vite, :plugins, [
        LiveVite.Plugin.Vue,
        LiveVite.Plugin.React
      ]
  """

  @default_plugins [LiveVite.Plugin.Vue, LiveVite.Plugin.React]

  @doc "Returns all registered plugin modules."
  def plugins do
    Application.get_env(:live_vite, :plugins, @default_plugins)
  end

  @doc "Returns plugins that implement `file_extensions/0` (renderer plugins)."
  def renderer_plugins do
    Enum.filter(plugins(), fn mod ->
      Code.ensure_loaded!(mod)
      function_exported?(mod, :file_extensions, 0)
    end)
  end

  @doc "Returns a map of file extension to framework atom."
  def extension_to_framework_map do
    for plugin <- renderer_plugins(),
        ext <- plugin.file_extensions(),
        into: %{} do
      {ext, plugin.name()}
    end
  end

  @doc "Returns the framework atom for a file extension, or nil."
  def extension_to_framework(ext) do
    Map.get(extension_to_framework_map(), ext)
  end

  @doc "Returns the list of file extensions for a given framework."
  def framework_extensions(framework) do
    case Enum.find(renderer_plugins(), fn p -> p.name() == framework end) do
      nil -> []
      plugin -> plugin.file_extensions()
    end
  end

  @doc "Returns all file extensions across all renderer plugins."
  def all_extensions do
    Enum.flat_map(renderer_plugins(), & &1.file_extensions())
  end

  @doc "Returns the render function atom for a framework."
  def render_fn(framework) do
    case Enum.find(renderer_plugins(), fn p -> p.name() == framework end) do
      nil -> nil
      plugin -> plugin.render_fn()
    end
  end

  @doc """
  Detects the framework for a component by scanning directories for matching files.

  Returns the framework atom (e.g. `:vue`, `:react`) or the given default.
  """
  def detect_framework(component_name, roots, default \\ :vue) do
    Enum.find_value(roots, default, fn root ->
      Enum.find_value(renderer_plugins(), fn plugin ->
        Enum.find_value(plugin.file_extensions(), fn ext ->
          pattern = Path.join(root, "**/" <> component_name <> ext)
          if Path.wildcard(pattern) != [], do: plugin.name()
        end)
      end)
    end)
  end
end
