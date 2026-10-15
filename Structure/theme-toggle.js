(() => {
  const root = document.documentElement;
  const button = document.getElementById("theme-toggle");
  if (!button) return;

  function render() {
    const dark = root.classList.contains("dark");
    button.querySelector("img").src = dark
      ? "assets/lightmodeicon.svg"
      : "assets/darkmodeicon.svg";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  button.addEventListener("click", () => {
    const dark = root.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
    render();
  });

  render();
})();
