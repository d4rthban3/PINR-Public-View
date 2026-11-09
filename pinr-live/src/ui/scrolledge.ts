/**
 *
 * (data-edge on the row: "r", "l" or "lr"; style.css draws the fade). A row that fits shows no fade. Cheap: it reads the row's size only when it scrolls, when the window is resized,
 * or when the row's content changes (the pill rows call `edge.update()` after they change).
 */
export interface ScrollEdge {
  update(): void;
}
export function scrollEdge(row: HTMLElement): ScrollEdge {
  let last = "";
  const update = (): void => {
    const max = row.scrollWidth - row.clientWidth;
    const e = max > 1 ? (row.scrollLeft > 1 ? (row.scrollLeft < max - 1 ? "lr" : "l") : "r") : "";
    if (e !== last) {
      last = e;
      if (e) row.dataset.edge = e;
      else delete row.dataset.edge;
    }
  };
  row.addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
  return { update };
}
