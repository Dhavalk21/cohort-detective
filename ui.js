/* ui.js — tiny DOM + SVG helpers shared by all modules. No dependencies. */
(function (root) {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function add(e, kids) {
    if (kids == null || kids === false) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (k) {
      if (k == null || k === false) return;
      if (Array.isArray(k)) return add(e, k);
      e.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
    });
  }
  function make(create, tag, attrs, kids) {
    var e = create(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    add(e, kids);
    return e;
  }
  function h(tag, attrs, kids) {
    return make(function (t) { return document.createElement(t); }, tag, attrs, kids);
  }
  function s(tag, attrs, kids) {
    return make(function (t) { return document.createElementNS(SVGNS, t); }, tag, attrs, kids);
  }

  function pct(v, d) { return v == null ? '—' : (v * 100).toFixed(d || 0) + '%'; }
  function eur(v) { return v == null ? '—' : '€' + v.toFixed(2); }
  function pts(v) { return (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + ' pts'; }

  // Sequential teal heat colour. alpha carries the value so it works on light and dark.
  function heat(v, max) {
    if (v == null) return { bg: 'transparent', fg: 'inherit' };
    var t = Math.max(0, Math.min(1, v / (max || 1)));
    var a = 0.07 + 0.86 * t;
    return { bg: 'rgba(15,118,110,' + a.toFixed(3) + ')', fg: a > 0.5 ? '#fff' : 'inherit' };
  }

  var CAT = ['#2563eb', '#f59e0b', '#10b981', '#a855f7', '#ef4444'];
  function seriesColors(dim, n) {
    var out = [], i;
    if (dim === 'month') {
      for (i = 0; i < n; i++) {
        var t = n > 1 ? i / (n - 1) : 0;
        out.push('hsl(' + Math.round(185 - 170 * t) + ',72%,' + Math.round(42 + 4 * t) + '%)');
      }
    } else {
      for (i = 0; i < n; i++) out.push(CAT[i % CAT.length]);
    }
    return out;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }

  /* Line chart. opts: {series:[{name,color,values,dashed}], xLabels, yFmt, yMax, ariaLabel} */
  function lineChart(opts) {
    var W = 680, H = 340, L = 52, R = 18, T = 14, B = 34;
    var series = opts.series, xs = opts.xLabels, n = xs.length;
    var maxV = 0;
    series.forEach(function (sr) { sr.values.forEach(function (v) { if (v != null && v > maxV) maxV = v; }); });
    var yMax = opts.yMax || niceMax(maxV * 1.05);
    var yFmt = opts.yFmt || function (v) { return pct(v); };
    function X(i) { return L + (n > 1 ? i * (W - L - R) / (n - 1) : 0); }
    function Y(v) { return T + (1 - v / yMax) * (H - T - B); }

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': opts.ariaLabel || 'Line chart' });
    var i;
    for (i = 0; i <= 4; i++) {
      var gv = yMax * i / 4;
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: Y(gv), y2: Y(gv), class: 'grid' }));
      svg.appendChild(s('text', { x: L - 8, y: Y(gv) + 4, class: 'ax', 'text-anchor': 'end', text: yFmt(gv) }));
    }
    xs.forEach(function (lab, k) {
      svg.appendChild(s('text', { x: X(k), y: H - 10, class: 'ax', 'text-anchor': 'middle', text: lab }));
    });
    var gs = [];
    series.forEach(function (sr, si) {
      var g = s('g', { class: 'series', 'data-i': si });
      var d = '', pen = false;
      sr.values.forEach(function (v, k) {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1);
        pen = true;
      });
      g.appendChild(s('path', { d: d, fill: 'none', stroke: sr.color, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': sr.dashed ? '6 5' : null }));
      sr.values.forEach(function (v, k) {
        if (v == null) return;
        g.appendChild(s('circle', { cx: X(k), cy: Y(v), r: 3.6, fill: sr.color, stroke: 'var(--card)', 'stroke-width': 1.5 },
          [s('title', { text: sr.name + ' · ' + xs[k] + ' · ' + yFmt(v) })]));
      });
      svg.appendChild(g); gs.push(g);
    });

    var legend = h('div', { class: 'legend' }, series.map(function (sr, si) {
      var item = h('span', { class: 'lg', tabindex: 0 }, [
        h('i', { style: 'background:' + sr.color + (sr.dashed ? ';opacity:.6' : '') }), sr.name]);
      function on() { gs.forEach(function (g, gi) { g.classList.toggle('dim', gi !== si); }); }
      function off() { gs.forEach(function (g) { g.classList.remove('dim'); }); }
      item.addEventListener('mouseenter', on); item.addEventListener('mouseleave', off);
      item.addEventListener('focus', on); item.addEventListener('blur', off);
      return item;
    }));
    return h('div', { class: 'chart-wrap' }, [svg, legend]);
  }

  /* Paired horizontal bars. rows: [{label, a, b}] */
  function compareBars(rows, aLabel, bLabel, fmt) {
    fmt = fmt || function (v) { return pct(v); };
    var max = 0;
    rows.forEach(function (r) { max = Math.max(max, r.a || 0, r.b || 0); });
    max = max || 1;
    function bar(v, cls) {
      return h('div', { class: 'bar-track' }, [
        h('div', { class: 'bar-fill ' + cls, style: 'width:' + (v == null ? 0 : (v / max * 100).toFixed(1)) + '%' }),
        h('span', { class: 'bar-val', text: fmt(v) })
      ]);
    }
    return h('div', { class: 'cmp' }, [
      h('div', { class: 'cmp-legend' }, [
        h('span', null, [h('i', { class: 'sw a' }), aLabel]),
        h('span', null, [h('i', { class: 'sw b' }), bLabel])
      ]),
      rows.map(function (r) {
        return h('div', { class: 'cmp-row' }, [
          h('div', { class: 'cmp-label', text: r.label }),
          h('div', { class: 'cmp-bars' }, [bar(r.a, 'a'), bar(r.b, 'b')])
        ]);
      })
    ]);
  }

  /* Single horizontal bars. rows: [{label, value, hi, note}] */
  function bars(rows, fmt, max) {
    fmt = fmt || function (v) { return pct(v); };
    var m = max || 0;
    if (!m) rows.forEach(function (r) { m = Math.max(m, r.value || 0); });
    m = m || 1;
    return h('div', { class: 'cmp' }, rows.map(function (r) {
      return h('div', { class: 'cmp-row' }, [
        h('div', { class: 'cmp-label', text: r.label }),
        h('div', { class: 'cmp-bars' }, [
          h('div', { class: 'bar-track' }, [
            h('div', { class: 'bar-fill ' + (r.hi ? 'b' : 'a'), style: 'width:' + ((r.value || 0) / m * 100).toFixed(1) + '%' }),
            h('span', { class: 'bar-val', text: fmt(r.value) + (r.note ? '  ' + r.note : '') })
          ])
        ])
      ]);
    }));
  }

  root.UI = { h: h, s: s, pct: pct, pts: pts, eur: eur, heat: heat, seriesColors: seriesColors,
    lineChart: lineChart, compareBars: compareBars, bars: bars };
})(window);
