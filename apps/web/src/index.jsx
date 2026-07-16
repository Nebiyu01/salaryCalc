import { StrictMode } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import SalaryCalculator from "./main.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SalaryCalculator />
  </StrictMode>
);
