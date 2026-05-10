import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { registerServiceWorker } from "./lib/registerSW";

initAnalytics();
createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
