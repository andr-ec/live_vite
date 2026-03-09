defmodule LiveVite.Plugin.RegistryTest do
  use ExUnit.Case, async: true

  alias LiveVite.Plugin.React
  alias LiveVite.Plugin.Registry
  alias LiveVite.Plugin.Vue

  describe "plugins/0" do
    test "returns default plugins" do
      plugins = Registry.plugins()
      assert Vue in plugins
      assert React in plugins
    end
  end

  describe "renderer_plugins/0" do
    test "returns only plugins with file_extensions" do
      renderers = Registry.renderer_plugins()
      assert Vue in renderers
      assert React in renderers
    end
  end

  describe "extension_to_framework_map/0" do
    test "maps extensions to frameworks" do
      map = Registry.extension_to_framework_map()
      assert map[".vue"] == :vue
      assert map[".tsx"] == :react
      assert map[".jsx"] == :react
    end
  end

  describe "extension_to_framework/1" do
    test "returns framework for known extension" do
      assert :vue = Registry.extension_to_framework(".vue")
      assert :react = Registry.extension_to_framework(".tsx")
    end

    test "returns nil for unknown extension" do
      assert nil == Registry.extension_to_framework(".svelte")
    end
  end

  describe "framework_extensions/1" do
    test "returns extensions for vue" do
      assert [".vue"] = Registry.framework_extensions(:vue)
    end

    test "returns extensions for react" do
      assert [".tsx", ".jsx"] = Registry.framework_extensions(:react)
    end

    test "returns empty for unknown framework" do
      assert [] = Registry.framework_extensions(:svelte)
    end
  end

  describe "render_fn/1" do
    test "returns render function for vue" do
      assert :vue = Registry.render_fn(:vue)
    end

    test "returns render function for react" do
      assert :react = Registry.render_fn(:react)
    end

    test "returns nil for unknown framework" do
      assert nil == Registry.render_fn(:svelte)
    end
  end

  describe "all_extensions/0" do
    test "returns all extensions from all renderers" do
      extensions = Registry.all_extensions()
      assert ".vue" in extensions
      assert ".tsx" in extensions
      assert ".jsx" in extensions
    end
  end
end
