import "./index.css";

import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppsSDKUIProvider linkComponent="a">
      <App />
    </AppsSDKUIProvider>
  </React.StrictMode>,
);
