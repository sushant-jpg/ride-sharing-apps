import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "../../../shared/ui/App.jsx";
import "../../../shared/ui/styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App role="driver" />
    </BrowserRouter>
  </React.StrictMode>,
);
