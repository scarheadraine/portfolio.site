let siteContentLoadingStarted = false;

function loadLazyAsset(element) {
    const source = element.dataset.lazySrc;
    if (!source) return;

    if (element instanceof HTMLImageElement) {
        element.fetchPriority = "low";
        element.decoding = "async";
        if (element.dataset.lazySizes) {
            element.sizes = element.dataset.lazySizes;
            delete element.dataset.lazySizes;
        }
        if (element.dataset.lazySrcset) {
            element.srcset = element.dataset.lazySrcset;
            delete element.dataset.lazySrcset;
        }
    }

    if (element instanceof HTMLObjectElement) {
        element.data = source;
    } else {
        element.src = source;
    }

    delete element.dataset.lazySrc;
}

function startSiteContentLoading() {
    if (siteContentLoadingStarted) return;
    siteContentLoadingStarted = true;
    window.siteContentReady = true;

    const assets = [...document.querySelectorAll("[data-lazy-src]")];
    const menuObjects = assets.filter((asset) => asset instanceof HTMLObjectElement);
    menuObjects.forEach(loadLazyAsset);

    const scrollAssets = assets.filter((asset) => !(asset instanceof HTMLObjectElement));
    if (!("IntersectionObserver" in window)) {
        scrollAssets.forEach(loadLazyAsset);
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                loadLazyAsset(entry.target);
            });
        }, {
            rootMargin: window.matchMedia("(max-width: 768px)").matches
                ? "100px 0px"
                : "300px 0px"
        });

        scrollAssets.forEach((asset) => observer.observe(asset));
    }

    window.dispatchEvent(new Event("site-content-ready"));
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.sketchHasRendered || typeof window.p5 !== "function") {
        startSiteContentLoading();
        return;
    }

    window.addEventListener("sketch-ready", startSiteContentLoading, { once: true });
    window.addEventListener("sketch-failed", startSiteContentLoading, { once: true });
});
