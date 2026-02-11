import { useState } from "react"
import { useLive } from "live_vite"

interface Item {
  id: number
  name: string
  description: string
}

export default function StreamTest({ items }: { items: Item[] }) {
  const live = useLive()
  const [newItem, setNewItem] = useState({ name: "", description: "" })
  const [positiveLimit, setPositiveLimit] = useState(3)
  const [negativeLimit, setNegativeLimit] = useState(3)

  const addItem = () => {
    if (!newItem.name.trim()) {
      alert("Please enter a name for the item")
      return
    }
    live.pushEvent("add_item", { name: newItem.name, description: newItem.description })
    setNewItem({ name: "", description: "" })
  }

  const removeItem = (id: number) => {
    live.pushEvent("remove_item", { id })
  }

  return (
    <div id="stream-component">
      <h2>Stream Test</h2>

      {/* Add new item form */}
      <div className="add-form">
        <h3>Add New Item</h3>
        <input
          data-testid="name-input"
          placeholder="Item name"
          value={newItem.name}
          onChange={e => setNewItem({ ...newItem, name: e.target.value })}
        />
        <input
          data-testid="description-input"
          placeholder="Item description"
          value={newItem.description}
          onChange={e => setNewItem({ ...newItem, description: e.target.value })}
        />
        <button data-testid="add-button" onClick={addItem}>
          Add Item
        </button>
      </div>

      {/* Stream controls */}
      <div className="stream-controls">
        <button data-testid="clear-button" onClick={() => live.pushEvent("clear_stream", {})}>
          Clear All
        </button>
        <button data-testid="reset-button" onClick={() => live.pushEvent("reset_stream", {})}>
          Reset to Default
        </button>
        <button data-testid="reset-button-at-0" onClick={() => live.pushEvent("reset_stream_at_0", {})}>
          Reset to Default (at: 0)
        </button>
      </div>

      {/* Limit operation controls */}
      <div className="limit-controls">
        <h3>Limit Operations</h3>
        <div className="limit-section">
          <h4>Multiple Insert Operations</h4>
          <button
            data-testid="add-multiple-start-button"
            className="limit-button"
            onClick={() => live.pushEvent("add_multiple_start", {})}
          >
            Add 3 Items at Start (Limit: Keep First 5)
          </button>
          <button
            data-testid="add-multiple-end-button"
            className="limit-button"
            onClick={() => live.pushEvent("add_multiple_end", {})}
          >
            Add 3 Items at End (Limit: Keep Last 5)
          </button>
        </div>

        <div className="limit-section">
          <h4>Single Insert with Custom Limits</h4>
          <div className="limit-input-group">
            <input
              type="number"
              min="1"
              max="10"
              data-testid="positive-limit-input"
              className="limit-input"
              placeholder="Positive limit"
              value={positiveLimit}
              onChange={e => setPositiveLimit(Number(e.target.value))}
            />
            <button
              data-testid="add-positive-limit-button"
              className="limit-button"
              disabled={!positiveLimit || positiveLimit < 1}
              onClick={() => live.pushEvent("add_with_positive_limit", { limit: positiveLimit.toString() })}
            >
              Add Item (Keep First {positiveLimit || "?"})
            </button>
          </div>

          <div className="limit-input-group">
            <input
              type="number"
              min="1"
              max="10"
              data-testid="negative-limit-input"
              className="limit-input"
              placeholder="Negative limit"
              value={negativeLimit}
              onChange={e => setNegativeLimit(Number(e.target.value))}
            />
            <button
              data-testid="add-negative-limit-button"
              className="limit-button"
              disabled={!negativeLimit || negativeLimit < 1}
              onClick={() => live.pushEvent("add_with_negative_limit", { limit: negativeLimit.toString() })}
            >
              Add Item (Keep Last {negativeLimit || "?"})
            </button>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="items-list">
        <h3>Items ({items.length})</h3>
        {items.length === 0 && (
          <div data-testid="empty-message" className="empty-state">
            No items in the stream
          </div>
        )}
        {items.map(item => (
          <div key={item.id} className="item" data-testid={`item-${item.id}`}>
            <div className="item-content">
              <h4 data-testid="item-name">{item.name}</h4>
              <p data-testid="item-description">{item.description}</p>
              <small data-testid="item-id">ID: {item.id}</small>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              data-testid={`remove-${item.id}`}
              className="remove-button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Debug info */}
      <div className="debug-info">
        <h4>Debug Info</h4>
        <p>Items type: {typeof items}</p>
        <p>Items length: {items.length}</p>
        <pre data-testid="raw-items">{JSON.stringify(items, null, 2)}</pre>
      </div>
    </div>
  )
}
