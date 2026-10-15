(() => {
  const root = document.documentElement;
  const T = window.translations;
  const button = document.getElementById("translate-toggle");
  const list = document.getElementById("language-list");
  const overlayText = document.querySelector(".overlay-description-text");

  const htmlLang = {
    readable: "en", ja: "ja", zh: "zh-Hans", nl: "nl", ar: "ar",
    fr: "fr", it: "it", ru: "ru", es: "es", sv: "sv"
  };
  const lIndex = new Map(T.keys.l.map((key, i) => [key, i]));
  const dIndex = new Map(T.keys.d.map((key, i) => [key, i]));

  let current = root.dataset.lang && htmlLang[root.dataset.lang] ? root.dataset.lang : null;

  function source() {
    return !current || current === "readable" ? T.en : T[current];
  }

  window.getDescriptionText = (src) => {
    const stem = (src || "").split("/").pop().replace(/desc\.svg$/, "");
    const i = dIndex.get(stem);
    return i === undefined ? "" : source().d[i];
  };

  document.querySelectorAll("img[data-lazy-src]").forEach((img) => {
    const stem = img.dataset.lazySrc.split("/").pop().replace(/\.svg$/, "");
    if (!lIndex.has(stem)) return;

    const span = document.createElement("span");
    span.className = "readable-label";
    span.dataset.l = stem;
    img.classList.add("has-readable");
    img.after(span);
  });

  function apply() {
    const labels = source().l;
    document.querySelectorAll("[data-l]").forEach((el) => {
      el.textContent = labels[lIndex.get(el.dataset.l)];
    });

    root.classList.toggle("readable", Boolean(current));
    if (current) root.dataset.lang = current;
    else delete root.dataset.lang;
    root.lang = current ? htmlLang[current] : "en";

    if (overlayText && overlayText.dataset.src) {
      overlayText.textContent = window.getDescriptionText(overlayText.dataset.src);
    }

    list?.querySelectorAll("button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item.dataset.lang === current));
    });
  }

  const menuLinks = [...document.querySelectorAll(".menu-text a")];

  function updateActiveMenuLink() {
    const middle = window.innerHeight / 2;
    menuLinks.forEach((link) => {
      const section = document.querySelector(link.getAttribute("href"));
      const rect = section?.getBoundingClientRect();
      if (rect && rect.top <= middle && rect.bottom > middle) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  window.addEventListener("scroll", updateActiveMenuLink, { passive: true });
  window.addEventListener("resize", updateActiveMenuLink);
  updateActiveMenuLink();

  apply();
  if (!button || !list) return;

  function setOpen(open) {
    list.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  function setLang(code) {
    current = code;
    if (code) localStorage.setItem("lang", code);
    else localStorage.removeItem("lang");
    apply();
  }

  button.addEventListener("click", () => {
    if (current) {
      setLang(null);
      setOpen(false);
    } else {
      setOpen(list.hidden);
    }
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest("button[data-lang]");
    if (!item) return;
    setLang(item.dataset.lang);
    setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!list.hidden && !list.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
})();
