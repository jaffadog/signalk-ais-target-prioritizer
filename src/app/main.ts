import { mount } from "svelte";
import App from "./App.svelte";
import "tailwindcss";
import "./app.css"; // or wherever your global styles are
// import "./index.css";

mount(App, { target: document.getElementById("app") });
