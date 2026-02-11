import { useLive, useLiveUploadReact, type UploadConfig, type UploadEntry } from "live_vite"

interface Props {
  upload: UploadConfig
  uploadedFiles: { name: string; size: number; type: string }[]
}

export default function UploadTest({ upload, uploadedFiles }: Props) {
  const live = useLive()
  const { entries, showFilePicker, addFiles, submit, cancel } = useLiveUploadReact(upload, {
    changeEvent: "validate",
    submitEvent: "save",
  })

  const hasGlobalErrors = upload.errors && upload.errors.length > 0

  const getEntryName = (ref: string) => {
    const entry = entries.find((e: UploadEntry) => e.ref === ref)
    return entry ? entry.client_name : `Entry ${ref}`
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files)
      addFiles(files)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  return (
    <div className="upload-container">
      <div id="upload-info" className="info-section">
        <div id="max-entries" className="info-item">Max entries: {upload.max_entries}</div>
        <div id="auto-upload" className="info-item">Auto upload: {String(upload.auto_upload)}</div>
        <div id="selected-count" className="info-item">Selected files: {entries.length}</div>
      </div>

      <div className="upload-controls">
        <button onClick={showFilePicker} id="select-files-btn" className="btn btn-primary">
          Select Files
        </button>

        {!upload.auto_upload && entries.length > 0 && (
          <button onClick={submit} id="upload-btn" className="btn btn-success">
            Upload Files
          </button>
        )}

        {entries.length > 0 && (
          <button onClick={() => cancel()} id="cancel-all-btn" className="btn btn-danger">
            Cancel All
          </button>
        )}
      </div>

      {/* Drag and Drop Zone */}
      <div
        id="drop-zone"
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        {...{ "phx-drop-target": upload.ref } as any}
      >
        <p>Drag and drop files here</p>
      </div>

      <div id="file-list" className="file-list">
        {entries.map((entry: UploadEntry) => (
          <div key={entry.ref} data-entry-ref={entry.ref} className="file-entry">
            <div className="file-info">
              <span className="file-name">{entry.client_name}</span>
              <span className="file-size">{entry.client_size} bytes</span>
              <span className="file-progress">{entry.progress || 0}%</span>
              <span className={`file-done ${entry.done ? "status-done" : "status-pending"}`}>
                {entry.done ? "done" : "pending"}
              </span>
            </div>

            {/* Error display for each entry */}
            {entry.errors && entry.errors.length > 0 && (
              <div className="entry-errors">
                {entry.errors.map((error: string) => (
                  <div key={error} className="error-message">
                    {error}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => cancel(entry.ref)} className="cancel-entry-btn btn btn-sm">
              x
            </button>
          </div>
        ))}
      </div>

      <div id="uploaded-files" className="uploaded-files">
        {uploadedFiles.length > 0 && <h3>Uploaded Files</h3>}
        {uploadedFiles.map(file => (
          <div key={file.name} className="uploaded-file">
            <span className="uploaded-name">{file.name}</span>
            <span className="uploaded-size">{file.size} bytes</span>
          </div>
        ))}
      </div>

      {/* Global upload errors */}
      {hasGlobalErrors && (
        <div id="global-errors" className="global-errors">
          <h4>Upload Errors:</h4>
          {upload.errors.map((error: any) => (
            <div key={error.ref} className="global-error">
              <strong>{getEntryName(error.ref)}:</strong>
              <div className="error-message">{error.error}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
