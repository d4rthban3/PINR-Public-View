/**
 *
 * on the zoomed-out map a button hides the whole site so the background shows alone. It is never a trap: a clear button ("Back to the map") stays on screen the whole time, a tap or click
 * anywhere leaves it, Escape leaves it, the browser's Back and the phone's back leave it (the view is one entry in the site's own history trail, like a fullscreen card), leaving the map
 * leaves it, and a reload never opens in it (nothing about it is saved).
 */
export interface ArtView {
  /** The page left the map (or the map is not showing): the art view must not stay on. */
  sync(mapShowing: boolean): void;
  isOn(): boolean;
}
export interface ArtTrail {
  openOverlay(close: () => void): void;
  closeOverlay(): void;
}
export function createArtView(trail: ArtTrail): ArtView {
  const root = document.documentElement;
  const on = (): boolean => root.dataset.art === "1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "artbtn";
  btn.textContent = "See the background";
  btn.setAttribute("aria-label", "Hide the site and see the whole background by itself");
  const exit = document.createElement("button");
  exit.type = "button";
  exit.id = "artexit";
  exit.textContent = "Back to the map";
  exit.setAttribute("aria-label", "Leave the background view and go back to the map");
  document.body.append(btn, exit);
  function leaveNow(): void {
    if (on()) delete root.dataset.art;
  }
  function leave(): void {
    if (!on()) return;
    trail.closeOverlay(); // the history step back runs leaveNow through the overlay's own close
    // Never stuck: if the trail had nothing to step back (it should), the view still closes.
    setTimeout(leaveNow, 350);
  }
  btn.addEventListener("click", () => {
    if (on()) return;
    root.dataset.art = "1";
    trail.openOverlay(leaveNow);
  });
  exit.addEventListener("click", (e) => {
    e.stopPropagation();
    leave();
  });
  // A tap, click or touch anywhere leaves it (the site is hidden, so nothing else is under the finger).
  addEventListener("pointerdown", () => { if (on()) leave(); }, { capture: true, passive: true });
  addEventListener("keydown", (e) => {
    if (!on() || (e.key !== "Escape" && e.key !== "Esc")) return;
    e.stopPropagation(); // the page's own Escape (which would leave the map too) does not also run
    e.preventDefault();
    leave();
  }, true);
  return {
    sync(mapShowing) {
      if (!mapShowing && on()) leaveNow();
    },
    isOn: on,
  };
}
