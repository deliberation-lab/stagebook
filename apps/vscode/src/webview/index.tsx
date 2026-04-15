import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { TreatmentFileType } from "stagebook";
import { Viewer } from "stagebook-viewer/preview";

// Declare the VS Code API injected by the webview
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// --- Content functions via postMessage bridge ---

let requestId = 0;
const pendingRequests = new Map<
  number,
  { resolve: (value: string) => void; reject: (err: Error) => void }
>();

// Listen for responses from the extension host
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "treatment") {
    // Treatment data from extension host — handled by App state
    return;
  }
  if (msg.type === "fileContent") {
    const pending = pendingRequests.get(msg.requestId);
    if (pending) {
      pendingRequests.delete(msg.requestId);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.content);
      }
    }
  }
});

function createWebviewContentFns(webviewBaseUri: string) {
  const cache = new Map<string, Promise<string>>();

  return {
    getTextContent(path: string): Promise<string> {
      const cached = cache.get(path);
      if (cached) return cached;

      const id = requestId++;
      const promise = new Promise<string>((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        vscode.postMessage({ type: "readFile", requestId: id, path });
      }).catch((err) => {
        cache.delete(path);
        throw err;
      }) as Promise<string>;

      cache.set(path, promise);
      return promise;
    },

    getAssetURL(assetPath: string): string {
      const base = webviewBaseUri.endsWith("/")
        ? webviewBaseUri
        : webviewBaseUri + "/";
      return base + assetPath.replace(/^\/+/, "");
    },
  };
}

// --- App ---

function App() {
  const [treatmentFile, setTreatmentFile] = useState<TreatmentFileType | null>(
    null,
  );
  const [introIndex, setIntroIndex] = useState(0);
  const [treatmentIndex, setTreatmentIndex] = useState(0);
  const [webviewBaseUri, setWebviewBaseUri] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "treatment") {
        setTreatmentFile(msg.treatmentFile);
        setIntroIndex(msg.introIndex ?? 0);
        setTreatmentIndex(msg.treatmentIndex ?? 0);
        setWebviewBaseUri(msg.webviewBaseUri ?? "");
        setError(null);
      } else if (msg.type === "error") {
        setError(msg.message);
        setTreatmentFile(null);
      }
    };
    window.addEventListener("message", handler);

    // Tell the extension host we're ready
    vscode.postMessage({ type: "ready" });

    return () => window.removeEventListener("message", handler);
  }, []);

  const contentFns = useMemo(
    () => createWebviewContentFns(webviewBaseUri),
    [webviewBaseUri],
  );

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "#ef4444" }}>
        <h2>Preview Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!treatmentFile) {
    return (
      <div style={{ padding: "2rem", color: "#6b7280" }}>
        <p>Loading treatment preview...</p>
      </div>
    );
  }

  return (
    <Viewer
      treatmentFile={treatmentFile}
      getTextContent={contentFns.getTextContent}
      getAssetURL={contentFns.getAssetURL}
      selectedIntroIndex={introIndex}
      selectedTreatmentIndex={treatmentIndex}
      onBack={() => {
        /* no-op in extension webview */
      }}
    />
  );
}

// Mount
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
