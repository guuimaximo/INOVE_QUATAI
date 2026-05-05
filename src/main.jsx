import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { BrowserRouter, HashRouter } from "react-router-dom";

import App from "./App.jsx";
import RootErrorBoundary from "./components/RootErrorBoundary.jsx";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

const isNativeShell = Capacitor.isNativePlatform();
const Router = isNativeShell ? HashRouter : BrowserRouter;

registerServiceWorker({ disable: isNativeShell });

if (isNativeShell) {
  document.documentElement.classList.add("native-mobile-app");
  document.body.classList.add("native-mobile-app");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <Router>
        <App />
      </Router>
    </RootErrorBoundary>
  </React.StrictMode>,
);
