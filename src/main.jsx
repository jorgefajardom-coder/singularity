import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Aislado, { RespaldoGlobal } from "./components/Aislado";
import { site } from "./data/content";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Aislado nombre="la aplicacion" fallback={<RespaldoGlobal nombre={site.name} correo={site.email} />}>
      <App />
    </Aislado>
  </React.StrictMode>
);
