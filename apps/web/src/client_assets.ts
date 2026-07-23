import CLIENT_JS from "./client.bundle.js" with { type: "text" };

export const CLIENT_PATH = "/assets/archive-client-e2fc25a1.js";
export const THEME_BOOT_PATH = "/assets/archive-theme-16525870.js";
export { CLIENT_JS };

export const THEME_BOOT_JS = String
  .raw`(()=>{try{const e=localStorage.getItem("fuscabot-theme"),t=e==="light"||e==="dark"?e:"system";t==="system"?delete document.documentElement.dataset.theme:document.documentElement.dataset.theme=t;const m=t==="dark"||t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",m?"#20231f":"#f4f0e5")}catch{}})();`;
