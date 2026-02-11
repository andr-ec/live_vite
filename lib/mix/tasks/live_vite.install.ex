defmodule Mix.Tasks.LiveVite.Install do
  @moduledoc """
  Installer for LiveVite with Vite.

  This task first installs Vite using the PhoenixVite installer,
  then configures the project for LiveVite.

  ## Options

    * `--bun` - Use Bun instead of Node.js/npm
    * `--react` - Install React support (instead of Vue)
    * `--vue` - Install Vue support (default if no framework flag given)

  When both `--react` and `--vue` are given, both frameworks are installed
  with a multi-renderer hook.

  ## Examples

      mix live_vite.install
      mix live_vite.install --react
      mix live_vite.install --react --vue
      mix live_vite.install --bun

  """

  import Mix.Tasks.PhoenixVite.Install.Helper

  @usage_rules_content File.read!(Path.join([__DIR__, "../../../usage-rules.md"]))
  with_igniter do
    use Igniter.Mix.Task

    alias Igniter.Libs.Phoenix
    alias Igniter.Project.Config

    @impl Igniter.Mix.Task
    def info(_argv, _parent) do
      %Igniter.Mix.Task.Info{
        composes: ["phoenix_vite.install"],
        schema: [bun: :boolean, react: :boolean, vue: :boolean],
        aliases: [b: :bun]
      }
    end

    @impl Igniter.Mix.Task
    def igniter(igniter) do
      app_name = Igniter.Project.Application.app_name(igniter)
      frameworks = frameworks(igniter)

      igniter
      |> Igniter.compose_task("phoenix_vite.install", igniter.args.argv)
      |> configure_environments(app_name)
      |> add_live_vite_to_html_helpers(app_name, frameworks)
      |> update_javascript_configuration(frameworks)
      |> update_vite_configuration(frameworks)
      |> update_phoenix_vite_config()
      |> configure_tailwind(frameworks)
      |> update_package_json(frameworks)
      |> create_framework_files(frameworks)
      |> setup_ssr_for_production(app_name)
      |> update_mix_aliases()
      |> add_demo_routes(frameworks)
      |> update_home_template(frameworks)
      |> update_gitignore()
      |> append_usage_rules_to_agents_md()
    end

    # Determine which frameworks to install based on flags
    defp frameworks(igniter) do
      opts = igniter.args.options
      react? = Keyword.get(opts, :react, false)
      vue? = Keyword.get(opts, :vue, false)

      cond do
        react? and vue? -> [:vue, :react]
        react? -> [:react]
        true -> [:vue]
      end
    end

    # Configure environments (config/dev.exs and config/prod.exs)
    defp configure_environments(igniter, _app_name) do
      igniter
      |> Config.configure("config.exs", :live_vite, [:ssr], true)
      |> Config.configure("dev.exs", :live_vite, [:vite_host], "http://localhost:5173")
      |> Config.configure("dev.exs", :live_vite, [:ssr_module], {:code, Sourceror.parse_string!("LiveVite.SSR.ViteJS")})
      |> Config.configure("prod.exs", :live_vite, [:ssr_module], {:code, Sourceror.parse_string!("LiveVite.SSR.NodeJS")})
      |> Config.configure("prod.exs", :live_vite, [:ssr], true)
    end

    # Add LiveVite to html_helpers in lib/app_web.ex
    defp add_live_vite_to_html_helpers(igniter, _app_name, frameworks) do
      web_module = Phoenix.web_module(igniter)
      web_folder = Macro.underscore(web_module)
      web_file = Path.join(["lib", web_folder <> ".ex"])

      components_line = components_use_line(frameworks, web_folder)

      Igniter.update_file(igniter, web_file, fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          # Check if LiveVite is already added to avoid duplicate additions.
          # Use regex to match "use LiveVite" as a standalone module, not as part of
          # another module name (e.g., "use LiveViteWebsiteWeb" should not match).
          if Regex.match?(~r/use LiveVite\b/, content) do
            content
          else
            # Get the short module name (without Elixir. prefix)
            web_module_name = web_module |> Module.split() |> Enum.join(".")

            # Add LiveVite support only in the html_helpers function
            String.replace(
              content,
              ~r/(defp html_helpers do\s+quote do\s+# Translation\s+use Gettext, backend: #{Regex.escape(web_module_name)}\.Gettext)/,
              "\\1\n\n      # Add support for LiveVite components\n      use LiveVite\n\n      #{components_line}"
            )
          end
        end)
      end)
    end

    defp components_use_line(frameworks, web_folder) do
      roots =
        case frameworks do
          [:vue] -> ~s(["./assets/vue", "./lib/#{web_folder}"])
          [:react] -> ~s(["./assets/react", "./lib/#{web_folder}"])
          [:vue, :react] -> ~s(["./assets/vue", "./assets/react", "./lib/#{web_folder}"])
        end

      comment =
        case frameworks do
          [:vue] -> "# Generate component for each vue file, so you can use <.ComponentName> syntax\n      # instead of <.vue v-component=\"ComponentName\">"
          [:react] -> "# Generate component for each React file, so you can use <.ComponentName> syntax\n      # instead of <.react v-component=\"ComponentName\">"
          [:vue, :react] -> "# Generate component for each Vue/React file, so you can use <.ComponentName> syntax\n      # instead of <.vue v-component=\"ComponentName\"> or <.react v-component=\"ComponentName\">"
        end

      opt_name =
        case frameworks do
          [:vue] -> "vue_root"
          _ -> "component_root"
        end

      "#{comment}\n      use LiveVite.Components, #{opt_name}: #{roots}"
    end

    # Update JavaScript configuration (app.js)
    defp update_javascript_configuration(igniter, frameworks) do
      Igniter.update_file(igniter, "assets/js/app.js", fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          content
          |> add_live_vite_imports(frameworks)
          |> update_live_socket_hooks(frameworks)
        end)
      end)
    end

    defp add_live_vite_imports(content, frameworks) do
      if String.contains?(content, "live_vite") do
        content
      else
        import_lines =
          case frameworks do
            [:vue] ->
              ~s(import {getHooks} from "live_vite"\nimport liveViteApp from "../vue")

            [:react] ->
              ~s(import reactHook from "../react")

            [:vue, :react] ->
              ~s(import multiHook from "../vue")
          end

        String.replace(
          content,
          "import topbar from \"topbar\"",
          ~s(import topbar from "topbar"\n#{import_lines})
        )
      end
    end

    defp update_live_socket_hooks(content, frameworks) do
      hook_value =
        case frameworks do
          [:vue] -> "...getHooks(liveViteApp)"
          [:react] -> "VueHook: reactHook"
          [:vue, :react] -> "VueHook: multiHook"
        end

      String.replace(
        content,
        "hooks: {...colocatedHooks},",
        "hooks: {...colocatedHooks, #{hook_value}},"
      )
    end

    defp update_phoenix_vite_config(igniter) do
      Config.configure(
        igniter,
        "config.exs",
        :phoenix_vite,
        [PhoenixVite.Npm, :assets],
        {:code, Sourceror.parse_string!(~s|[args: [], cd: __DIR__]|)}
      )
    end

    # Update Vite configuration
    defp update_vite_configuration(igniter, frameworks) do
      Igniter.update_file(igniter, "assets/vite.config.mjs", fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          content
          |> add_vite_imports(frameworks)
          |> update_vite_server_config()
          |> update_vite_optimized_deps()
          |> update_vite_plugins(frameworks)
          |> update_vite_manifest()
          |> add_ssr_vite_entry()
        end)
      end)
    end

    defp add_vite_imports(content, frameworks) do
      if String.contains?(content, "liveVitePlugin") do
        content
      else
        import_lines =
          case frameworks do
            [:vue] ->
              ~s(import vue from "@vitejs/plugin-vue";\nimport liveVitePlugin from "live_vite/vitePlugin";)

            [:react] ->
              ~s(import react from "@vitejs/plugin-react";\nimport liveVitePlugin from "live_vite/vitePlugin";)

            [:vue, :react] ->
              ~s(import vue from "@vitejs/plugin-vue";\nimport react from "@vitejs/plugin-react";\nimport liveVitePlugin from "live_vite/vitePlugin";)
          end

        String.replace(
          content,
          "import { phoenixVitePlugin } from 'phoenix_vite'",
          import_lines
        )
      end
    end

    defp update_vite_server_config(content) do
      if String.contains?(content, "host: \"127.0.0.1\"") do
        content
      else
        String.replace(
          content,
          "port: 5173,",
          "host: \"127.0.0.1\",\n    port: 5173,"
        )
      end
    end

    defp update_vite_optimized_deps(content) do
      String.replace(
        content,
        ~s(include: ["phoenix", "phoenix_html", "phoenix_live_view"],),
        ~s(include: ["live_vite", "phoenix", "phoenix_html", "phoenix_live_view"],)
      )
    end

    defp update_vite_plugins(content, frameworks) do
      plugin_lines =
        case frameworks do
          [:vue] -> "vue(),\n    liveVitePlugin()"
          [:react] -> "react({ include: /\\.(tsx|jsx)$/ }),\n    liveVitePlugin()"
          [:vue, :react] -> "vue(),\n    react({ include: /\\.(tsx|jsx)$/ }),\n    liveVitePlugin()"
        end

      # Replace the phoenixVitePlugin call with the framework plugins
      String.replace(
        content,
        ~r/phoenixVitePlugin\(\{\s*pattern: \/\\.\(ex\|heex\)\$\/\s*\}\)/s,
        plugin_lines
      )
    end

    defp update_vite_manifest(content) do
      if String.contains?(content, "manifest: false") do
        content
      else
        String.replace(
          content,
          ~r/manifest: true,/s,
          "manifest: false,\n    ssrManifest: false,"
        )
      end
    end

    defp add_ssr_vite_entry(content) do
      if String.contains?(content, "noExternal") do
        content
      else
        String.replace(
          content,
          ~r/build: {/s,
          "ssr: { noExternal: process.env.NODE_ENV === \"production\" ? true : undefined },\n    build: {"
        )
      end
    end

    # Configure Tailwind to include framework files
    defp configure_tailwind(igniter, frameworks) do
      Igniter.update_file(igniter, "assets/css/app.css", fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          sources =
            case frameworks do
              [:vue] -> [~s(@source "../vue";)]
              [:react] -> [~s(@source "../react";)]
              [:vue, :react] -> [~s(@source "../vue";), ~s(@source "../react";)]
            end

          Enum.reduce(sources, content, fn source_line, acc ->
            if String.contains?(acc, source_line) do
              acc
            else
              String.replace(acc, "@source \"../js\";", "@source \"../js\";\n#{source_line}")
            end
          end)
        end)
      end)
    end

    # Update package.json with framework dependencies
    defp update_package_json(igniter, frameworks) do
      vue? = :vue in frameworks
      react? = :react in frameworks

      deps =
        [
          vue? && {~s("@vueuse/core"), ~s("^13.7.0")},
          true && {~s("live_vite"), ~s("file:./deps/live_vite")},
          true && {~s("phoenix"), ~s("file:./deps/phoenix")},
          true && {~s("phoenix_html"), ~s("file:./deps/phoenix_html")},
          true && {~s("phoenix_live_view"), ~s("file:./deps/phoenix_live_view")},
          react? && {~s("react"), ~s("^19.0.0")},
          react? && {~s("react-dom"), ~s("^19.0.0")},
          true && {~s("topbar"), ~s("^3.0.0")},
          vue? && {~s("vue"), ~s("^3.4.21")}
        ]
        |> Enum.filter(& &1)
        |> Enum.map(fn {k, v} -> "    #{k}: #{v}" end)
        |> Enum.join(",\n")

      dev_deps =
        [
          true && {~s("@tailwindcss/vite"), ~s("^4.1.0")},
          react? && {~s("@types/react"), ~s("^19.0.0")},
          react? && {~s("@types/react-dom"), ~s("^19.0.0")},
          react? && {~s("@vitejs/plugin-react"), ~s("^4.3.0")},
          vue? && {~s("@vitejs/plugin-vue"), ~s("^5.0.4")},
          true && {~s("daisyui"), ~s("^5.0.0")},
          true && {~s("phoenix_vite"), ~s("file:./deps/phoenix_vite")},
          true && {~s("tailwindcss"), ~s("^4.1.0")},
          true && {~s("typescript"), ~s("^5.4.5")},
          true && {~s("vite"), ~s("^6.3.0")},
          vue? && {~s("vue-tsc"), ~s("^2.0.13")}
        ]
        |> Enum.filter(& &1)
        |> Enum.map(fn {k, v} -> "    #{k}: #{v}" end)
        |> Enum.join(",\n")

      igniter
      |> Igniter.move_file("assets/package.json", "package.json")
      |> Igniter.update_file("package.json", fn source ->
        Rewrite.Source.update(source, :content, fn _ ->
          """
          {
            "dependencies": {
          #{deps}
            },
            "devDependencies": {
          #{dev_deps}
            }
          }
          """
        end)
      end)
    end

    # Create framework files from templates
    defp create_framework_files(igniter, frameworks) do
      web_module = Phoenix.web_module(igniter)
      web_folder = Macro.underscore(web_module)

      igniter =
        igniter
        |> Igniter.compose_task("igniter.add_extension", ["phoenix"])
        |> Igniter.mkdir("lib/#{web_folder}/live")

      igniter =
        if :vue in frameworks do
          igniter
          |> Igniter.mkdir("assets/vue")
          |> Igniter.create_new_file("assets/vue/VueDemo.vue", demo_vue_content())
          |> Igniter.create_new_file(
            "assets/vue/.gitignore",
            "# Ignore automatically generated Vue files by the ~V sigil\n_build/"
          )
          |> Igniter.create_new_file("lib/#{web_folder}/live/vue_demo_live.ex", vue_demo_live_view_content(igniter))
        else
          igniter
        end

      igniter =
        if :react in frameworks do
          igniter
          |> Igniter.mkdir("assets/react")
          |> Igniter.create_new_file("assets/react/ReactDemo.tsx", demo_react_content())
          |> Igniter.create_new_file("lib/#{web_folder}/live/react_demo_live.ex", react_demo_live_view_content(igniter))
        else
          igniter
        end

      # Create index.ts and server.js based on framework combination
      igniter =
        case frameworks do
          [:vue] ->
            igniter
            |> Igniter.create_new_file("assets/vue/index.ts", vue_index_content())
            |> Igniter.create_new_file("assets/js/server.js", vue_server_js_content())

          [:react] ->
            igniter
            |> Igniter.create_new_file("assets/react/index.ts", react_index_content())
            |> Igniter.create_new_file("assets/js/server.js", react_server_js_content())

          [:vue, :react] ->
            igniter
            |> Igniter.create_new_file("assets/vue/index.ts", multi_vue_index_content())
            |> Igniter.create_new_file("assets/react/index.ts", multi_react_index_content())
            |> Igniter.create_new_file("assets/js/server.js", multi_server_js_content())
        end

      update_tsconfig(igniter, frameworks)
    end

    defp update_tsconfig(igniter, frameworks) do
      web_module = Phoenix.web_module(igniter)
      web_folder = Macro.underscore(web_module)

      includes =
        [
          ~s("./assets/js/**/*"),
          if(:vue in frameworks, do: ~s("./assets/vue/**/*")),
          if(:react in frameworks, do: ~s("./assets/react/**/*")),
          ~s("./lib/#{web_folder}/**/*")
        ]
        |> Enum.filter(& &1)
        |> Enum.join(",\n      ")

      jsx_options =
        if :react in frameworks do
          ~s(,\n      "jsx": "react-jsx")
        else
          ""
        end

      igniter
      |> Igniter.rm("assets/tsconfig.json")
      |> Igniter.create_new_file("tsconfig.json", """
      {
        "compilerOptions": {
          "allowJs": true,
          "baseUrl": ".",
          "lib": ["ES2015", "DOM"],
          "module": "ESNext",
          "moduleResolution": "bundler",
          "noEmit": true,
          "skipLibCheck": true,
          "paths": {
            "*": [ "./deps/*", "node_modules/*" ]
          },
          "strict": true,
          "types": [ "vite/client" ]#{jsx_options}
        },
        "include": [
          #{includes}
        ],
        "exclude": [
          "node_modules"
        ]
      }
      """)
    end

    # Setup SSR for production in application.ex
    defp setup_ssr_for_production(igniter, _app_name) do
      app_module = igniter |> Igniter.Project.Application.app_name() |> to_string()
      app_file = "lib/#{Macro.underscore(app_module)}/application.ex"

      # Use simple file update instead of complex AST manipulation
      Igniter.update_file(igniter, app_file, fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          # Look for the children list and add NodeJS.Supervisor right after the opening bracket
          if String.contains?(content, "children = [") and not String.contains?(content, "NodeJS.Supervisor") do
            String.replace(
              content,
              ~r/(children = \[\s*\n)/,
              "\\1      {NodeJS.Supervisor, [path: LiveVite.SSR.NodeJS.server_path(), pool_size: 4]},\n"
            )
          else
            content
          end
        end)
      end)
    end

    # ── Vue-only index.ts (default, backward compatible) ──

    defp vue_index_content do
      """
      import { h, type Component } from "vue"
      import { createLiveVite, findComponent, type LiveHook, type ComponentMap } from "live_vite"

      // needed to make $live available in the Vue component
      declare module "vue" {
        interface ComponentCustomProperties {
          $live: LiveHook
        }
      }

      export default createLiveVite({
        // name will be passed as-is in v-component of the .vue HEEX component
        resolve: name => {
          // we're importing from ../../lib to allow collocating Vue files with LiveView files
          // eager: true disables lazy loading - all these components will be part of the app.js bundle
          // more: https://vite.dev/guide/features.html#glob-import
          const components = {
            ...import.meta.glob("./**/*.vue", { eager: true }),
            ...import.meta.glob("../../lib/**/*.vue", { eager: true }),
          } as ComponentMap

          // finds component by name or path suffix and gives a nice error message.
          // `path/to/component/index.vue` can be found as `path/to/component` or simply `component`
          // `path/to/Component.vue` can be found as `path/to/Component` or simply `Component`
          return findComponent(components as ComponentMap, name)
        },
        // it's a default implementation of creating and mounting vue app, you can easily extend it to add your own plugins, directives etc.
        setup: ({ createApp, component, props, slots, plugin, el }) => {
          const app = createApp({ render: () => h(component as Component, props, slots) })
          app.use(plugin)
          // add your own plugins here
          // app.use(pinia)
          app.mount(el)
          return app
        },
      })
      """
    end

    # ── React-only index.ts ──

    defp react_index_content do
      """
      import { createReactRenderer, getRendererHook, findComponent, type ComponentMap } from "live_vite"

      const renderer = createReactRenderer()

      const resolve = (name: string) => {
        const components = {
          ...import.meta.glob("./**/*.tsx", { eager: true }),
          ...import.meta.glob("../../lib/**/*.tsx", { eager: true }),
        } as ComponentMap

        const mod = findComponent(components, name)
        return mod && (mod as any).default ? (mod as any).default : mod
      }

      export default getRendererHook({ renderer, resolve })
      """
    end

    # ── Multi-framework: vue/index.ts exports the multi-renderer hook ──

    defp multi_vue_index_content do
      """
      import { h, type Component } from "vue"
      import { createVueRenderer, createReactRenderer, getMultiRendererHook, findComponent, type LiveHook, type ComponentMap } from "live_vite"

      // needed to make $live available in the Vue component
      declare module "vue" {
        interface ComponentCustomProperties {
          $live: LiveHook
        }
      }

      // Vue renderer
      const vueRenderer = createVueRenderer({
        setup: (createApp, component, props, slots, plugin, el) => {
          const app = createApp({ render: () => h(component as Component, props, slots) })
          app.use(plugin)
          app.mount(el)
          return app
        },
      })

      const vueComponents = {
        ...import.meta.glob("./**/*.vue", { eager: true }),
        ...import.meta.glob("../../lib/**/*.vue", { eager: true }),
      } as ComponentMap

      // React renderer
      const reactRenderer = createReactRenderer()

      const reactComponents = {
        ...import.meta.glob("../react/**/*.tsx", { eager: true }),
        ...import.meta.glob("../../lib/**/*.tsx", { eager: true }),
      } as ComponentMap

      // Multi-renderer hook dispatches based on data-framework attribute
      export default getMultiRendererHook({
        vue: {
          renderer: vueRenderer,
          resolve: name => {
            const mod = findComponent(vueComponents, name)
            return mod && (mod as any).default ? (mod as any).default : mod
          },
        },
        react: {
          renderer: reactRenderer,
          resolve: name => {
            const mod = findComponent(reactComponents, name)
            return mod && (mod as any).default ? (mod as any).default : mod
          },
        },
      })
      """
    end

    # ── Multi-framework: react/index.ts is just a marker for the react directory ──

    defp multi_react_index_content do
      """
      // React components are discovered from ../vue/index.ts via the multi-renderer hook.
      // Place your React components (.tsx) in this directory.
      export {}
      """
    end

    # ── Vue demo content (unchanged) ──

    defp vue_demo_live_view_content(igniter) do
      web_module_name = Phoenix.web_module(igniter)

      """
      defmodule #{inspect(web_module_name)}.VueDemoLive do
        use #{inspect(web_module_name)}, :live_view

        @impl true
        def render(assigns) do
          ~H\"\"\"
          <Layouts.app flash={@flash}>
            <.vue
              todos={@todos}
              form={@form}
              v-component="VueDemo"
              v-socket={@socket}
            />
          </Layouts.app>
          \"\"\"
        end

        @impl true
        def mount(_params, _session, socket) do
          socket =
            socket
            |> assign(:todos, [
              %{id: 1, text: "Learn LiveVite basics", completed: true},
              %{id: 2, text: "Build an interactive component", completed: false},
              %{id: 3, text: "Deploy to production", completed: false}
            ])
            |> assign(:next_id, 4)
            |> assign(:form, add_todo_form(%{text: ""}))

          {:ok, socket}
        end

        @impl true
        def handle_event("validate_todo", %{"todo" => params}, socket) do
          {:noreply, assign(socket, :form, add_todo_form(params))}
        end

        @impl true
        def handle_event("add_todo", %{"todo" => params}, socket) do
          changeset = add_todo_changeset(params, socket.assigns.next_id)

          case Ecto.Changeset.apply_action(changeset, :insert) do
            {:ok, new_todo} ->
              socket =
                socket
                |> assign(:todos, socket.assigns.todos ++ [new_todo])
                |> assign(:next_id, socket.assigns.next_id + 1)
                |> assign(:form, add_todo_form(%{text: ""}))

              {:noreply, socket}

            {:error, changeset} ->
              {:noreply, assign(socket, :form, to_form(changeset, as: :todo))}
          end
        end

        @impl true
        def handle_event("toggle_todo", %{"id" => id}, socket) do
          todos =
            Enum.map(socket.assigns.todos, fn todo ->
              if todo.id == id, do: %{todo | completed: !todo.completed}, else: todo
            end)

          {:noreply, assign(socket, :todos, todos)}
        end

        @impl true
        def handle_event("delete_todo", %{"id" => id}, socket) do
          todos = Enum.reject(socket.assigns.todos, fn todo -> todo.id == id end)
          {:noreply, assign(socket, :todos, todos)}
        end

        @impl true
        def handle_event("clear_completed", _params, socket) do
          todos = Enum.reject(socket.assigns.todos, fn todo -> todo.completed end)
          {:noreply, assign(socket, :todos, todos)}
        end

        defp add_todo_changeset(params, id \\\\ nil) do
          data = %{text: "", id: id, completed: false}
          types = %{text: :string}

          {data, types}
          |> Ecto.Changeset.cast(params, Map.keys(types))
          |> Ecto.Changeset.validate_required([:text])
          |> Ecto.Changeset.validate_length(:text, min: 8, max: 50)
        end

        defp add_todo_form(params) do
          params
          |> add_todo_changeset()
          |> Map.put(:action, :validate)
          |> to_form(as: :todo)
        end
      end
      """
    end

    defp demo_vue_content do
      """
      <script setup lang="ts">
      import { ref, computed } from "vue"
      import { useLiveVite, Form, useLiveForm } from "live_vite"

      type FilterType = "all" | "active" | "completed"

      // Props from LiveView - server state
      const props = defineProps<{
        todos: Array<{ id: number; text: string; completed: boolean }>
        form: Form<{ text: string }>
      }>()

      // Phoenix hook instance responsible for syncing this Vue component
      const live = useLiveVite()

      // Server-side validation using changesets
      const { field, submit, isValid } = useLiveForm<{ text: string }>(() => props.form, {
        submitEvent: "add_todo",
        changeEvent: "validate_todo",
        debounceInMiliseconds: 50,
      })

      const textField = field("text")

      // Local client-side state
      const filter = ref<FilterType>("all")

      const filterByType = (type: FilterType) => {
        switch (type) {
          case "active":
            return props.todos.filter((todo) => !todo.completed)
          case "completed":
            return props.todos.filter((todo) => todo.completed)
          default:
            return props.todos
        }
      }
      // Computed properties for reactive UI
      const filteredTodos = computed(() => filterByType(filter.value))
      const completedCount = computed(() => filterByType("completed").length)
      </script>

      <template>
        <div class="text-center">
          <div class="max-w-2xl space-y-8">
            <!-- Header -->
            <div>
              <h1 class="text-5xl font-bold">🎉 Welcome to LiveVite!</h1>
              <p class="text-lg text-base-content/70">Vue.js components seamlessly integrated with Phoenix LiveView</p>
            </div>

            <!-- Todo Demo Card -->
            <div>
              <!-- Add Todo Form -->
              <form @submit.prevent="submit" class="form-control mb-6">
                <div class="join mb-2">
                  <input
                    v-bind="textField.inputAttrs.value"
                    type="text"
                    placeholder="What needs to be done?"
                    class="input input-bordered join-item flex-1"
                  />
                  <button type="submit" :disabled="!isValid" class="btn btn-primary join-item">Add Todo</button>
                </div>
                <div
                  v-if="(textField.isTouched.value || textField.isDirty.value) && textField.errorMessage.value"
                  class="text-error text-xs"
                >
                  {{ textField.errorMessage }}
                </div>
              </form>

              <!-- Filter Buttons -->
              <div class="join mb-6 mx-auto">
                <button
                  v-for="filterType in ['all', 'active', 'completed'] as FilterType[]"
                  :key="filterType"
                  @click="filter = filterType"
                  :class="['btn btn-sm join-item', filter === filterType ? 'btn-active' : '']"
                >
                  {{ filterType.charAt(0).toUpperCase() + filterType.slice(1) }}
                  ({{ filterByType(filterType).length }})
                </button>
              </div>

              <!-- Todo List -->
              <div v-if="filteredTodos.length > 0" class="space-y-2 mb-4">
                <div v-for="todo in filteredTodos" :key="todo.id" class="card card-compact bg-base-200">
                  <div class="card-body">
                    <div class="flex items-center gap-3">
                      <input
                        type="checkbox"
                        :checked="todo.completed"
                        @change="$live.pushEvent('toggle_todo', { id: todo.id })"
                        class="checkbox checkbox-primary"
                      />
                      <span :class="['flex-1 text-left', todo.completed ? 'line-through opacity-60' : '']">
                        {{ todo.text }}
                      </span>
                      <button @click="$live.pushEvent('delete_todo', { id: todo.id })" class="btn btn-error btn-sm">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="alert">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>{{ filter === "all" ? "No todos yet!" : `No ${filter} todos!` }}</span>
              </div>

              <!-- Actions -->
              <div v-if="props.todos.some((todo) => todo.completed)" class="card-actions justify-between">
                <span class="text-sm opacity-70">{{ completedCount }} completed</span>
                <button @click="$live.pushEvent('clear_completed', {})" class="btn btn-error btn-sm">Clear completed</button>
              </div>
            </div>

            <!-- Features Info -->
            <div class="alert alert-info">
              <div>
                <h4 class="font-bold">LiveVite Features Demonstrated:</h4>
                <ul class="text-sm mt-2 space-y-1">
                  <li>✅ <strong>Reactive Props:</strong> Todos flow from server state</li>
                  <li>✅ <strong>Server Events:</strong> Add, toggle, delete todos send events to LiveView</li>
                  <li>✅ <strong>Local State:</strong> Filter buttons work entirely client-side</li>
                  <li>✅ <strong>Server-side Validation:</strong> Uses Ecto.Changeset</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </template>
      """
    end

    # ── React demo component ──

    defp demo_react_content do
      """
      import { useState, useMemo } from "react"
      import { useLive, useLiveFormReact, useFieldReact, type Form } from "live_vite"

      type FilterType = "all" | "active" | "completed"

      interface Todo {
        id: number
        text: string
        completed: boolean
      }

      interface Props {
        todos: Todo[]
        form: Form<{ text: string }>
      }

      export default function ReactDemo({ todos, form }: Props) {
        const live = useLive()
        const [filter, setFilter] = useState<FilterType>("all")

        // Server-side validation using changesets
        const { submit, isValid } = useLiveFormReact<{ text: string }>(() => form, {
          submitEvent: "add_todo",
          changeEvent: "validate_todo",
          debounceInMiliseconds: 50,
        })

        const textField = useFieldReact<{ text: string }>("text")

        const filterByType = (type: FilterType) => {
          switch (type) {
            case "active":
              return todos.filter((todo) => !todo.completed)
            case "completed":
              return todos.filter((todo) => todo.completed)
            default:
              return todos
          }
        }

        const filteredTodos = useMemo(() => filterByType(filter), [filter, todos])
        const completedCount = useMemo(() => filterByType("completed").length, [todos])

        return (
          <div className="text-center">
            <div className="max-w-2xl space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-5xl font-bold">🎉 Welcome to LiveVite!</h1>
                <p className="text-lg text-base-content/70">React components seamlessly integrated with Phoenix LiveView</p>
              </div>

              {/* Todo Demo Card */}
              <div>
                {/* Add Todo Form */}
                <form onSubmit={(e) => { e.preventDefault(); submit() }} className="form-control mb-6">
                  <div className="join mb-2">
                    <input
                      {...textField.inputAttrs}
                      type="text"
                      placeholder="What needs to be done?"
                      className="input input-bordered join-item flex-1"
                    />
                    <button type="submit" disabled={!isValid} className="btn btn-primary join-item">Add Todo</button>
                  </div>
                  {(textField.isTouched || textField.isDirty) && textField.errorMessage && (
                    <div className="text-error text-xs">{textField.errorMessage}</div>
                  )}
                </form>

                {/* Filter Buttons */}
                <div className="join mb-6 mx-auto">
                  {(["all", "active", "completed"] as FilterType[]).map((filterType) => (
                    <button
                      key={filterType}
                      onClick={() => setFilter(filterType)}
                      className={`btn btn-sm join-item ${filter === filterType ? "btn-active" : ""}`}
                    >
                      {filterType.charAt(0).toUpperCase() + filterType.slice(1)} ({filterByType(filterType).length})
                    </button>
                  ))}
                </div>

                {/* Todo List */}
                {filteredTodos.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {filteredTodos.map((todo) => (
                      <div key={todo.id} className="card card-compact bg-base-200">
                        <div className="card-body">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => live.pushEvent("toggle_todo", { id: todo.id })}
                              className="checkbox checkbox-primary"
                            />
                            <span className={`flex-1 text-left ${todo.completed ? "line-through opacity-60" : ""}`}>
                              {todo.text}
                            </span>
                            <button
                              onClick={() => live.pushEvent("delete_todo", { id: todo.id })}
                              className="btn btn-error btn-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{filter === "all" ? "No todos yet!" : `No ${filter} todos!`}</span>
                  </div>
                )}

                {/* Actions */}
                {todos.some((todo) => todo.completed) && (
                  <div className="card-actions justify-between">
                    <span className="text-sm opacity-70">{completedCount} completed</span>
                    <button onClick={() => live.pushEvent("clear_completed", {})} className="btn btn-error btn-sm">
                      Clear completed
                    </button>
                  </div>
                )}
              </div>

              {/* Features Info */}
              <div className="alert alert-info">
                <div>
                  <h4 className="font-bold">LiveVite Features Demonstrated:</h4>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>✅ <strong>Reactive Props:</strong> Todos flow from server state</li>
                    <li>✅ <strong>Server Events:</strong> Add, toggle, delete todos send events to LiveView</li>
                    <li>✅ <strong>Local State:</strong> Filter buttons work entirely client-side</li>
                    <li>✅ <strong>Server-side Validation:</strong> Uses Ecto.Changeset</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )
      }
      """
    end

    defp react_demo_live_view_content(igniter) do
      web_module_name = Phoenix.web_module(igniter)

      """
      defmodule #{inspect(web_module_name)}.ReactDemoLive do
        use #{inspect(web_module_name)}, :live_view

        @impl true
        def render(assigns) do
          ~H\"\"\"
          <Layouts.app flash={@flash}>
            <.react
              todos={@todos}
              form={@form}
              v-component="ReactDemo"
              v-socket={@socket}
            />
          </Layouts.app>
          \"\"\"
        end

        @impl true
        def mount(_params, _session, socket) do
          socket =
            socket
            |> assign(:todos, [
              %{id: 1, text: "Learn LiveVite basics", completed: true},
              %{id: 2, text: "Build an interactive component", completed: false},
              %{id: 3, text: "Deploy to production", completed: false}
            ])
            |> assign(:next_id, 4)
            |> assign(:form, add_todo_form(%{text: ""}))

          {:ok, socket}
        end

        @impl true
        def handle_event("validate_todo", %{"todo" => params}, socket) do
          {:noreply, assign(socket, :form, add_todo_form(params))}
        end

        @impl true
        def handle_event("add_todo", %{"todo" => params}, socket) do
          changeset = add_todo_changeset(params, socket.assigns.next_id)

          case Ecto.Changeset.apply_action(changeset, :insert) do
            {:ok, new_todo} ->
              socket =
                socket
                |> assign(:todos, socket.assigns.todos ++ [new_todo])
                |> assign(:next_id, socket.assigns.next_id + 1)
                |> assign(:form, add_todo_form(%{text: ""}))

              {:noreply, socket}

            {:error, changeset} ->
              {:noreply, assign(socket, :form, to_form(changeset, as: :todo))}
          end
        end

        @impl true
        def handle_event("toggle_todo", %{"id" => id}, socket) do
          todos =
            Enum.map(socket.assigns.todos, fn todo ->
              if todo.id == id, do: %{todo | completed: !todo.completed}, else: todo
            end)

          {:noreply, assign(socket, :todos, todos)}
        end

        @impl true
        def handle_event("delete_todo", %{"id" => id}, socket) do
          todos = Enum.reject(socket.assigns.todos, fn todo -> todo.id == id end)
          {:noreply, assign(socket, :todos, todos)}
        end

        @impl true
        def handle_event("clear_completed", _params, socket) do
          todos = Enum.reject(socket.assigns.todos, fn todo -> todo.completed end)
          {:noreply, assign(socket, :todos, todos)}
        end

        defp add_todo_changeset(params, id \\\\ nil) do
          data = %{text: "", id: id, completed: false}
          types = %{text: :string}

          {data, types}
          |> Ecto.Changeset.cast(params, Map.keys(types))
          |> Ecto.Changeset.validate_required([:text])
          |> Ecto.Changeset.validate_length(:text, min: 8, max: 50)
        end

        defp add_todo_form(params) do
          params
          |> add_todo_changeset()
          |> Map.put(:action, :validate)
          |> to_form(as: :todo)
        end
      end
      """
    end

    # ── Server.js templates ──

    defp vue_server_js_content do
      """
      import components from "../vue"
      import { getRender, loadManifest } from "live_vite/server"

      // present only in prod build. Returns empty obj if doesn't exist
      // used to render preload links
      const manifest = loadManifest("../priv/static/.vite/ssr-manifest.json")
      export const render = getRender(components, manifest)
      """
    end

    defp react_server_js_content do
      """
      import { createReactRenderer, getRendererRender, findComponent, loadManifest } from "live_vite/server"

      const renderer = createReactRenderer()

      const components = import.meta.glob("../react/**/*.tsx", { eager: true })

      const resolve = (name) => {
        const mod = findComponent(components, name)
        return mod && mod.default ? mod.default : mod
      }

      const manifest = loadManifest("../priv/static/.vite/ssr-manifest.json")
      export const render = getRendererRender(renderer, resolve, manifest)
      """
    end

    defp multi_server_js_content do
      """
      import { createVueRenderer, createReactRenderer, getMultiRendererRender, findComponent, loadManifest } from "live_vite/server"

      const vueRenderer = createVueRenderer()
      const reactRenderer = createReactRenderer()

      const vueComponents = import.meta.glob("../vue/**/*.vue", { eager: true })
      const reactComponents = import.meta.glob("../react/**/*.tsx", { eager: true })

      const manifest = loadManifest("../priv/static/.vite/ssr-manifest.json")

      export const render = getMultiRendererRender({
        vue: {
          renderer: vueRenderer,
          resolve: (name) => {
            const mod = findComponent(vueComponents, name)
            return mod && mod.default ? mod.default : mod
          },
        },
        react: {
          renderer: reactRenderer,
          resolve: (name) => {
            const mod = findComponent(reactComponents, name)
            return mod && mod.default ? mod.default : mod
          },
        },
      }, manifest)
      """
    end

    # Add demo routes to dev section of router.ex
    defp add_demo_routes(igniter, frameworks) do
      web_module = Phoenix.web_module(igniter)
      web_folder = Macro.underscore(web_module)
      web_module_name = web_module |> Module.split() |> Enum.join(".")
      router_file = Path.join(["lib", web_folder, "router.ex"])

      Igniter.update_file(igniter, router_file, fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          content
          |> maybe_add_route(frameworks, :vue, web_module_name)
          |> maybe_add_route(frameworks, :react, web_module_name)
        end)
      end)
    end

    defp maybe_add_route(content, frameworks, framework, web_module_name) do
      if framework not in frameworks, do: content, else: add_framework_route(content, framework, web_module_name)
    end

    defp add_framework_route(content, :vue, web_module_name) do
      if String.contains?(content, "live \"/vue_demo\"") do
        content
      else
        add_route_after_dashboard(content, "live \"/vue_demo\", #{web_module_name}.VueDemoLive", "/dev/vue_demo")
      end
    end

    defp add_framework_route(content, :react, web_module_name) do
      if String.contains?(content, "live \"/react_demo\"") do
        content
      else
        add_route_after_dashboard(content, "live \"/react_demo\", #{web_module_name}.ReactDemoLive", "/dev/react_demo")
      end
    end

    defp add_route_after_dashboard(content, route_line, fallback_path) do
      if String.contains?(content, "live_dashboard") do
        String.replace(
          content,
          ~r/(live_dashboard.*)/,
          "\\1\n      #{route_line}"
        )
      else
        String.replace(
          content,
          ~r/(pipe_through :browser.*)/,
          "\\1\n      #{String.replace(route_line, ~r/"\/\w+_demo"/, "\"#{fallback_path}\"")}"
        )
      end
    end

    # Update home.html.heex template with LiveVite content
    defp update_home_template(igniter, frameworks) do
      web_module = Phoenix.web_module(igniter)
      web_folder = Macro.underscore(web_module)
      home_template = Path.join(["lib", web_folder, "controllers", "page_html", "home.html.heex"])

      {file_description, demo_links} =
        case frameworks do
          [:vue] ->
            {
              """
              Congratulations, you've successfully created a LiveVite app with Phoenix!
                    We've automatically created two files for you: <br />
                    <code class="text-sm text-primary">assets/vue/VueDemo.vue</code>
                    <br />
                    <code class="text-sm text-primary">lib/#{web_folder}/live/vue_demo.ex</code>
                    <br /> Click the button below to see it in action.\
              """,
              ~s(<a href={~p"/dev/vue_demo"} class="btn btn-primary mt-4">Vue Demo</a>)
            }

          [:react] ->
            {
              """
              Congratulations, you've successfully created a LiveVite app with Phoenix!
                    We've automatically created two files for you: <br />
                    <code class="text-sm text-primary">assets/react/ReactDemo.tsx</code>
                    <br />
                    <code class="text-sm text-primary">lib/#{web_folder}/live/react_demo.ex</code>
                    <br /> Click the button below to see it in action.\
              """,
              ~s(<a href={~p"/dev/react_demo"} class="btn btn-primary mt-4">React Demo</a>)
            }

          [:vue, :react] ->
            {
              """
              Congratulations, you've successfully created a LiveVite app with Phoenix!
                    We've set up both Vue and React for you. Click a button below to see a demo.\
              """,
              ~s(<a href={~p"/dev/vue_demo"} class="btn btn-primary mt-4">Vue Demo</a>\n    <a href={~p"/dev/react_demo"} class="btn btn-secondary mt-4 ml-2">React Demo</a>)
            }
        end

      Igniter.update_file(igniter, home_template, fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          content
          |> String.replace(
            "Peace of mind from prototype to production.",
            "End-to-end reactivity for your LiveVite apps."
          )
          |> String.replace(
            ~r/Build rich, interactive web applications quickly.*at scale\./s,
            file_description
          )
          |> String.replace(
            ~s(<div class="flex">),
            ~s(#{demo_links}\n    <div class="flex">)
          )
        end)
      end)
    end

    # Update mix.exs aliases to include set_build_path function
    defp update_mix_aliases(igniter) do
      Igniter.update_file(igniter, "mix.exs", fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          # Check if set_build_path function already exists
          if String.contains?(content, "js/server.js") do
            content
          else
            # Add the set_build_path function at the end of the module (before final end)
            String.replace(
              content,
              ~s("phoenix_vite.npm vite build"),
              ~s("phoenix_vite.npm vite build --manifest --emptyOutDir true", "phoenix_vite.npm vite build --ssrManifest --emptyOutDir false --ssr js/server.js --outDir ../priv/static")
            )
          end
        end)
      end)
    end

    defp append_usage_rules_to_agents_md(igniter) do
      if Igniter.exists?(igniter, "AGENTS.md") do
        Igniter.update_file(igniter, "AGENTS.md", fn source ->
          Rewrite.Source.update(source, :content, fn content ->
            # Check if LiveVite usage rules are already added
            if String.contains?(content, "<!-- live_vite-start -->") do
              content
            else
              rules = "\n\n<!-- live_vite-start -->\n" <> @usage_rules_content <> "\n<!-- live_vite-end -->\n"
              # Append just before the end of the file
              if String.contains?(content, "<!-- usage-rules-end -->") do
                String.replace(content, ~r/(<!-- usage-rules-end -->)/, rules <> "\\1")
              else
                content <> rules
              end
            end
          end)
        end)
      else
        igniter
      end
    end

    defp update_gitignore(igniter) do
      Igniter.update_file(igniter, ".gitignore", fn source ->
        Rewrite.Source.update(source, :content, fn content ->
          String.replace(content, "/assets/node_modules", "node_modules")
        end)
      end)
    end
  else
    use Mix.Task

    @impl Mix.Task
    def run(_argv) do
      Mix.shell().error("""
      The task 'live_vite.install' requires igniter. Please install igniter and try again.

      For more information, see: https://hexdocs.pm/igniter/readme.html#installation
      """)

      exit({:shutdown, 1})
    end
  end
end
