import "phoenix_html"
import { Socket } from "phoenix"
import { LiveSocket } from "phoenix_live_view"

// live_vite related imports
import { getMultiRendererHook, createVueRenderer, createReactRenderer, findComponent } from "live_vite"
import { h } from "vue"

// polyfill recommended by Vite https://vitejs.dev/config/build-options#build-modulepreload
import "vite/modulepreload-polyfill"

// Vue renderer setup
const vueRenderer = createVueRenderer({
  setup: (createApp, component, props, slots, plugin, el) => {
    const app = createApp({ render: () => h(component, props, slots) })
    app.use(plugin)
    app.mount(el)
    return app
  },
})

const vueComponents = import.meta.glob("../features/**/*.vue", { eager: true })

// React renderer setup
const reactRenderer = createReactRenderer()

const reactComponents = import.meta.glob("../features/**/*.tsx", { eager: true })

// Multi-renderer hook
const VueHook = getMultiRendererHook({
  vue: {
    renderer: vueRenderer,
    resolve: name => {
      const mod = findComponent(vueComponents, name)
      return mod && mod.default ? mod.default : mod
    },
  },
  react: {
    renderer: reactRenderer,
    resolve: name => {
      const mod = findComponent(reactComponents, name)
      return mod && mod.default ? mod.default : mod
    },
  },
})

let csrfToken = document.querySelector("meta[name='csrf-token']")?.getAttribute("content")
let liveSocket = new LiveSocket("/live", Socket, {
  params: { _csrf_token: csrfToken },
  hooks: { VueHook },
})

// connect if there are any LiveViews on the page
liveSocket.connect()
window.liveSocket = liveSocket
