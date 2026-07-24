import CLIENT_JS from "./client.bundle.js" with { type: "text" };

export const CLIENT_PATH = "/assets/archive-client-ced7ae5a.js";
export const THEME_BOOT_PATH = "/assets/archive-theme-d46ed188.js";
export { CLIENT_JS };

export const THEME_BOOT_JS = String
  .raw`(()=>{let t="light";try{const e=localStorage.getItem("fuscabot-theme");e==="dark"&&(t="dark")}catch{}document.documentElement.dataset.theme=t;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",t==="dark"?"#20231f":"#f4f0e5")})();`;
