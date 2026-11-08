/**
 *
 * Shown only on a phone while the map is in view. Each tap is one smooth zoom step about the middle of the screen.
 */
export interface MapZoom {
  el: HTMLElement;
  /** Show or hide the buttons; writes nothing when nothing changed (called every frame). */
  setShown(shown: boolean): void;
}

/** One tap's zoom: the camera's zoom speed in log units per second; it settles at about this times 1/7, a factor of about 1.6. */
export const ZOOM_STEP_VZ = 3.3;

export function createMapZoom(onZoom: (dir: 1 | -1) => void): MapZoom {
  const el = document.createElement("div");
  el.className = "mapzoom";
  el.hidden = true;
  const make = (label: string, glyph: string, dir: 1 | -1): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mapzoomb";
    b.textContent = glyph;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onZoom(dir);
    });
    // a tap on a button is not a press on the map behind it
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    return b;
  };
  el.append(make("Zoom in on the map", "+", 1), make("Zoom out on the map", "−", -1));
  let shown = false;
  return {
    el,
    setShown(s) {
      if (s === shown) return;
      shown = s;
      el.hidden = !s;
    },
  };
}
