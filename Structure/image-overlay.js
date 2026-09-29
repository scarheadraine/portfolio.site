document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("image-overlay");
    const overlayImage = overlay.querySelector(".overlay-image");
    const overlayDescription = overlay.querySelector(".overlay-description");
    const closeButton = document.getElementById("close-overlay");

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let dragPointerId = null;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let overlayRenderId = 0;
    let overlayPdfDocument = null;
    const pinchPointers = new Map();

    function render() {
        overlayImage.style.transform =
            `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    }

    function getImageCenterOffset() {
        const imageRect = overlayImage.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();

        return {
            x: imageRect.left + imageRect.width / 2
                - (overlayRect.left + overlayRect.width / 2) - panX,
            y: imageRect.top + imageRect.height / 2
                - (overlayRect.top + overlayRect.height / 2) - panY
        };
    }

    function reset() {
        scale = 1;
        panX = 0;
        panY = 0;
        dragging = false;
        moved = false;
        dragPointerId = null;
        pinchStartDistance = 0;
        pinchPointers.clear();
        render();
    }

    async function renderPdfOverlayPage(page, renderId) {
        const pageViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(
            window.innerWidth * 0.9 / pageViewport.width,
            window.innerHeight * 0.9 / pageViewport.height
        );
        const devicePixelRatio = window.devicePixelRatio || 1;
        const mobile = window.matchMedia("(max-width: 768px)").matches;
        const outputScale = mobile
            ? Math.min(devicePixelRatio, 1.5)
            : devicePixelRatio * 2;
        const viewport = page.getViewport({ scale: fitScale * outputScale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        try {
            await page.render({ canvasContext: context, viewport }).promise;
            if (renderId !== overlayRenderId || !overlay.classList.contains("is-open")) return;

            overlayImage.src = canvas.toDataURL("image/png");
        } finally {
            canvas.width = 0;
            canvas.height = 0;
        }
    }

    function openImage(image) {
        const renderId = ++overlayRenderId;
        const page = image instanceof HTMLCanvasElement
            ? window.pdfPageSources?.get(image)
            : null;
        const descriptionSource = image.dataset.overlayDescription
            || image.closest(".pdf-document")?.dataset.overlayDescription;
        const hasDescription = Boolean(descriptionSource);

        if (descriptionSource) {
            overlayDescription.src = descriptionSource;
        } else {
            overlayDescription.removeAttribute("src");
        }

        overlayPdfDocument = page ? image.closest(".pdf-document") : null;
        overlayImage.src = image instanceof HTMLCanvasElement
            ? image.toDataURL("image/png")
            : image.src;
        overlayImage.alt = image.alt || image.getAttribute("aria-label") || "";
        overlay.classList.toggle("has-description", hasDescription);
        overlay.classList.toggle(
            "has-landscape-description",
            hasDescription && image.naturalWidth > image.naturalHeight
        );
        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");
        reset();

        if (page) renderPdfOverlayPage(page, renderId).catch(() => {});
    }

    function closeImage() {
        overlayRenderId++;
        overlayPdfDocument = null;
        overlayDescription.removeAttribute("src");
        overlay.classList.remove("has-description", "has-landscape-description");
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        reset();
    }

    window.addEventListener("pdf-page-navigated", (event) => {
        if (!overlayPdfDocument || !overlay.classList.contains("is-open")) return;
        if (event.detail.document !== overlayPdfDocument) return;

        const renderId = ++overlayRenderId;
        overlayImage.src = event.detail.canvas.toDataURL("image/png");
        overlayImage.alt = event.detail.canvas.getAttribute("aria-label") || "PDF page";
        reset();
        renderPdfOverlayPage(event.detail.page, renderId).catch(() => {});
    });

    document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const image = event.target.closest(".illustration-image, .pdf-page");
        if (image) openImage(image);
    });

    overlay.addEventListener("wheel", (event) => {
        event.preventDefault();

        const oldScale = scale;
        const newScale = Math.max(
            1,
            Math.min(12, oldScale * (event.deltaY < 0 ? 1.2 : 0.8))
        );

        if (newScale === oldScale) return;

        const rect = overlay.getBoundingClientRect();
        const cursorX = event.clientX - (rect.left + rect.width / 2);
        const cursorY = event.clientY - (rect.top + rect.height / 2);
        const centerOffset = getImageCenterOffset();
        const ratio = newScale / oldScale;

        panX = cursorX - centerOffset.x
            - (cursorX - centerOffset.x - panX) * ratio;
        panY = cursorY - centerOffset.y
            - (cursorY - centerOffset.y - panY) * ratio;
        scale = newScale;

        if (scale === 1) {
            panX = 0;
            panY = 0;
        }

        render();
    }, { passive: false });

    overlayImage.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") {
            pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (event.isTrusted) overlayImage.setPointerCapture(event.pointerId);

            if (pinchPointers.size === 2) {
                const [first, second] = [...pinchPointers.values()];
                pinchStartDistance = Math.hypot(second.x - first.x, second.y - first.y);
                pinchStartScale = scale;
                dragging = false;
                dragPointerId = null;
                moved = true;
                overlayImage.classList.remove("is-dragging");
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }

        if (event.button !== 0 || scale <= 1 || pinchPointers.size > 1) return;

        event.preventDefault();
        event.stopPropagation();

        dragging = true;
        moved = false;
        startX = event.clientX;
        startY = event.clientY;
        startPanX = panX;
        startPanY = panY;
        dragPointerId = event.pointerId;

        if (event.isTrusted) overlayImage.setPointerCapture(event.pointerId);
        overlayImage.classList.add("is-dragging");
    });

    overlayImage.addEventListener("pointermove", (event) => {
        if (pinchPointers.has(event.pointerId)) {
            pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (pinchPointers.size === 2 && pinchStartDistance > 0) {
                const [first, second] = [...pinchPointers.values()];
                const distance = Math.hypot(second.x - first.x, second.y - first.y);
                const nextScale = Math.max(
                    1,
                    Math.min(12, pinchStartScale * distance / pinchStartDistance)
                );
                const rect = overlay.getBoundingClientRect();
                const centerX = (first.x + second.x) / 2 - (rect.left + rect.width / 2);
                const centerY = (first.y + second.y) / 2 - (rect.top + rect.height / 2);
                const centerOffset = getImageCenterOffset();
                const ratio = nextScale / scale;

                panX = centerX - centerOffset.x
                    - (centerX - centerOffset.x - panX) * ratio;
                panY = centerY - centerOffset.y
                    - (centerY - centerOffset.y - panY) * ratio;
                scale = nextScale;

                if (scale === 1) {
                    panX = 0;
                    panY = 0;
                }

                moved = true;
                render();
                event.preventDefault();
                return;
            }
        }

        if (!dragging || event.pointerId !== dragPointerId) return;

        event.preventDefault();

        const moveX = event.clientX - startX;
        const moveY = event.clientY - startY;

        if (Math.abs(moveX) > 3 || Math.abs(moveY) > 3) {
            moved = true;
        }

        panX = startPanX + moveX;
        panY = startPanY + moveY;
        render();
    });

    function stopDragging(event) {
        if (pinchPointers.has(event.pointerId)) {
            pinchPointers.delete(event.pointerId);
            if (pinchPointers.size < 2) pinchStartDistance = 0;
        }

        if (event.pointerId === dragPointerId) {
            dragging = false;
            dragPointerId = null;
            overlayImage.classList.remove("is-dragging");
        }

        if (overlayImage.hasPointerCapture(event.pointerId)) {
            overlayImage.releasePointerCapture(event.pointerId);
        }
    }

    overlayImage.addEventListener("pointerup", stopDragging);
    overlayImage.addEventListener("pointercancel", stopDragging);

    overlayImage.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    overlayImage.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    closeButton.addEventListener("click", closeImage);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay && !moved) {
            closeImage();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeImage();
        }
    });
});