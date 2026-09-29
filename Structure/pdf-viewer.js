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
    }, { rootMargin: "200px 0px" });

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
    let pdfLoading;
    let pageCount = 0;
    let currentPageIndex = 0;
    let resizeTimer;
    let touchGesture = null;
    let suppressClickUntil = 0;
    let renderQueue = Promise.resolve();
    let desiredPages = new Set();
    const slides = [];
    const renderedPages = new Map();
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

    function buildSlides() {
        viewer.replaceChildren();
        slides.length = 0;

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            const slide = document.createElement("div");
            slide.className = "pdf-slide";
            slide.setAttribute("role", "group");
            slide.setAttribute("aria-label", `Page ${pageIndex + 1}`);
            slide.hidden = !mobile.matches && pageIndex !== currentPageIndex;
            slides.push(slide);
            viewer.appendChild(slide);
        }
    }

    function removeRenderedPage(pageIndex, renderedPage = renderedPages.get(pageIndex)) {
        if (!renderedPage || renderedPages.get(pageIndex) !== renderedPage) return;
        renderedPages.delete(pageIndex);
        renderedPage.renderTask?.cancel();
        renderedPage.canvas.remove();
        window.pdfPageSources.delete(renderedPage.canvas);

        const cleanupPage = () => {
            renderedPage.canvas.width = 0;
            renderedPage.canvas.height = 0;
            renderedPage.page.cleanup();
        };

        if (renderedPage.renderTask) {
            renderedPage.renderTask.promise.catch(() => {}).finally(cleanupPage);
        } else {
            cleanupPage();
        }
    }

    function sizeViewerToCurrentPage() {
        const renderedPage = renderedPages.get(currentPageIndex);
        if (!renderedPage) return;

        const pageHeight = renderedPage.canvas.style.height;
        viewer.style.height = pageHeight;
        slides.forEach((slide) => {
            slide.style.height = pageHeight;
        });
    }

    function updateNavigation() {
        const currentPage = currentPageIndex + 1;

        if (pageStatus) {
            pageStatus.replaceChildren();
            pageStatus.setAttribute(
                "aria-label",
                `Page ${currentPage} of ${pageCount}`
            );
            appendNumber(currentPage);
            appendSeparator("/");
            appendNumber(pageCount);
        }
        if (previousButton) previousButton.disabled = currentPageIndex === 0;
        if (nextButton) nextButton.disabled = currentPageIndex >= pageCount - 1;

        if (!mobile.matches) {
            slides.forEach((slide, index) => {
                slide.hidden = index !== currentPageIndex;
            });
        }

        sizeViewerToCurrentPage();
    }

    async function renderPage(pageIndex) {
        if (renderedPages.has(pageIndex) || !desiredPages.has(pageIndex)) return;

        const page = await pdf.getPage(pageIndex + 1);
        if (!desiredPages.has(pageIndex)) {
            page.cleanup();
            return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const availableHeight = Math.max(
            120,
            window.innerHeight - (mobile.matches ? 280 : 200)
        );
        const scale = Math.min(
            viewer.clientWidth / baseViewport.width,
            availableHeight / baseViewport.height
        );
        const viewport = page.getViewport({ scale });
        const devicePixelRatio = window.devicePixelRatio || 1;
        const maxOutputScale = mobile.matches
            ? Math.min(devicePixelRatio, 1.25)
            : Math.min(devicePixelRatio, 1.5);
        const outputScale = Math.min(
            maxOutputScale,
            4096 / viewport.width,
            4096 / viewport.height
        );
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        const renderedPage = { page, canvas, renderTask: null };

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.className = "pdf-page";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `PDF page ${pageIndex + 1}`);
        canvas.title = "Tap to zoom and pan";
        window.pdfPageSources.set(canvas, page);
        slides[pageIndex].appendChild(canvas);
        renderedPages.set(pageIndex, renderedPage);

        if (pageIndex === currentPageIndex) {
            viewer.style.height = `${viewport.height}px`;
            slides.forEach((slide) => {
                slide.style.height = `${viewport.height}px`;
            });
        }

        renderedPage.renderTask = page.render({
            canvasContext: context,
            viewport,
            transform: outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null
        });

        try {
            await renderedPage.renderTask.promise;
        } catch (error) {
            removeRenderedPage(pageIndex, renderedPage);
            if (error.name !== "RenderingCancelledException") throw error;
            return;
        }

        if (!desiredPages.has(pageIndex)) {
            removeRenderedPage(pageIndex, renderedPage);
        }
    }

    function renderPageWindow() {
        const pageIndexes = mobile.matches
            ? [currentPageIndex, currentPageIndex + 1]
                .filter((pageIndex) => pageIndex < pageCount)
            : [currentPageIndex];
        desiredPages = new Set(pageIndexes);

        for (const [pageIndex, renderedPage] of renderedPages) {
            if (!desiredPages.has(pageIndex)) {
                removeRenderedPage(pageIndex, renderedPage);
            }
        }

        renderQueue = renderQueue.then(async () => {
            for (const pageIndex of pageIndexes) {
                if (desiredPages.has(pageIndex)) await renderPage(pageIndex);
            }
            updateNavigation();
            delete pdfDocument.dataset.renderError;
        }).catch((error) => {
            if (error.name !== "RenderingCancelledException") {
                pdfDocument.dataset.renderError = "true";
            }
        });

        return renderQueue;
    }

    async function renderPdf() {
        try {
            if (!pdf) {
                if (!pdfLoading) {
                    pdfLoading = pdfjsLib.getDocument({
                        url: pdfDocument.dataset.pdf,
                        disableAutoFetch: true,
                        disableStream: true,
                        rangeChunkSize: 65536
                    }).promise;
                }

                pdf = await pdfLoading;
                pageCount = pdf.numPages;
                currentPageIndex = Math.min(currentPageIndex, pageCount - 1);
                buildSlides();
            }

            for (const [pageIndex, renderedPage] of renderedPages) {
                removeRenderedPage(pageIndex, renderedPage);
            }
            viewer.scrollLeft = currentPageIndex * viewer.clientWidth;
            updateNavigation();
            await renderPageWindow();
            delete pdfDocument.dataset.loadError;
        } catch {
            pdfDocument.dataset.loadError = "true";
        }
    }

    async function navigatePage(amount) {
        const nextPageIndex = Math.max(
            0,
            Math.min(pageCount - 1, currentPageIndex + amount)
        );
        if (nextPageIndex === currentPageIndex) return;
        currentPageIndex = nextPageIndex;

        if (mobile.matches) {
            viewer.scrollTo({
                left: currentPageIndex * viewer.clientWidth,
                behavior: "smooth"
            });
            renderPageWindow();
        } else {
            updateNavigation();
            await renderPageWindow();
            const renderedPage = renderedPages.get(currentPageIndex);
            if (!renderedPage) return;

            window.dispatchEvent(new CustomEvent("pdf-page-navigated", {
                detail: {
                    document: pdfDocument,
                    page: renderedPage.page,
                    canvas: renderedPage.canvas
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

        const nextPageIndex = Math.max(
            0,
            Math.min(
                pageCount - 1,
                Math.round(viewer.scrollLeft / viewer.clientWidth)
            )
        );
        if (nextPageIndex === currentPageIndex) return;

        currentPageIndex = nextPageIndex;
        updateNavigation();
        renderPageWindow();
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

    window.addEventListener("pageshow", () => {
        if (!mobile.matches) return;

        currentPageIndex = 0;
        viewer.scrollLeft = 0;
        updateNavigation();
        renderPageWindow();
    });

    if ("IntersectionObserver" in window) {
        const renderObserver = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                renderPageWindow();
                return;
            }

            desiredPages = new Set();
            for (const [pageIndex, renderedPage] of renderedPages) {
                removeRenderedPage(pageIndex, renderedPage);
            }
        }, { rootMargin: "200px 0px" });
        renderObserver.observe(pdfDocument);
    }

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderPdf, 180);
    });

    renderPdf();
}

