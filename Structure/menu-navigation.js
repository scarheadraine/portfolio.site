const destinations = {
    Front_end_development: {
        sectionId: "front-end-development",
        underline: "menubarfrontenddevelopmentunderline.svg",
        underlineScale: 0.98,
        markBounds: { x: 18.58, y: 80, width: 426.24, height: 27.12 },
        baselineY: 116.68,
        rotation: -0.19
    },
    Front_end: {
        sectionId: "front-end-development",
        underline: "menubarfrontenddevelopmentunderline.svg",
        underlineScale: 0.98,
        markBounds: { x: 18.58, y: 80, width: 426.24, height: 27.12 },
        baselineY: 116.68,
        rotation: -0.19
    },
    Illustration: {
        sectionId: "illustration",
        underline: "menubarillustrationunderline.svg",
        underlineScale: 1.78,
        markBounds: { x: 55.38, y: 90.06, width: 259.72, height: 27.38 },
        baselineY: 182.82,
        rotation: -1.05
    },
    Graphic_Design: {
        sectionId: "graphic-design",
        underline: "menubargraphicdesignunderline.svg"
    },
    Typography: {
        sectionId: "typography",
        underline: "menubartypographyunderline.svg",
        underlineScale: 2.3,
        markBounds: { x: 125.95, y: 80, width: 208.1, height: 14.02 }
    }
};

const menus = [
    document.getElementById("standard-menu"),
    document.getElementById("condensed-menu")
];

menus.forEach((menu) => {
    if (!menu) return;

    menu.addEventListener("load", () => {
        const svg = menu.contentDocument;
        if (!svg) return;

        const isDesktopMenu = menu.id === "standard-menu";
        const underlineImages = new Map();
        const sections = new Map();

        Object.entries(destinations).forEach(([svgId, destination]) => {
            const item = svg.getElementById(svgId);
            const section = document.getElementById(destination.sectionId);

            if (!item || !section) return;

            const bounds = item.getBBox();
            if (isDesktopMenu) {
                const underlineWidth = bounds.width * (destination.underlineScale ?? 1.25);
                const underlineHeight = underlineWidth * 160 / 460;
                const underline = svg.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "image"
                );

                underline.setAttribute(
                    "href",
                    new URL(destination.underline, svg.baseURI).href
                );

                if (destination.markBounds) {
                    const markScaleX = underlineWidth / 460;
                    const markScaleY = underlineHeight / 160;
                    const markCenterX = destination.markBounds.x + destination.markBounds.width / 2;
                    const markHeight = destination.markBounds.height * markScaleY;
                    const markTop = destination.baselineY === undefined
                        ? bounds.y + bounds.height + 6
                        : destination.baselineY + 1.5;
                    const centerX = bounds.x + bounds.width / 2;

                    underline.setAttribute("x", centerX - markCenterX * markScaleX);
                    underline.setAttribute("y", markTop - destination.markBounds.y * markScaleY);
                    underline.setAttribute(
                        "transform",
                        `rotate(${destination.rotation ?? 0} ${centerX} ${markTop + markHeight / 2})`
                    );
                } else {
                    underline.setAttribute(
                        "x",
                        bounds.x - (underlineWidth - bounds.width) / 2
                    );
                    underline.setAttribute(
                        "y",
                        bounds.y + bounds.height - underlineHeight * 0.59
                    );
                }

                underline.setAttribute("width", underlineWidth);
                underline.setAttribute("height", underlineHeight);
                underline.setAttribute("preserveAspectRatio", "none");
                underline.style.display = "none";
                underline.style.pointerEvents = "none";
                item.insertBefore(underline, item.firstChild);

                underlineImages.set(section.id, underline);
                sections.set(section.id, section);
            }

            const hitArea = svg.createElementNS(
                "http://www.w3.org/2000/svg",
                "rect"
            );

            hitArea.setAttribute("x", bounds.x);
            hitArea.setAttribute("y", bounds.y);
            hitArea.setAttribute("width", bounds.width);
            hitArea.setAttribute("height", bounds.height);
            hitArea.setAttribute("fill", "transparent");
            hitArea.setAttribute("pointer-events", "all");
            hitArea.style.cursor = "pointer";

            item.appendChild(hitArea);
            item.style.cursor = "pointer";

            item.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });
        });

        if (!isDesktopMenu) return;

        const desktop = window.matchMedia("(min-width: 769px)");

        function updateActiveUnderline() {
            let activeSectionId = null;
            const viewportMiddle = window.innerHeight / 2;

            sections.forEach((section, sectionId) => {
                const bounds = section.getBoundingClientRect();
                if (bounds.top <= viewportMiddle && bounds.bottom > viewportMiddle) {
                    activeSectionId = sectionId;
                }
            });

            underlineImages.forEach((underline, sectionId) => {
                underline.style.display = desktop.matches && sectionId === activeSectionId
                    ? "inline"
                    : "none";
            });
        }

        window.addEventListener("scroll", updateActiveUnderline, { passive: true });
        window.addEventListener("resize", updateActiveUnderline);
        desktop.addEventListener("change", updateActiveUnderline);
        updateActiveUnderline();
    });
});