import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App.js";
import {
  applyCaptureDocumentMode,
  readCaptureSettings,
} from "./config/capture-mode.js";
import "./styles.css";

const rootElement = document.getElementById("root");
const captureSettings = readCaptureSettings(window.location.search);

if (import.meta.env.DEV) {
  applyCaptureDocumentMode(captureSettings, document.documentElement);
}

if (!rootElement) {
  throw new Error("Root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
