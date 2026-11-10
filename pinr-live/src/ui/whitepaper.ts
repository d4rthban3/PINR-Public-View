/**
 * The Whitepaper page: a full page over the view, opened ONLY from the Whitepaper symbol in the header (it is not on
 *
 * the guide's section look, and the public "How PINR works" body map at the bottom (wide or phone, dark or light).
 */
import type { GuideBlock } from "./guidecopy";
import { WHITEPAPER_SECTIONS } from "./whitepapercopy";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
/** Text with **bold** pieces, built from text nodes only (the copy is never parsed as HTML). */
function richText(text: string): Node[] {
  return text.split("**").map((part, i) => (i % 2 === 1 ? el("strong", undefined, part) : document.createTextNode(part)));
}
function blockNode(b: GuideBlock): HTMLElement {
  const node = el(b.kind === "li" ? "li" : "p", b.kind === "li" ? "gdli" : "gdp");
  if (b.lead) node.append(el("b", "gdlead", b.lead), " ");
  node.append(...richText(b.text));
  return node;
}
function bodyMap(): HTMLElement {
  const box = el("div", "pinch wpmap");
  for (const theme of ["dark", "light"] as const) {
    const pic = el("picture", theme === "dark" ? "pdark" : "plight");
    const narrow = el("source");
    narrow.media = "(max-width: 640px)";
    narrow.srcset = `/art/bodymap-how-pinr-works-phone-${theme}.svg`;
    const img = el("img");
    img.src = `/art/bodymap-how-pinr-works-wide-${theme}.svg`;
    img.alt = "How PINR works: PINRai as the brain, and each reader and check as a part of the body that feeds it or serves you";
    img.loading = "lazy";
    img.decoding = "async";
    pic.append(narrow, img);
    box.append(pic);
  }
  return box;
}
function whitepaperNodes(): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const sec of WHITEPAPER_SECTIONS) {
    const s = el("section", "dssec gdsec");
    s.append(el("h2", "dsh", sec.title));
    let list: HTMLUListElement | null = null;
    for (const b of sec.blocks) {
      if (b.kind === "li") {
        if (!list) s.append((list = el("ul", "gdul")));
        list.append(blockNode(b));
      } else {
        list = null;
        s.append(blockNode(b));
      }
    }
    out.push(s);
  }
  out.push(bodyMap());
  return out;
}
export interface Whitepaper {
  el: HTMLElement;
  show(on: boolean): void;
  isOpen(): boolean;
}

export function createWhitepaper(onClose: () => void): Whitepaper {
  const root = document.createElement("div");
  root.id = "paperpage";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Whitepaper");
  root.innerHTML = `
    <div class="sscroll">
      <div class="stop">
        <button class="sback" type="button" aria-label="Close whitepaper">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <h1 class="stitle">Whitepaper</h1>
      </div>
      <div class="wpbody"></div>
    </div>`;
  root.querySelector(".wpbody")!.append(...whitepaperNodes());
  root.querySelector(".sback")!.addEventListener("click", onClose);
  document.body.append(root);
  let open = false;
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) onClose();
  });
  return {
    el: root,
    show(on) {
      open = on;
      root.classList.toggle("on", on);
      if (on) root.querySelector(".sscroll")!.scrollTop = 0;
    },
    isOpen: () => open,
  };
}
