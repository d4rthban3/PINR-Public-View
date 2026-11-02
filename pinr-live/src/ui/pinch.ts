/**
 *
 * (2.5D) beside each reading, in the pose that matches its fixed word. The words themselves are unchanged: the picture only agrees with them.
 * Both themes are in the page and the stylesheet shows the one for the theme (art/pinch-*.svg, art/pinch-3d-hero-*.png).
 */
export type Pose = "observed" | "not-checked-yet" | "closer-look";

/** The pose for one reading's words: "worth a closer look" and "not checked yet" have their own, everything else seen is "observed". */
export function poseOf(words: string): Pose {
  if (/worth a closer look/i.test(words)) return "closer-look";
  if (/not (been )?checked yet|not read yet/i.test(words)) return "not-checked-yet";
  return "observed";
}

function img(src: string, cls: string, w: number, h: number): HTMLImageElement {
  const i = document.createElement("img");
  i.src = src;
  i.className = cls;
  i.width = w;
  i.height = h;
  i.alt = "";
  i.decoding = "async";
  i.loading = "lazy";
  i.setAttribute("aria-hidden", "true");
  return i;
}

/** A small Pinch in a pose (2.5D), for beside a reading. */
export function pinchSmall(pose: Pose): HTMLElement {
  const s = document.createElement("span");
  s.className = "pinch pinchsmall";
  s.append(img(`/art/pinch-${pose}-dark.svg`, "pdark", 28, 28), img(`/art/pinch-${pose}-light.svg`, "plight", 28, 28));
  return s;
}

/** The big Pinch (3D hero), for the head of PINRai's reading. */
export function pinchBig(): HTMLElement {
  const s = document.createElement("span");
  s.className = "pinch pinchbig";
  s.append(img("/art/pinch-3d-hero-dark.png", "pdark", 96, 110), img("/art/pinch-3d-hero-light.png", "plight", 96, 110));
  return s;
}

/** The 2.5D scenes for empty and waiting places (ArtDesign's picks, 1 Nov): the art sits beside the words and never replaces them. */
export type Scene = "waving-hello" | "magnifier-links" | "sitting-waiting" | "sticker-calm" | "reading-scroll";

export function pinchScene(scene: Scene, px = 80): HTMLElement {
  const s = document.createElement("span");
  s.className = "pinch pinchscene";
  s.style.setProperty("--ps", `${px}px`);
  s.append(img(`/art/pinch-${scene}-dark.svg`, "pdark", px, px), img(`/art/pinch-${scene}-light.svg`, "plight", px, px));
  return s;
}

/** The big Pinch banner (3D) for the head of the PINR guide, full width of its header (the picture is 3 : 1). */
export function pinchBanner(): HTMLElement {
  const s = document.createElement("span");
  s.className = "pinch pinchbanner";
  s.append(img("/art/pinch-3d-banner-dark.png", "pdark", 1200, 400), img("/art/pinch-3d-banner-light.png", "plight", 1200, 400));
  return s;
}
