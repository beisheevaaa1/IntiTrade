
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

window.addEventListener("vite:preloadError", (event) => {
  const reloadKey = "intitrade_chunk_reload";
  if (!sessionStorage.getItem(reloadKey)) {
    event.preventDefault();
    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  }
});

window.addEventListener("load", () => sessionStorage.removeItem("intitrade_chunk_reload"), { once: true });

createRoot(document.getElementById("root")!).render(<App />);
