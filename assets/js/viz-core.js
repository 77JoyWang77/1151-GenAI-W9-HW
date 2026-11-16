/* =====================================================================
   viz-core.js — 全站共用的「逐步動畫播放器」
   使用方式與 Frame 格式請見 CLAUDE.md 第 6 節。

   概念：每個視覺化 = 一連串 Frame（畫面快照）。
   主題腳本只負責「產生 frames」，播放、補間動畫、程式碼高亮、
   控制列全部由這裡處理。
   ===================================================================== */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const BASE_TWEEN = 420;   // 每步補間動畫毫秒數（1x 速度）
  const BASE_HOLD = 950;    // 自動播放時每步停留毫秒數（1x 速度）


  // ---------- 小工具 ----------
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => c && el.appendChild(c));
    return el;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ICONS = new URL("../icons.svg", document.currentScript.src).href;
  const iconHTML = (n) => `<svg class="icon" aria-hidden="true"><use href="${ICONS}#i-${n}"></use></svg>`;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Recorder：主題腳本用來收集 frames ----------
  class Recorder {
    constructor() { this.frames = []; }
    push(frame) { this.frames.push(clone(frame)); return this; }
  }

  // ---------- Player ----------
  class Player {
    /**
     * @param {HTMLElement} root  頁面上的 <div class="viz" data-viz="..."> 容器
     * @param {object} opts
     *   title:   動畫標題
     *   width, height: SVG viewBox 尺寸（預設 640 x 300）
     *   code:    虛擬碼 / C 程式碼，每行一個字串
     *   legend:  [[state, 說明], ...]
     */
    constructor(root, opts) {
      this.opts = Object.assign({ width: 640, height: 300, code: [], legend: [], title: "" }, opts);
      this.frames = [];
      this.index = 0;
      this.speed = 1;
      this.playing = false;
      this.timer = null;
      this.anim = null;
      this.state = {}; // id -> {x, y, o}，目前畫面上的位置（補間用）
      this.els = { node: {}, edge: {}, ptr: {}, label: {} };
      this._build(root);
    }

    _build(root) {
      root.classList.add("viz-card");
      root.tabIndex = 0;
      root.innerHTML = "";

      this.toolbar = h("div", { class: "viz-toolbar" });
      const head = h("div", { class: "viz-head" }, [
        h("div", { class: "viz-title", text: this.opts.title }),
        this.toolbar,
      ]);

      this.svg = svg("svg", { viewBox: `0 0 ${this.opts.width} ${this.opts.height}`, class: "viz-svg", role: "img", "aria-label": this.opts.title });
      const defs = svg("defs", {}, this.svg);
      const marker = svg("marker", { id: "arrow-" + Math.random().toString(36).slice(2, 8), viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
      svg("path", { d: "M0,0 L10,5 L0,10 z", class: "viz-arrowhead" }, marker);
      this.markerId = marker.id;
      this.layers = {
        label: svg("g", { class: "layer-labels" }, this.svg),
        edge: svg("g", { class: "layer-edges" }, this.svg),
        node: svg("g", { class: "layer-nodes" }, this.svg),
        ptr: svg("g", { class: "layer-pointers" }, this.svg),
      };

      // 靜態圖解：只要畫面，不要控制列、說明列、程式碼
      if (this.opts.static) {
        root.classList.remove("viz-card");
        root.removeAttribute("tabindex");
        root.appendChild(h("div", { class: "viz-stage" }, [this.svg]));
        return;
      }

      const stage = h("div", { class: "viz-stage" }, [this.svg]);
      const body = h("div", { class: "viz-body" + (this.opts.code.length ? "" : " no-code") }, [stage]);

      if (this.opts.code.length) {
        this.codeLines = this.opts.code.map((line, i) =>
          h("div", { class: "code-line" }, [h("span", { class: "ln", text: String(i + 1) }), h("span", { class: "lc", text: line || " " })])
        );
        this.codeBox = h("div", { class: "viz-code", "aria-label": "程式碼" }, this.codeLines);
        body.appendChild(this.codeBox);
      }

      this.caption = h("div", { class: "viz-caption", "aria-live": "polite" });

      const btn = (ico, title, fn) => h("button", { type: "button", class: "vbtn", title, "aria-label": title, html: iconHTML(ico), onclick: fn });
      this.btnPlay = btn("play", "播放 / 暫停（空白鍵）", () => this.toggle());
      this.slider = h("input", { type: "range", min: "0", max: "0", value: "0", class: "viz-slider", "aria-label": "步驟" });
      this.slider.addEventListener("input", () => { this.pause(); this.show(+this.slider.value); });
      this.counter = h("span", { class: "viz-counter", text: "0 / 0" });
      const speed = h("select", { class: "viz-speed", "aria-label": "速度" },
        [["0.5", "0.5×"], ["1", "1×"], ["2", "2×"], ["4", "4×"]].map(([v, t]) => h("option", { value: v, text: t })));
      speed.value = "1";
      speed.addEventListener("change", () => (this.speed = +speed.value));

      const controls = h("div", { class: "viz-controls" }, [
        btn("first", "第一步", () => { this.pause(); this.show(0); }),
        btn("prev", "上一步（←）", () => { this.pause(); this.show(this.index - 1); }),
        this.btnPlay,
        btn("next", "下一步（→）", () => { this.pause(); this.show(this.index + 1); }),
        btn("last", "最後一步", () => { this.pause(); this.show(this.frames.length - 1); }),
        this.slider, this.counter, speed,
      ]);

      const legend = this.opts.legend.length
        ? h("div", { class: "viz-legend" }, this.opts.legend.map(([s, t]) => h("span", { class: "lg" }, [h("i", { class: "sw s-" + s }), document.createTextNode(t)])))
        : null;

      this.controls = controls;
      [head, body, this.caption, controls, legend].forEach((el) => el && root.appendChild(el));

      root.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
        if (e.key === "ArrowRight") { this.pause(); this.show(this.index + 1); e.preventDefault(); }
        if (e.key === "ArrowLeft") { this.pause(); this.show(this.index - 1); e.preventDefault(); }
        if (e.key === " ") { this.toggle(); e.preventDefault(); }
      });
    }

    /** 切換右側程式碼（同一個動畫有多種操作時使用，例如 insert / delete） */
    setCode(lines) {
      if (!this.codeBox || this._codeKey === lines.join("\n")) return;
      this._codeKey = lines.join("\n");
      this.codeLines = lines.map((line, i) =>
        h("div", { class: "code-line" }, [h("span", { class: "ln", text: String(i + 1) }), h("span", { class: "lc", text: line || " " })])
      );
      this.codeBox.replaceChildren(...this.codeLines);
    }

    /** 載入一組新的 frames。autoplay = true 時從頭播放 */
    load(frames, { autoplay = true, start = 0 } = {}) {
      if (this.opts.static) { this.frames = frames; return this.show(0, true); }
      this.pause();
      this.frames = frames.length ? frames : [{ caption: "（沒有可顯示的步驟）" }];
      this.slider.max = String(this.frames.length - 1);
      this.show(start, true);
      if (autoplay && this.frames.length > 1) this.play();
    }

    toggle() { this.playing ? this.pause() : this.play(); }
    play() {
      // 只有一步時沒有東西可播：提示使用者先用上方按鈕執行操作
      if (this.frames.length <= 1) return this._nudge();
      if (this.index >= this.frames.length - 1) this.show(0);
      this.playing = true;
      this.btnPlay.innerHTML = iconHTML("pause");
      this._schedule();
    }
    _nudge() {
      const hint = iconHTML("pointer-up") + " 目前只有 1 步可以看。先用上方的按鈕執行一個操作（例如輸入數值後按第一個按鈕），產生步驟後就能播放。";
      if (!this.caption.querySelector(".viz-hint")) this.caption.insertAdjacentHTML("beforeend", `<div class="viz-hint">${hint}</div>`);
      this.toolbar.classList.remove("is-nudge");
      void this.toolbar.offsetWidth; // 重新觸發 CSS 動畫
      this.toolbar.classList.add("is-nudge");
    }

    pause() {
      this.playing = false;
      this.btnPlay.innerHTML = iconHTML("play");
      clearTimeout(this.timer);
    }
    _schedule() {
      clearTimeout(this.timer);
      if (!this.playing) return;
      this.timer = setTimeout(() => {
        if (this.index >= this.frames.length - 1) return this.pause();
        this.show(this.index + 1);
        this._schedule();
      }, (BASE_TWEEN + BASE_HOLD) / this.speed);
    }

    show(i, instant) {
      i = Math.max(0, Math.min(this.frames.length - 1, i));
      this.index = i;
      const f = this.frames[i];
      if (this.opts.static) return this._render(f, true);
      this.slider.value = String(i);
      this.controls.classList.toggle("is-single", this.frames.length <= 1);
      this.counter.textContent = `${i + 1} / ${this.frames.length}`;
      this.caption.innerHTML = f.caption || "";
      this._highlight(f.line);
      this._render(f, instant || reduceMotion);
    }

    _highlight(line) {
      if (!this.codeLines) return;
      const set = new Set([].concat(line || []));
      let first = null;
      this.codeLines.forEach((el, k) => {
        const on = set.has(k + 1);
        el.classList.toggle("is-active", on);
        if (on && !first) first = el;
      });
      if (first) {
        const box = this.codeBox;
        const top = first.offsetTop - box.clientHeight / 2 + first.clientHeight / 2;
        box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }

    // ---------- 繪製 ----------
    _render(f, instant) {
      cancelAnimationFrame(this.anim);
      // 上一次補間被打斷時，把還在淡出的元素直接移除，避免殘影
      (this._leaving || []).forEach(({ el }) => el.remove());
      this._leaving = [];
      const nodes = f.nodes || [], edges = f.edges || [], ptrs = f.pointers || [], labels = f.labels || [];
      const target = {};    // key -> {x,y,o}
      const from = {};

      // 節點 -----------------------------------------------------------
      const seen = { node: new Set(), edge: new Set(), ptr: new Set(), label: new Set() };
      const nodeById = {};
      nodes.forEach((n) => {
        nodeById[n.id] = n;
        const key = "n:" + n.id;
        seen.node.add(n.id);
        let g = this.els.node[n.id];
        if (!g) {
          g = svg("g", { class: "vnode" }, this.layers.node);
          g._shape = null;
          g._label = svg("text", { class: "vlabel", "text-anchor": "middle", "dominant-baseline": "central" }, g);
          g._sub = svg("text", { class: "vsub", "text-anchor": "middle" }, g);
          this.els.node[n.id] = g;
        }
        const shape = n.shape || "circle";
        if (!g._shape || g._shape._kind !== shape) {
          if (g._shape) g._shape.remove();
          g._shape = shape === "box"
            ? svg("rect", { rx: "8", ry: "8" })
            : svg("circle", {});
          g._shape._kind = shape;
          g.insertBefore(g._shape, g.firstChild);
        }
        const w = n.w || 46, hh = n.h || 40, r = n.r || 21;
        if (shape === "box") {
          g._shape.setAttribute("x", -w / 2); g._shape.setAttribute("y", -hh / 2);
          g._shape.setAttribute("width", w); g._shape.setAttribute("height", hh);
        } else g._shape.setAttribute("r", r);
        g._geom = { shape, w, h: hh, r };
        g.setAttribute("class", "vnode s-" + (n.state || "default"));
        g._label.textContent = n.label == null ? "" : n.label;
        g._sub.textContent = n.sub || "";
        g._sub.setAttribute("y", shape === "box" ? hh / 2 + 15 : r + 15);

        target[key] = { x: n.x, y: n.y, o: n.state === "ghost" ? 0.35 : 1 };
        from[key] = this.state[key] || { x: n.x, y: n.y + 14, o: 0 };
      });

      // 標籤 -----------------------------------------------------------
      labels.forEach((l) => {
        const key = "l:" + l.id;
        seen.label.add(l.id);
        let t = this.els.label[l.id];
        if (!t) {
          t = svg("text", {}, this.layers.label);
          this.els.label[l.id] = t;
        }
        t.setAttribute("class", "vtext " + (l.cls || ""));
        t.setAttribute("text-anchor", l.anchor || "middle");
        t.setAttribute("dominant-baseline", "central");
        t.textContent = l.text;
        target[key] = { x: l.x, y: l.y, o: 1 };
        from[key] = this.state[key] || { x: l.x, y: l.y, o: 0 };
      });

      // 邊 -------------------------------------------------------------
      edges.forEach((e) => {
        const id = e.from + "->" + e.to;
        seen.edge.add(id);
        let ln = this.els.edge[id];
        if (!ln) {
          ln = svg("line", {}, this.layers.edge);
          this.els.edge[id] = ln;
        }
        ln.setAttribute("class", "vedge s-" + (e.state || "default"));
        if (e.directed) ln.setAttribute("marker-end", `url(#${this.markerId})`);
        else ln.removeAttribute("marker-end");
        ln._e = e;
        target["e:" + id] = { x: 0, y: 0, o: 1 };
        from["e:" + id] = this.state["e:" + id] || { x: 0, y: 0, o: 0 };
      });

      // 指標 -----------------------------------------------------------
      ptrs.forEach((p) => {
        seen.ptr.add(p.id);
        let g = this.els.ptr[p.id];
        if (!g) {
          g = svg("g", { class: "vptr" }, this.layers.ptr);
          g._text = svg("text", { "text-anchor": "middle", "dominant-baseline": "central" }, g);
          g._arrow = svg("path", {}, g);
          this.els.ptr[p.id] = g;
        }
        g.setAttribute("class", "vptr s-" + (p.state || "default"));
        g._text.textContent = p.label;
        // 群組原點放在節點外框旁 6px，箭頭指向節點，文字在箭頭外側
        const dir = p.dir || "up";
        const n = nodeById[p.target];
        const geom = n ? this._geomOf(n) : { hw: 0, hh: 0 };
        const off = { up: [0, -(geom.hh + 6)], down: [0, geom.hh + 6], left: [-(geom.hw + 6), 0], right: [geom.hw + 6, 0] }[dir];
        const arrow = { up: "M0,-22 L0,-2 M-4,-7 L0,-2 L4,-7", down: "M0,22 L0,2 M-4,7 L0,2 L4,7", left: "M-24,0 L-2,0 M-7,-4 L-2,0 L-7,4", right: "M24,0 L2,0 M7,-4 L2,0 L7,4" }[dir];
        const txt = { up: [0, -32, "middle"], down: [0, 32, "middle"], left: [-30, 0, "end"], right: [30, 0, "start"] }[dir];
        g._arrow.setAttribute("d", arrow);
        g._text.setAttribute("x", txt[0]); g._text.setAttribute("y", txt[1]); g._text.setAttribute("text-anchor", txt[2]);
        const tx = (n ? n.x : p.x) + off[0], ty = (n ? n.y : p.y) + off[1];
        const key = "p:" + p.id;
        target[key] = { x: tx, y: ty, o: n || p.x != null ? 1 : 0 };
        from[key] = this.state[key] || { x: tx, y: ty - 10, o: 0 };
      });

      // 移除不在新畫面中的元素（淡出）
      const leaving = [];
      for (const kind of ["node", "edge", "ptr", "label"]) {
        for (const id in this.els[kind]) {
          if (seen[kind].has(id)) continue;
          const prefix = { node: "n:", edge: "e:", ptr: "p:", label: "l:" }[kind];
          const key = prefix + id;
          const el = this.els[kind][id];
          delete this.els[kind][id];
          const st = this.state[key] || { x: 0, y: 0, o: 1 };
          leaving.push({ el, key, st, kind });
        }
      }

      const nodePos = (id, t) => {
        const k = "n:" + id;
        const a = from[k], b = target[k];
        if (!a || !b) return null;
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      };

      const apply = (t) => {
        const cur = {};
        for (const key in target) {
          const a = from[key], b = target[key];
          cur[key] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), o: lerp(a.o, b.o, t) };
        }
        for (const id in this.els.node) {
          const c = cur["n:" + id]; const g = this.els.node[id];
          g.setAttribute("transform", `translate(${c.x.toFixed(2)},${c.y.toFixed(2)})`);
          g.style.opacity = c.o;
        }
        for (const id in this.els.label) {
          const c = cur["l:" + id]; const el = this.els.label[id];
          el.setAttribute("x", c.x); el.setAttribute("y", c.y); el.style.opacity = c.o;
        }
        for (const id in this.els.ptr) {
          const c = cur["p:" + id]; const g = this.els.ptr[id];
          g.setAttribute("transform", `translate(${c.x.toFixed(2)},${c.y.toFixed(2)})`);
          g.style.opacity = c.o;
        }
        for (const id in this.els.edge) {
          const ln = this.els.edge[id]; const e = ln._e;
          const a = nodePos(e.from, t), b = nodePos(e.to, t);
          if (!a || !b) { ln.style.opacity = 0; continue; }
          const ga = this._geomOf(nodeById[e.from]), gb = this._geomOf(nodeById[e.to]);
          const [x1, y1] = this._clip(a, b, ga), [x2, y2] = this._clip(b, a, gb);
          ln.setAttribute("x1", x1); ln.setAttribute("y1", y1);
          ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
          ln.style.opacity = cur["e:" + id].o;
        }
        leaving.forEach(({ el, st }) => (el.style.opacity = st.o * (1 - t)));
        return cur;
      };

      this._leaving = leaving;
      const finish = () => {
        const cur = apply(1);
        leaving.forEach(({ el }) => el.remove());
        this._leaving = [];
        this.state = cur;
      };

      if (instant) return finish();
      const dur = BASE_TWEEN / this.speed;
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        this.state = apply(ease(t)); // 被打斷時，下一步從目前位置接著動
        if (t < 1) this.anim = requestAnimationFrame(tick);
        else finish();
      };
      this.anim = requestAnimationFrame(tick);
    }

    _geomOf(n) {
      if (!n) return { hw: 0, hh: 0, shape: "point" };
      if ((n.shape || "circle") === "box") return { hw: (n.w || 46) / 2, hh: (n.h || 40) / 2, shape: "box" };
      const r = n.r || 21;
      return { hw: r, hh: r, r, shape: "circle" };
    }

    // 讓邊從節點外框出發，而不是從中心
    _clip(a, b, g) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      if (g.shape === "circle") return [a.x + (dx / len) * (g.r + 1), a.y + (dy / len) * (g.r + 1)];
      if (g.shape === "box") {
        const sx = dx === 0 ? Infinity : g.hw / Math.abs(dx);
        const sy = dy === 0 ? Infinity : g.hh / Math.abs(dy);
        const s = Math.min(sx, sy);
        return [a.x + dx * s, a.y + dy * s];
      }
      return [a.x, a.y];
    }
  }

  // ---------- 控制列小元件 ----------
  const ui = {
    /** 數字或文字輸入框 */
    input(player, { placeholder = "", value = "", width = 72, type = "text" } = {}) {
      const el = h("input", { class: "vinput", placeholder, value, type, style: `width:${width}px` });
      player.toolbar.appendChild(el);
      return el;
    },
    /** 操作按鈕；variant: "primary" | "ghost" */
    button(player, label, onClick, variant = "primary") {
      const el = h("button", { type: "button", class: "vop " + variant, text: label, onclick: onClick });
      player.toolbar.appendChild(el);
      return el;
    },
    /** 讀取整數輸入，失敗回傳 null 並讓輸入框閃紅 */
    int(input, { min = -999, max = 999 } = {}) {
      const v = Number(input.value.trim());
      if (!Number.isInteger(v) || v < min || v > max) {
        input.classList.add("is-error");
        setTimeout(() => input.classList.remove("is-error"), 700);
        return null;
      }
      return v;
    },
  };

  // ---------- 掛載：頁面上每個 .viz[data-viz] 呼叫對應的註冊函式 ----------
  // 靜態圖解：<figure class="fig"><div class="fig-draw" data-fig="名稱"></div><figcaption>…</figcaption></figure>
  //           figure("名稱", () => ({ width, height, nodes, edges, pointers, labels }))
  const registry = {};
  const figures = {};
  function register(name, init) { registry[name] = init; }
  function figure(name, draw) { figures[name] = draw; }
  function mountAll() {
    document.querySelectorAll(".fig-draw[data-fig]").forEach((el) => {
      const draw = figures[el.dataset.fig];
      if (!draw) {
        el.innerHTML = `${iconHTML("alert")} 找不到名為「${esc(el.dataset.fig)}」的圖，請確認已載入對應的 js 檔。`;
        return;
      }
      const f = draw();
      const p = new Player(el, { static: true, width: f.width || 640, height: f.height || 240, title: el.closest("figure")?.querySelector("figcaption")?.textContent || "" });
      p.load([f], { autoplay: false });
    });
    document.querySelectorAll(".viz[data-viz]").forEach((el) => {
      const init = registry[el.dataset.viz];
      if (!init) {
        el.innerHTML = `${iconHTML("alert")} 找不到名為「${esc(el.dataset.viz)}」的視覺化，請確認已載入對應的 js 檔。`;
        return;
      }
      init(el);
    });
  }
  document.addEventListener("DOMContentLoaded", mountAll);

  window.DSViz = { Player, Recorder, ui, register, figure, esc, clone, iconHTML };
})();
