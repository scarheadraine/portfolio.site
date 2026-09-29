let pdfJsPromise;
window.pdfPageSources = new WeakMap();

function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;

    pdfJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.async = true;
        script.onload = () => window.pdfjsLib
            ? resolve(window.pdfjsLib)
            : reject(new Error("PDF.js did not initialize"));
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return pdfJsPromise;
}

function loadPdfDocument(pdfDocument) {
    loadPdfJs()
        .then(() => initializePdfViewer(pdfDocument))
        .catch(() => {
            pdfDocument.dataset.loadError = "true";
        });
}

function observePdfDocuments() {
    const pdfDocuments = [...document.querySelectorAll(".pdf-document")];
    if (!pdfDocuments.length) return;

    if (!("IntersectionObserver" in window)) {
        pdfDocuments.forEach(loadPdfDocument);
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            loadPdfDocument(entry.target);
        });
    }, { rootMargin: "600px 0px" });

    pdfDocuments.forEach((pdfDocument) => observer.observe(pdfDocument));
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.siteContentReady) {
        observePdfDocuments();
    } else {
        window.addEventListener("site-content-ready", observePdfDocuments, { once: true });
    }
});

function initializePdfViewer(pdfDocument) {
    const viewer = pdfDocument.querySelector(".pdf-viewer");
    const previousButton = pdfDocument.querySelector(".pdf-previous");
    const nextButton = pdfDocument.querySelector(".pdf-next");
    const pageStatus = pdfDocument.querySelector(".pdf-page-status");

    viewer.tabIndex = 0;
    viewer.setAttribute("role", "region");
    viewer.setAttribute("aria-label", "PDF pages");

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const mobile = window.matchMedia("(max-width: 768px)");
    let pdf;
    let pages = [];
    let currentPageIndex = 0;
    let resizeTimer;
    let touchGesture = null;
    let suppressClickUntil = 0;
    const digitAssets = {
        "0": "zero.svg",
        "1": "one.svg",
        "2": "two.svg",
        "3": "three.svg",
        "4": "four.svg",
        "5": "five.svg",
        "6": "six.svg",
        "7": "seven.svg",
        "8": "eight.svg",
        "9": "nine.svg"
    };

    function appendNumber(value) {
        const number = document.createElement("span");
        number.className = "pdf-number";
        number.setAttribute("aria-hidden", "true");

        for (const character of String(value)) {
            const digit = document.createElement("img");
            digit.src = `assets/${digitAssets[character]}`;
            digit.alt = "";
            number.appendChild(digit);
        }

        pageStatus.appendChild(number);
    }

    function appendSeparator(value) {
        const separator = document.createElement("span");
        separator.className = "pdf-number-separator";
        separator.setAttribute("aria-hidden", "true");
        separator.textContent = value;
        pageStatus.appendChild(separator);
    }

    function updateNavigation() {
        const currentPage = currentPageIndex + 1;

        if (pageStatus) {
            pageStatus.replaceChildren();
            pageStatus.setAttribute(
                "aria-label",
                `Page ${currentPage} of ${pages.length}`
            );
            appendNumber(currentPage);
            appendSeparator("/");
            appendNumber(pages.length);
        }
        if (previousButton) previousButton.disabled = currentPageIndex === 0;
        if (nextButton) nextButton.disabled = currentPageIndex >= pages.length - 1;

        if (!mobile.matches) {
            viewer.querySelectorAll(".pdf-slide").forEach((slide, index) => {
                slide.hidden = index !== currentPageIndex;
            });
        }
    }

    async function renderPdf() {
        if (!pdf) {
            pdf = await pdfjsLib.getDocument(pdfDocument.dataset.pdf).promise;

            pages = await Promise.all(
                Array.from({ length: pdf.numPages }, async (_, index) => {
                    const page = await pdf.getPage(index + 1);
                    const viewport = page.getViewport({ scale: 1 });
                    return { page, width: viewport.width, height: viewport.height };
                })
            );
        }

        const renderId = (Number(viewer.dataset.renderId) || 0) + 1;
        viewer.dataset.renderId = renderId;
        viewer.replaceChildren();

        const widestPage = Math.max(...pages.map(({ width }) => width));
        const tallestPage = Math.max(...pages.map(({ height }) => height));
        const availableHeight = Math.max(
            120,
            window.innerHeight - (mobile.matches ? 280 : 200)
        );
        const scale = Math.min(
            viewer.clientWidth / widestPage,
            availableHeight / tallestPage
        );
        const devicePixelRatio = window.devicePixelRatio || 1;
        const outputScale = mobile.matches
            ? Math.min(devicePixelRatio, 1.5)
            : devicePixelRatio;
        let pageHeight = 0;

        for (const [pageIndex, pageInfo] of pages.entries()) {
            const viewport = pageInfo.page.getViewport({ scale });
            const slide = document.createElement("div");
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            slide.className = "pdf-slide";
            slide.setAttribute("role", "group");
            slide.setAttribute("aria-label", `Page ${pageIndex + 1}`);
            slide.hidden = !mobile.matches && pageIndex !== currentPageIndex;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            canvas.className = "pdf-page";
            canvas.setAttribute("role", "img");
            canvas.setAttribute("aria-label", `PDF page ${pageIndex + 1}`);
            canvas.title = "Tap to zoom and pan";
            window.pdfPageSources.set(canvas, pageInfo.page);
            slide.appendChild(canvas);
            viewer.appendChild(slide);
            pageHeight = Math.max(pageHeight, viewport.height);

            await pageInfo.page.render({
                canvasContext: context,
                viewport,
                transform: outputScale !== 1
                    ? [outputScale, 0, 0, outputScale, 0, 0]
                    : null
            }).promise;

            if (Number(viewer.dataset.renderId) !== renderId) return;
        }

        viewer.style.height = `${pageHeight}px`;
        viewer.scrollLeft = currentPageIndex * viewer.clientWidth;
        updateNavigation();
    }

    function navigatePage(amount) {
        const nextPageIndex = Math.max(
            0,
            Math.min(pages.length - 1, currentPageIndex + amount)
        );
        if (nextPageIndex === currentPageIndex) return;
        currentPageIndex = nextPageIndex;

        if (mobile.matches) {
            viewer.scrollTo({
                left: currentPageIndex * viewer.clientWidth,
                behavior: "smooth"
            });
        } else {
            updateNavigation();
            window.dispatchEvent(new CustomEvent("pdf-page-navigated", {
                detail: {
                    document: pdfDocument,
                    page: pages[currentPageIndex].page,
                    canvas: viewer.querySelectorAll(".pdf-page")[currentPageIndex]
                }
            }));
        }
    }

    viewer.addEventListener("keydown", (event) => {
        if (mobile.matches || event.altKey || event.ctrlKey || event.metaKey) return;

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            navigatePage(event.key === "ArrowRight" ? 1 : -1);
        }
    });

    viewer.addEventListener("pointerdown", (event) => {
        if (!mobile.matches && event.target instanceof Element && event.target.closest(".pdf-page")) {
            viewer.focus({ preventScroll: true });
        }
    });

    previousButton?.addEventListener("click", () => navigatePage(-1));
    nextButton?.addEventListener("click", () => navigatePage(1));

    viewer.addEventListener("scroll", () => {
        if (!mobile.matches || !viewer.clientWidth) return;

        currentPageIndex = Math.max(
            0,
            Math.min(
                pages.length - 1,
                Math.round(viewer.scrollLeft / viewer.clientWidth)
            )
        );
        updateNavigation();
    }, { passive: true });

    viewer.addEventListener("pointerdown", (event) => {
        if (!mobile.matches || event.pointerType !== "touch") return;
        if (!(event.target instanceof Element) || !event.target.closest(".pdf-page")) return;

        touchGesture = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
    });

    viewer.addEventListener("pointermove", (event) => {
        if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;
        if (Math.hypot(event.clientX - touchGesture.startX, event.clientY - touchGesture.startY) > 10) {
            touchGesture.moved = true;
        }
    });

    function finishTouchGesture(event) {
        if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;
        if (touchGesture.moved) suppressClickUntil = performance.now() + 100;
        touchGesture = null;
    }

    viewer.addEventListener("pointerup", finishTouchGesture);
    viewer.addEventListener("pointercancel", finishTouchGesture);
    viewer.addEventListener("click", (event) => {
        if (performance.now() >= suppressClickUntil) return;
        if (!(event.target instanceof Element) || !event.target.closest(".pdf-page")) return;

        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderPdf, 120);
    });

    renderPdf();
}

