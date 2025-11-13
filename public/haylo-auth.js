document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-get-started]").forEach((btn) => {
    if (!btn.getAttribute("href")) {
      btn.setAttribute("href", "/auth/google?redirect=/your-impact");
    }
  });
});
