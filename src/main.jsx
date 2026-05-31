import {createRoot} from "react-dom/client";
import {App} from "./App.jsx";
import {HelpPage} from "./HelpPage.jsx";
import "./css/styles.css";

createRoot(document.getElementById("root")).render(
  window.location.pathname === "/help" ? <HelpPage/> : <App/>,
);
