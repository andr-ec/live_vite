defmodule LiveViteTest do
  use ExUnit.Case

  import LiveVite
  import Phoenix.Component
  import Phoenix.LiveViewTest

  alias LiveVite.Test
  alias Phoenix.LiveView.JS

  doctest LiveVite

  describe "basic component rendering" do
    def simple_component(assigns) do
      ~H"""
      <.vue name="John" surname="Doe" v-component="MyComponent" />
      """
    end

    test "renders component with correct props" do
      html = render_component(&simple_component/1)
      vue = Test.get_vue(html)

      assert vue.component == "MyComponent"
      assert vue.props == %{"name" => "John", "surname" => "Doe"}
    end

    test "generates consistent ID" do
      html = render_component(&simple_component/1)
      vue = Test.get_vue(html)

      assert vue.id =~ ~r/MyComponent-\d+/
    end
  end

  describe "multiple components" do
    def multi_component(assigns) do
      ~H"""
      <div>
        <.vue id="profile-1" name="John" v-component="UserProfile" />
        <.vue id="card-1" name="Jane" v-component="UserCard" />
      </div>
      """
    end

    test "finds first component by default" do
      html = render_component(&multi_component/1)
      vue = Test.get_vue(html)

      assert vue.component == "UserProfile"
      assert vue.props == %{"name" => "John"}
    end

    test "finds specific component by name" do
      html = render_component(&multi_component/1)
      vue = Test.get_vue(html, name: "UserCard")

      assert vue.component == "UserCard"
      assert vue.props == %{"name" => "Jane"}
    end

    test "finds specific component by id" do
      html = render_component(&multi_component/1)
      vue = Test.get_vue(html, id: "card-1")

      assert vue.component == "UserCard"
      assert vue.id == "card-1"
    end

    test "raises error when component with name not found" do
      html = render_component(&multi_component/1)

      assert_raise RuntimeError,
                   ~r/No Vue component found with name="Unknown".*Available components: UserProfile#profile-1, UserCard#card-1/,
                   fn ->
                     Test.get_vue(html, name: "Unknown")
                   end
    end

    test "raises error when component with id not found" do
      html = render_component(&multi_component/1)

      assert_raise RuntimeError,
                   ~r/No Vue component found with id="unknown-id".*Available components: UserProfile#profile-1, UserCard#card-1/,
                   fn ->
                     Test.get_vue(html, id: "unknown-id")
                   end
    end
  end

  describe "event handlers" do
    def component_with_events(assigns) do
      ~H"""
      <.vue
        name="John"
        v-component="MyComponent"
        v-on:click={JS.push("click", value: %{"abc" => "def"})}
        v-on:submit={JS.push("submit")}
      />
      """
    end

    test "renders event handlers correctly" do
      html = render_component(&component_with_events/1)
      vue = Test.get_vue(html)

      assert vue.handlers == %{
               "click" => JS.push("click", value: %{"abc" => "def"}),
               "submit" => JS.push("submit")
             }
    end
  end

  describe "styling" do
    def styled_component(assigns) do
      ~H"""
      <.vue name="John" v-component="MyComponent" class="bg-blue-500 rounded" />
      """
    end

    test "applies CSS classes" do
      html = render_component(&styled_component/1)
      vue = Test.get_vue(html)

      assert vue.class == "bg-blue-500 rounded"
    end
  end

  describe "SSR behavior" do
    def ssr_component(assigns) do
      ~H"""
      <.vue name="John" v-component="MyComponent" v-ssr={false} />
      """
    end

    test "respects SSR flag" do
      html = render_component(&ssr_component/1)
      vue = Test.get_vue(html)

      assert vue.ssr == false
    end
  end

  describe "slots" do
    def component_with_slots(assigns) do
      ~H"""
      <.vue v-component="WithSlots">
        Default content
        <:header>Header content</:header>
        <:footer>
          <div>Footer content</div>
          <button>Click me</button>
        </:footer>
      </.vue>
      """
    end

    def component_with_default_slot(assigns) do
      ~H"""
      <.vue v-component="WithSlots">
        <:default>Simple content</:default>
      </.vue>
      """
    end

    def component_with_inner_block(assigns) do
      ~H"""
      <.vue v-component="WithSlots">
        Simple content
      </.vue>
      """
    end

    test "warns about usage of <:default> slot" do
      assert_raise RuntimeError,
                   "Instead of using <:default> use <:inner_block> slot",
                   fn -> render_component(&component_with_default_slot/1) end
    end

    test "renders multiple slots" do
      html = render_component(&component_with_slots/1)
      vue = Test.get_vue(html)

      assert vue.slots == %{
               "default" => "Default content",
               "header" => "Header content",
               "footer" => "<div>Footer content</div>\n    <button>Click me</button>"
             }
    end

    test "renders default slot with inner_block" do
      html = render_component(&component_with_inner_block/1)
      vue = Test.get_vue(html)

      assert vue.slots == %{"default" => "Simple content"}
    end

    test "encodes slots as base64" do
      html = render_component(&component_with_slots/1)

      # Get raw data-slots attribute to verify base64 encoding
      doc = LazyHTML.from_fragment(html)
      slots_attr = doc |> LazyHTML.attribute("data-slots") |> hd()

      # JSON encoded map
      assert slots_attr =~ ~r/^\{.*\}$/

      slots =
        slots_attr
        |> Jason.decode!()
        |> Map.new(fn {key, value} -> {key, Base.decode64!(value)} end)

      assert slots == %{
               "default" => "Default content",
               "header" => "Header content",
               "footer" => "<div>Footer content</div>\n    <button>Click me</button>"
             }
    end

    test "handles empty slots" do
      html =
        render_component(fn assigns ->
          ~H"""
          <.vue v-component="WithSlots" />
          """
        end)

      vue = Test.get_vue(html)

      assert vue.slots == %{}
    end
  end

  describe "framework attribute" do
    def vue_component(assigns) do
      ~H"""
      <.vue name="John" v-component="MyComponent" />
      """
    end

    def react_component(assigns) do
      ~H"""
      <.react name="John" v-component="MyComponent" />
      """
    end

    def explicit_framework_component(assigns) do
      ~H"""
      <.vue name="John" v-component="MyComponent" v-framework="react" />
      """
    end

    test "vue component renders with data-framework=vue" do
      html = render_component(&vue_component/1)
      vue = Test.get_vue(html)

      assert vue.framework == "vue"
    end

    test "react component renders with data-framework=react" do
      html = render_component(&react_component/1)
      vue = Test.get_vue(html)

      assert vue.framework == "react"
      assert vue.component == "MyComponent"
      assert vue.props == %{"name" => "John"}
    end

    test "react component passes all props correctly" do
      html =
        render_component(fn assigns ->
          ~H"""
          <.react name="Alice" age={30} v-component="Profile" />
          """
        end)

      vue = Test.get_vue(html)

      assert vue.framework == "react"
      assert vue.props == %{"name" => "Alice", "age" => 30}
    end

    test "explicit v-framework overrides default" do
      html = render_component(&explicit_framework_component/1)
      vue = Test.get_vue(html)

      assert vue.framework == "react"
    end

    test "react component with slots" do
      html =
        render_component(fn assigns ->
          ~H"""
          <.react v-component="WithSlots">
            Default content
            <:header>Header content</:header>
          </.react>
          """
        end)

      vue = Test.get_vue(html)

      assert vue.framework == "react"
      assert vue.slots == %{"default" => "Default content", "header" => "Header content"}
    end

    test "react component with event handlers" do
      html =
        render_component(fn assigns ->
          ~H"""
          <.react
            v-component="MyComponent"
            v-on:click={JS.push("click")}
          />
          """
        end)

      vue = Test.get_vue(html)

      assert vue.framework == "react"
      assert vue.handlers == %{"click" => JS.push("click")}
    end

    test "mixed vue and react components" do
      html =
        render_component(fn assigns ->
          ~H"""
          <div>
            <.vue id="vue-1" name="John" v-component="VueComponent" />
            <.react id="react-1" name="Jane" v-component="ReactComponent" />
          </div>
          """
        end)

      vue_comp = Test.get_vue(html, id: "vue-1")
      react_comp = Test.get_vue(html, id: "react-1")

      assert vue_comp.framework == "vue"
      assert react_comp.framework == "react"
      assert vue_comp.props == %{"name" => "John"}
      assert react_comp.props == %{"name" => "Jane"}
    end
  end

  describe "edge cases" do
    def edge_case_component(assigns) do
      ~H"""
      <.vue name="John" v-component="MyComponent" />
      """
    end

    test "raises ArgumentError with invalid option key" do
      html = render_component(&edge_case_component/1)

      assert_raise ArgumentError,
                   "invalid keyword option for get_vue/2: foo",
                   fn ->
                     Test.get_vue(html, foo: "bar")
                   end
    end

    test "raises error when no Vue components found" do
      html = "<div>No Vue components here</div>"

      assert_raise RuntimeError,
                   "No Vue components found in the rendered HTML",
                   fn ->
                     Test.get_vue(html)
                   end
    end

    test "handles missing attributes gracefully" do
      html = render_component(&edge_case_component/1)
      vue = Test.get_vue(html)

      # Components without class attribute should return nil or empty string
      assert vue.class in [nil, ""]
    end
  end
end
