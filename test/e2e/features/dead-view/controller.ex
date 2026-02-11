defmodule LiveVite.E2E.DeadViewHTML do
  @moduledoc """
  HTML view module for dead view tests.
  """
  use Phoenix.Component
  use LiveVite

  def show(assigns) do
    ~H"""
    <h1>Dead View Test</h1>
    <p data-pw-server-message>{@message}</p>

    <.vue message={@message} v-component="dead-view/dead-view-test" id="dead-view-component" />
    """
  end
end

defmodule LiveVite.E2E.DeadViewController do
  @moduledoc """
  A regular Phoenix controller (not LiveView) to test Vue components in dead views.
  """
  use Phoenix.Controller, formats: [:html]

  def show(conn, _params) do
    conn
    |> put_layout(html: {LiveVite.E2E.Layout, :live})
    |> Plug.Conn.assign(:message, "Hello from dead view!")
    |> render(:show)
  end
end

defmodule LiveVite.E2E.DeadViewReactHTML do
  @moduledoc """
  HTML view module for React dead view tests.
  """
  use Phoenix.Component
  use LiveVite

  def show(assigns) do
    ~H"""
    <h1>React Dead View Test</h1>
    <p data-pw-server-message>{@message}</p>

    <.react message={@message} v-component="dead-view/dead-view-test-react" id="dead-view-react-component" />
    """
  end
end

defmodule LiveVite.E2E.DeadViewReactController do
  @moduledoc """
  A regular Phoenix controller (not LiveView) to test React components in dead views.
  """
  use Phoenix.Controller, formats: [:html]

  def show(conn, _params) do
    conn
    |> put_layout(html: {LiveVite.E2E.Layout, :live})
    |> Plug.Conn.assign(:message, "Hello from dead view!")
    |> render(:show)
  end
end
