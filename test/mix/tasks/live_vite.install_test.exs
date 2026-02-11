defmodule Mix.Tasks.LiveVite.InstallTest do
  use ExUnit.Case, async: true

  import Igniter.Test

  describe "live_vite.install" do
    test "installs successfully with core Vue components" do
      project =
        phx_test_project()
        |> Igniter.create_new_file(
          "AGENTS.md",
          "# My Project Agents\n\nExisting content here. <!-- usage-rules-end -->"
        )
        |> Igniter.compose_task("live_vite.install", [])
        |> apply_igniter!()

      # Verify content contains expected LiveVite patterns
      vue_index = project.rewrite.sources["assets/vue/index.ts"]
      assert vue_index.content =~ "createLiveVite"
      assert vue_index.content =~ "findComponent"

      vue_demo = project.rewrite.sources["assets/vue/VueDemo.vue"]
      assert vue_demo.content =~ "useLiveVite"

      server_js = project.rewrite.sources["assets/js/server.js"]
      assert server_js.content =~ "getRender"

      # Check for LiveVite usage
      web_file = project.rewrite.sources["lib/test_web.ex"]
      assert web_file.content =~ "use LiveVite"
      assert web_file.content =~ "use LiveVite.Components"

      # Check if config.exs was updated
      config_exs = project.rewrite.sources["config/config.exs"]
      assert config_exs.content =~ ~r/\[args: \[\], cd: __DIR__\]/

      # Check if Vite config was updated
      vite_config = project.rewrite.sources["assets/vite.config.mjs"]
      assert vite_config.content =~ "vue()"
      assert vite_config.content =~ "liveVitePlugin()"
      assert vite_config.content =~ "import vue from"
      assert vite_config.content =~ "import liveVitePlugin from"
      assert vite_config.content =~ "manifest: false"
      assert vite_config.content =~ "ssrManifest: false"
      assert vite_config.content =~ "ssr: { noExternal: process.env.NODE_ENV === \"production\" ? true : undefined },"

      # Check if tsconfig.json was updated
      tsconfig = project.rewrite.sources["tsconfig.json"]
      assert tsconfig.content =~ ~s("baseUrl": ".")
      assert tsconfig.content =~ ~s("module": "ESNext")
      assert tsconfig.content =~ ~s("moduleResolution": "bundler")
      assert tsconfig.content =~ ~s("noEmit": true)
      assert tsconfig.content =~ ~s("skipLibCheck": true)

      assert tsconfig.content =~ """
                 "paths": {
                   "*": [ "./deps/*", "node_modules/*" ]
                 },\
             """

      assert tsconfig.content =~ ~s("types": [ "vite/client" ])

      # Check that tsconfig uses correct web folder (not hardcoded my_app_web)
      assert tsconfig.content =~ ~s("./lib/test_web/**/*")

      # Check if mix.exs was updated
      mix_exs = project.rewrite.sources["mix.exs"]
      assert mix_exs.content =~ ~r/build --manifest --emptyOutDir true/

      assert mix_exs.content =~
               ~r/build --ssrManifest --emptyOutDir false --ssr js\/server\.js --outDir \.\.\/priv\/static/

      # Check for vue_demo route in dev section
      router_file = project.rewrite.sources["lib/test_web/router.ex"]
      assert router_file.content =~ ~r/live "\/vue_demo", TestWeb.VueDemoLive/

      # Check for LiveVite-specific content
      home_template = project.rewrite.sources["lib/test_web/controllers/page_html/home.html.heex"]
      assert home_template.content =~ ~r/End-to-end reactivity for your LiveVite apps/
      assert home_template.content =~ ~r/VueDemo.vue/
      assert home_template.content =~ ~r/vue_demo.ex/
      assert home_template.content =~ ~s(href={~p"/dev/vue_demo"})

      # Check for LiveView content
      live_view_file = project.rewrite.sources["lib/test_web/live/vue_demo_live.ex"]
      assert live_view_file.content =~ ~r/defmodule TestWeb.VueDemoLive/
      assert live_view_file.content =~ ~r/v-component="VueDemo"/
      assert live_view_file.content =~ ~r/handle_event\(\"add_todo\"/

      # Check that SSR production setup was applied
      app_file = project.rewrite.sources["lib/test/application.ex"]
      assert app_file.content =~ ~r/NodeJS\.Supervisor/
      assert app_file.content =~ ~r/path: LiveVite\.SSR\.NodeJS\.server_path\(\)/
      assert app_file.content =~ ~r/pool_size: 4/

      # Check that AGENTS.md was updated with usage rules
      agents_md = project.rewrite.sources["AGENTS.md"]
      assert agents_md.content =~ "# My Project Agents"
      assert agents_md.content =~ "Existing content here."
      assert agents_md.content =~ "<!-- live_vite-start -->"
      assert agents_md.content =~ "<!-- live_vite-end -->"
      assert agents_md.content =~ "# LiveVite Usage Rules"
      assert agents_md.content =~ "Component Organization"
      assert String.ends_with?(agents_md.content, "<!-- live_vite-end -->\n<!-- usage-rules-end -->")
    end

    test "installs successfully with bun flag" do
      project =
        phx_test_project()
        |> Igniter.compose_task("live_vite.install", ["--bun"])
        |> apply_igniter!()

      # Verify bun dependency is added
      mix_exs = project.rewrite.sources["mix.exs"]
      assert mix_exs.content =~ "{:bun,"
    end

    test "installs successfully with --react flag" do
      project =
        phx_test_project()
        |> Igniter.compose_task("live_vite.install", ["--react"])
        |> apply_igniter!()

      # Verify React index.ts exists with correct patterns
      react_index = project.rewrite.sources["assets/react/index.ts"]
      assert react_index.content =~ "createReactRenderer"
      assert react_index.content =~ "getRendererHook"
      assert react_index.content =~ "findComponent"
      assert react_index.content =~ "import.meta.glob"

      # Verify React demo component
      react_demo = project.rewrite.sources["assets/react/ReactDemo.tsx"]
      assert react_demo.content =~ "useLive"
      assert react_demo.content =~ "useLiveFormReact"

      # Verify server.js uses React renderer
      server_js = project.rewrite.sources["assets/js/server.js"]
      assert server_js.content =~ "getRendererRender"
      assert server_js.content =~ "createReactRenderer"
      refute server_js.content =~ "getRender(components"

      # Verify Vite config uses react() plugin, not vue()
      vite_config = project.rewrite.sources["assets/vite.config.mjs"]
      assert vite_config.content =~ "react("
      assert vite_config.content =~ "import react from"
      assert vite_config.content =~ "liveVitePlugin()"
      refute vite_config.content =~ "vue()"
      refute vite_config.content =~ "import vue from"

      # Verify package.json has React deps, not Vue deps
      package_json = project.rewrite.sources["package.json"]
      assert package_json.content =~ ~s("react")
      assert package_json.content =~ ~s("react-dom")
      assert package_json.content =~ ~s("@vitejs/plugin-react")
      assert package_json.content =~ ~s("@types/react")
      assert package_json.content =~ ~s("@types/react-dom")
      refute package_json.content =~ ~s("vue")
      refute package_json.content =~ ~s("@vitejs/plugin-vue")
      refute package_json.content =~ ~s("vue-tsc")
      refute package_json.content =~ ~s("@vueuse/core")

      # Verify web.ex uses component_root (not vue_root)
      web_file = project.rewrite.sources["lib/test_web.ex"]
      assert web_file.content =~ "use LiveVite"
      assert web_file.content =~ "component_root:"
      assert web_file.content =~ ~s("./assets/react")
      refute web_file.content =~ "vue_root:"

      # Verify react_demo route
      router_file = project.rewrite.sources["lib/test_web/router.ex"]
      assert router_file.content =~ ~r/live "\/react_demo", TestWeb.ReactDemoLive/
      refute router_file.content =~ "VueDemoLive"

      # Verify React demo LiveView
      live_view_file = project.rewrite.sources["lib/test_web/live/react_demo_live.ex"]
      assert live_view_file.content =~ ~r/defmodule TestWeb.ReactDemoLive/
      assert live_view_file.content =~ ~r/v-component="ReactDemo"/
      assert live_view_file.content =~ ".react"

      # Verify no Vue artifacts
      refute Map.has_key?(project.rewrite.sources, "assets/vue/index.ts")
      refute Map.has_key?(project.rewrite.sources, "assets/vue/VueDemo.vue")
      refute Map.has_key?(project.rewrite.sources, "lib/test_web/live/vue_demo_live.ex")

      # Verify tsconfig includes react directory, has jsx option
      tsconfig = project.rewrite.sources["tsconfig.json"]
      assert tsconfig.content =~ ~s("./assets/react/**/*")
      assert tsconfig.content =~ ~s("jsx": "react-jsx")
      refute tsconfig.content =~ ~s("./assets/vue/**/*")

      # Verify app.js uses reactHook directly
      app_js = project.rewrite.sources["assets/js/app.js"]
      assert app_js.content =~ ~s(import reactHook from "../react")
      assert app_js.content =~ "VueHook: reactHook"
      refute app_js.content =~ "getHooks"

      # Verify tailwind includes react source
      app_css = project.rewrite.sources["assets/css/app.css"]
      assert app_css.content =~ ~s(@source "../react";)
      refute app_css.content =~ ~s(@source "../vue";)

      # Verify home template references React
      home_template = project.rewrite.sources["lib/test_web/controllers/page_html/home.html.heex"]
      assert home_template.content =~ ~r/ReactDemo.tsx/
      assert home_template.content =~ ~s(href={~p"/dev/react_demo"})
    end

    test "installs successfully with --react --vue flags" do
      project =
        phx_test_project()
        |> Igniter.compose_task("live_vite.install", ["--react", "--vue"])
        |> apply_igniter!()

      # Verify Vue index.ts uses multi-renderer hook
      vue_index = project.rewrite.sources["assets/vue/index.ts"]
      assert vue_index.content =~ "getMultiRendererHook"
      assert vue_index.content =~ "createVueRenderer"
      assert vue_index.content =~ "createReactRenderer"
      assert vue_index.content =~ "findComponent"

      # Verify React index.ts is a marker file
      react_index = project.rewrite.sources["assets/react/index.ts"]
      assert react_index.content =~ "export {}"

      # Verify both demo components exist
      vue_demo = project.rewrite.sources["assets/vue/VueDemo.vue"]
      assert vue_demo.content =~ "useLiveVite"

      react_demo = project.rewrite.sources["assets/react/ReactDemo.tsx"]
      assert react_demo.content =~ "useLive"

      # Verify server.js uses multi-renderer
      server_js = project.rewrite.sources["assets/js/server.js"]
      assert server_js.content =~ "getMultiRendererRender"
      assert server_js.content =~ "createVueRenderer"
      assert server_js.content =~ "createReactRenderer"

      # Verify Vite config has both plugins
      vite_config = project.rewrite.sources["assets/vite.config.mjs"]
      assert vite_config.content =~ "vue()"
      assert vite_config.content =~ "react("
      assert vite_config.content =~ "import vue from"
      assert vite_config.content =~ "import react from"

      # Verify package.json has both framework deps
      package_json = project.rewrite.sources["package.json"]
      assert package_json.content =~ ~s("vue")
      assert package_json.content =~ ~s("react")
      assert package_json.content =~ ~s("react-dom")
      assert package_json.content =~ ~s("@vitejs/plugin-vue")
      assert package_json.content =~ ~s("@vitejs/plugin-react")

      # Verify web.ex uses component_root with both directories
      web_file = project.rewrite.sources["lib/test_web.ex"]
      assert web_file.content =~ "component_root:"
      assert web_file.content =~ ~s("./assets/vue")
      assert web_file.content =~ ~s("./assets/react")

      # Verify both demo routes
      router_file = project.rewrite.sources["lib/test_web/router.ex"]
      assert router_file.content =~ ~r/live "\/vue_demo", TestWeb.VueDemoLive/
      assert router_file.content =~ ~r/live "\/react_demo", TestWeb.ReactDemoLive/

      # Verify both LiveViews
      assert Map.has_key?(project.rewrite.sources, "lib/test_web/live/vue_demo_live.ex")
      assert Map.has_key?(project.rewrite.sources, "lib/test_web/live/react_demo_live.ex")

      # Verify tsconfig includes both directories and jsx
      tsconfig = project.rewrite.sources["tsconfig.json"]
      assert tsconfig.content =~ ~s("./assets/vue/**/*")
      assert tsconfig.content =~ ~s("./assets/react/**/*")
      assert tsconfig.content =~ ~s("jsx": "react-jsx")

      # Verify app.js uses multiHook
      app_js = project.rewrite.sources["assets/js/app.js"]
      assert app_js.content =~ ~s(import multiHook from "../vue")
      assert app_js.content =~ "VueHook: multiHook"

      # Verify tailwind includes both sources
      app_css = project.rewrite.sources["assets/css/app.css"]
      assert app_css.content =~ ~s(@source "../vue";)
      assert app_css.content =~ ~s(@source "../react";)
    end
  end
end
