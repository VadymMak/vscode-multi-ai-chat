import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

// Importing global styles
import "./index.css";

// Entry point for the React application
// Rendering the main App component into the root element
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
