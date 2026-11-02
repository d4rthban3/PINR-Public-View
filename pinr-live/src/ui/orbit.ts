import type { Evidence } from "../../server/evidence";
import type { Item } from "../world/model";
import { pinchBig, pinchScene, pinchSmall, poseOf } from "./pinch";
import { createRing, type Ring } from "./orbitring";
import { gateNotChecked, gateView, grokbotView, orbitGroups, pinraiView, type OrbitGroup } from "../world/orbit";

/**
 *
 * under the picture each group's facts, each with ● (read on chain) or ○ (reported), its age and its link. The paper trail comes from the feed
 * server's `/api/evidence` (server/evidence.ts). Words are the doctor's ("not checked yet"), never a verdict.
 */
export interface OrbitOptions {
  /** The coin's evidence; `null` when there is none yet or it could not be read. */
  fetchEvidence(address: string): Promise<Evidence | null>;
}
export interface Orbit {
  el: HTMLElement;
  setItem(it: Item | null | undefined): void;
}

const SHOWN = 8;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
export function createOrbit(opts: OrbitOptions): Orbit {
  const root = el("section", "orbit");
  root.hidden = true;
  const head = el("h2", "orbith", "Evidence");
  const note = el("p", "orbitnote", "What PINR has found linked to this coin. ● read on chain · ○ reported by the source named. A group says “not checked yet” when nothing is recorded for it.");
  const gate = el("div", "orbgate");
  gate.hidden = true;
  const figure = el("div", "orbitfig");
  const opened = el("div", "orbopenhost");
  const lists = el("div", "orbitlists");
  const ai = el("div", "orbgate orbai");
  ai.hidden = true;
  const grok = el("div", "orbgate orbai orbgrok");
  grok.hidden = true;
  root.append(head, note, gate, ai, grok, figure, opened, lists);

  let item: Item | null = null;
  let epoch = 0;

  let ringHandle: Ring | null = null;
  function ring(groups: OrbitGroup[], loading: boolean): HTMLElement {
    ringHandle?.destroy();
    ringHandle = createRing({
      ticker: item?.raw?.ticker ?? "",
      groups,
      loading,
      onOpen: (g, fact) => openGroup(g, fact),
      onView: (g) => {
        if (!g) opened.replaceChildren();
      },
    });
    return ringHandle.el;
  }

  /** Opens a ring (all its lines) or one fact under the picture; the same rows as the lists below, so nothing is told twice differently. */
  function openGroup(g: OrbitGroup, fact: number | null): void {
    const shown: OrbitGroup = fact === null ? g : { ...g, facts: [g.facts[fact]!] };
    const box = listOf(shown, false);
    box.classList.add("orbopen");
    const close = el("button", "orbmore", "Close");
    close.type = "button";
    close.addEventListener("click", () => opened.replaceChildren());
    box.append(close);
    opened.replaceChildren(box);
    box.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }

  function listOf(g: OrbitGroup, loading: boolean): HTMLElement {
    const box = el("div", "orbgroup");
    box.setAttribute("data-group", g.id);
    const h = el("h3", "orbgh");
    h.append(el("span", undefined, g.label), el("em", undefined, g.facts.length ? String(g.facts.length) : ""));
    box.append(h);
    if (!g.facts.length) {
      if (loading) {
        const p = el("p", "orbnone orbreading");
        p.append(pinchScene("reading-scroll", 56), el("span", undefined, "Reading…"));
        box.append(p);
      } else box.append(el("p", "orbnone", g.empty));
      return box;
    }
    const rows = el("div", "orbrows");
    const draw = (all: boolean): void => {
      rows.replaceChildren();
      for (const f of all ? g.facts : g.facts.slice(0, SHOWN)) {
        const row = el("div", "orbrow");
        //
        const dot = el("span", `orbd ${f.onchain ? "on" : "off"}`, f.onchain ? "●" : "○");
        dot.title = f.onchain ? "Read on chain" : "Reported, not read on chain";
        const text = el("span", "orbtext", f.text);
        const meta = el("span", "orbmeta", [f.happenedText, f.readText, f.source, f.onchain && !f.link ? "no receipt link yet" : ""].filter(Boolean).join(" · "));
        row.append(dot, text, meta);
        if (f.link) {
          const a = el("a", "orblink", "see it");
          a.href = f.link;
          a.target = "_blank";
          a.rel = "noopener noreferrer nofollow";
          row.append(a);
        }
        rows.append(row);
      }
      if (!all && g.facts.length > SHOWN) {
        const more = el("button", "orbmore", `Show all ${g.facts.length}`);
        more.type = "button";
        more.addEventListener("click", () => draw(true));
        rows.append(more);
      }
    };
    draw(false);
    box.append(rows);
    return box;
  }

  /**
   * The gate's result: what was observed at launch, in plain words, with links. While the file is still loading nothing shows; once it has loaded with no
   *
   */
  function drawGate(ev: Evidence | null, loaded = false): void {
    const v = gateView(ev?.gate, Date.now());
    if (gateNotChecked(ev, loaded)) {
      gate.hidden = false;
      return gate.replaceChildren(el("h3", "orbgateh", "At launch"), el("p", "orbgatehead", "Not checked yet."));
    }
    gate.hidden = v === null;
    if (!v) return gate.replaceChildren();
    const h = el("h3", "orbgateh", "At launch");
    const first = el("p", "orbgatehead", v.headline);
    const list = el("div", "orbgatelist");
    for (const l of v.lines) {
      const row = el("div", "orbgaterow");
      row.append(el("span", "orbgatewords", l.words));
      if (l.when) row.append(el("span", "orbgatewhen", l.when));
      for (const k of l.links) {
        const a = el("a", "orblink", k.label);
        a.href = k.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
        row.append(a);
      }
      list.append(row);
    }
    gate.replaceChildren(h, first, list);
    if (v.others.length) {
      const box = el("div", "orbgateothers");
      box.append(el("span", "orbgateotherl", "The creator's other coins"));
      for (const o of v.others.slice(0, 5)) {
        if (o.href) {
          const a = el("a", "orblink", `${o.label}${o.when ? ` · ${o.when}` : ""}`);
          a.href = o.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer nofollow";
          box.append(a);
        } else box.append(el("span", "orbgatecoin", `${o.label}${o.when ? ` · ${o.when}` : ""}`));
      }
      gate.append(box);
    }
    if (v.readText) gate.append(el("p", "orbgateread", v.readText));
  }

  /** PINRai's reading: observed words, each with the receipts it stands on. Hidden when the file has none. */
  function drawPinrai(ev: Evidence | null): void {
    const v = pinraiView(ev?.pinrai, Date.now());
    ai.hidden = v === null;
    if (!v) return ai.replaceChildren();
    const list = el("div", "orbgatelist");
    for (const l of v.lines) {
      const row = el("div", "orbgaterow orbairow");
      const top = el("div", "orbaitop");
      top.append(pinchSmall(poseOf(l.words)), el("span", "orbgatewords", l.words));
      row.append(top);
      if (l.reviewed) row.append(el("span", "orbgatewhen", "second look done"));
      for (const r of l.receipts) {
        const rc = el("span", "orbaireceipt", `${r.mark} `);
        if (r.href) {
          const a = el("a", "orblink", r.text);
          a.href = r.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer nofollow";
          rc.append(a);
        } else rc.append(r.text);
        if (r.when) rc.append(` · ${r.when}`);
        if (r.mark === "●" && !r.href) rc.append(" · no receipt link yet");
        row.append(rc);
      }
      list.append(row);
    }
    const head = el("div", "orbaihead");
    const hw = el("div", "orbaihw");
    hw.append(el("h3", "orbgateh", "PINRai's reading"), el("p", "orbgatehead", v.headline));
    head.append(pinchBig(), hw);
    ai.replaceChildren(head, list);
    if (v.readText) ai.append(el("p", "orbgateread", v.readText));
  }

  /** GrokBot (X, browser): its checked findings, each ○ reported, with the link that opened and the time. Hidden when the file has none. */
  function drawGrokbot(ev: Evidence | null): void {
    const v = grokbotView(ev?.grokbot, Date.now());
    grok.hidden = v === null;
    if (!v) return grok.replaceChildren();
    const list = el("div", "orbgatelist");
    for (const l of v.lines) {
      const row = el("div", "orbgaterow orbairow");
      row.append(el("span", "orbaireceipt", "○ "), el("span", "orbgatewords", `${l.kind}: ${l.text}`));
      if (l.note) row.append(el("span", "orbgatewhen", l.note));
      const a = el("a", "orblink", "View link");
      a.href = l.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer nofollow";
      row.append(a);
      if (l.when) row.append(el("span", "orbgatewhen", ` · opened ${l.when}`));
      list.append(row);
    }
    grok.replaceChildren(el("h3", "orbgateh", v.source), el("p", "orbgatehead", "Reported, not read on chain. Each finding is the link that opened:"), list);
    if (v.readText) grok.append(el("p", "orbgateread", v.readText));
  }

  function render(ev: Evidence | null, loading: boolean): void {
    drawGate(loading ? null : ev, !loading);
    drawPinrai(loading ? null : ev);
    drawGrokbot(loading ? null : ev);
    const groups = orbitGroups(ev, Date.now());
    opened.replaceChildren();
    figure.replaceChildren(ring(groups, loading));
    lists.replaceChildren(...groups.map((g) => listOf(g, loading)));
  }

  function setItem(it: Item | null | undefined): void {
    const next = it ?? null;
    if (next === item && !root.hidden) return;
    item = next;
    const my = ++epoch;
    //
    if (!next || !next.address || (next.status === "flag" && next.flagKind === "VAMP")) {
      ringHandle?.destroy();
      ringHandle = null;
      root.hidden = true;
      return;
    }
    root.hidden = false;
    render(null, true);
    void opts.fetchEvidence(next.address).then((ev) => {
      if (my === epoch) render(ev, false);
    });
  }

  return { el: root, setItem };
}
