let frame = 0;
let images = new Array(8);
let rainList = [];
let timer;
let sketchReadySent = false;

let framespeed = 200;
let playerlocX = 200;
let playerlocY = 100;
let dropTimer = 400;
let playerspeed = 2;
let playerDir = true;
let sitePreviewSwitcherReady = false;

const spriteWidth = 100;
const canvasHeight = 400;

function getCanvasWidth() {
  return Math.max(1, window.innerWidth);
}

function preload() {
  images[0] = loadImage(
    "assets/frame0000.png",
    undefined,
    () => window.dispatchEvent(new Event("sketch-failed"))
  );
}

function loadRemainingFrames(index = 1) {
  if (index >= images.length) return;

  const loadNextFrame = () => {
    images[index] = loadImage(
      `assets/frame000${index}.png`,
      () => loadRemainingFrames(index + 1),
      () => loadRemainingFrames(index + 1)
    );
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(loadNextFrame, { timeout: 1000 });
  } else {
    window.setTimeout(loadNextFrame, 100);
  }
}

function setupSitePreviewSwitcher() {
  const preview = document.querySelector(".site-preview-frame");
  const trackpad = document.querySelector(".trackpad-switch");
  const visitLink = document.querySelector(".visit-link");
  const switchToggle = document.querySelector(".site-switch-toggle");
  if (!preview || !trackpad || sitePreviewSwitcherReady) return;

  sitePreviewSwitcherReady = true;

  const sites = [
    { url: "https://fortified.pro", name: "Fortified Pro" },
    { url: "https://fedderbuilding.com", name: "Fedder Building" }
  ];
  let siteIndex = 0;

  function updateVisitLink() {
    if (!visitLink) return;

    const site = sites[siteIndex];
    visitLink.href = site.url;
    visitLink.setAttribute("aria-label", `Visit ${site.name} website`);
  }

  trackpad.addEventListener("click", () => {
    siteIndex = (siteIndex + 1) % sites.length;
    const site = sites[siteIndex];

    preview.src = site.url;
    preview.title = `${site.name} website preview`;
    updateVisitLink();
    trackpad.setAttribute(
      "aria-label",
      `Switch to ${sites[(siteIndex + 1) % sites.length].name} website preview`
    );
    switchToggle?.setAttribute(
      "aria-label",
      trackpad.getAttribute("aria-label")
    );
  });

  updateVisitLink();
  switchToggle?.addEventListener("click", () => trackpad.click());
}

function keepPlayerInsideCanvas() {
  playerlocX = constrain(playerlocX, 0, width);
}

function setup() {
  const canvas = createCanvas(getCanvasWidth(), canvasHeight);

  canvas.parent("canvas-container");
  canvas.style("display", "block");
  canvas.style("width", "100vw");
  canvas.style("max-width", "none");

  timer = millis() + framespeed;
  imageMode(CENTER);
  keepPlayerInsideCanvas();
  setupSitePreviewSwitcher();
}

function windowResized() {
  resizeCanvas(getCanvasWidth(), canvasHeight);
  keepPlayerInsideCanvas();
}

function draw() {
  background(255);

  dropTimer -= deltaTime;

  if (dropTimer <= 0) {
    dropTimer = 450;

    for (let i = 0; i < 3; i++) {
      rainList.push(
        new rain(
          constrain(playerlocX + random(-70, 70), 0, width),
          100 + random(-10, 10)
        )
      );
    }
  }

  for (const drop of rainList) {
    drop.move();
    drop.display();
  }

  for (let i = rainList.length - 1; i >= 0; i--) {
    if (rainList[i].remove) {
      rainList.splice(i, 1);
    }
  }

  if (millis() > timer) {
    timer = millis() + framespeed;
    const nextFrame = (frame + 1) % images.length;
    if (images[nextFrame]?.width) frame = nextFrame;
  }

  const imgObj = images[frame];

  if (!imgObj || !imgObj.width) {
    return;
  }

  playerlocX += playerDir ? playerspeed : -playerspeed;

  if (playerlocX >= width) {
    playerlocX = width;
    playerDir = false;
  }

  if (playerlocX <= 0) {
    playerlocX = 0;
    playerDir = true;
  }

  const spriteHeight = (imgObj.height * spriteWidth) / imgObj.width;

  push();
  translate(playerlocX, playerlocY);

  if (!playerDir) {
    scale(-1, 1);
  }

  image(imgObj, 0, 220, spriteWidth, spriteHeight);
  pop();

  if (!sketchReadySent) {
    sketchReadySent = true;
    window.sketchHasRendered = true;
    window.dispatchEvent(new Event("sketch-ready"));
    loadRemainingFrames();
  }
}

class rain {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.lineLength = random(10, 18);
    this.speed = random(4, 7);
    this.timer = random(100, 200);
    this.remove = false;
    this.splat = false;
    this.splatHeight = random(height - 20, height - 30);
  }

  move() {
    if (!this.splat) {
      this.y += this.speed;
    }

    if (this.y > this.splatHeight) {
      this.splat = true;
    }
  }

  display() {
    stroke(0);
    strokeWeight(1.2);
    noFill();

    this.timer--;

    if (this.timer <= 0) {
      this.remove = true;
    }

    if (this.splat) {
      line(this.x - 3, this.y, this.x + 3, this.y);
    } else {
      line(this.x, this.y, this.x, this.y + this.lineLength);
    }
  }
}

document.addEventListener("DOMContentLoaded", setupSitePreviewSwitcher);