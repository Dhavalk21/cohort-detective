/* simulator.js — Module 2: why overall retention lies when the user mix changes */
(function () {
  'use strict';
  var h = UI.h;
  var MONTHS = 8, START = 1000;
  // Share of a cohort still active N months after signup (M0 = 100%)
  var CURVE = [1, 0.62, 0.50, 0.44, 0.40, 0.37, 0.35, 0.33];
  var state = { growth: 0.25, delta: 0 };

  function base(a) { return a < CURVE.length ? CURVE[a] : CURVE[CURVE.length - 1] * Math.pow(0.97, a - CURVE.length + 1); }
  function curve(a) { return a === 0 ? 1 : Math.max(0.02, Math.min(1, base(a) + state.delta)); }

  // Six months of steady history come first, so month 1 already has a mature user base.
  var HIST = 6;
  function model() {
    var sizes = [], i, j;
    for (i = -HIST; i < MONTHS; i++) sizes.push(Math.round(START * (i < 0 ? 1 : Math.pow(1 + state.growth, i))));
    var rows = [];
    for (i = 0; i < MONTHS; i++) {
      var active = 0, total = 0, existing = 0;
      for (j = -HIST; j <= i; j++) {
        var size = sizes[j + HIST];
        active += size * curve(i - j); total += size; if (j < i) existing += size;
      }
      rows.push({ month: i + 1, existing: existing, fresh: sizes[i + HIST], blended: active / total });
    }
    return rows;
  }

  function slider(id, label, min, max, step, value, fmt, onInput) {
    var out = h('output', { for: id, text: fmt(value) });
    var input = h('input', { type: 'range', id: id, min: min, max: max, step: step, value: value,
      oninput: function (e) { var v = parseFloat(e.target.value); out.textContent = fmt(v); onInput(v); } });
    return h('label', { class: 'slider' }, [h('span', { class: 'sl-top' }, [h('span', { text: label }), out]), input]);
  }

  function render(root) {
    var rows = model();
    var first = rows[0].blended, last = rows[rows.length - 1].blended;
    var cohortM3 = curve(3);
    var out = root.querySelector('.out');
    out.textContent = '';

    var xl = rows.map(function (r) { return 'Month ' + r.month; });
    out.appendChild(UI.lineChart({
      xLabels: xl, yMax: 0.8, ariaLabel: 'Blended active rate versus cohort month-3 retention',
      series: [
        { name: 'Blended “overall retention” (all users)', color: '#0f766e', values: rows.map(function (r) { return r.blended; }) },
        { name: 'Real cohort retention at month 3', color: '#f59e0b', dashed: true, values: rows.map(function () { return cohortM3; }) }
      ]
    }));

    var moved = last - first;
    var verdict = h('div', { class: 'insight ' + (state.delta < 0 && moved > 0 ? 'warn' : '') });
    verdict.appendChild(h('p', null, [
      'Overall retention moved from ', h('b', { text: UI.pct(first) }), ' to ', h('b', { text: UI.pct(last) }),
      ' (' + UI.pts(moved) + '). Every cohort’s month-3 retention stayed at ', h('b', { text: UI.pct(cohortM3) }),
      state.delta ? ' (' + (state.delta > 0 ? '+' : '−') + Math.abs(state.delta * 100) + ' pts vs the baseline curve).' : '.'
    ]));
    verdict.appendChild(h('p', null,
      state.delta < 0 && moved > 0
        ? ['Every cohort got ', h('b', { text: 'worse' }), ', yet the headline number went ', h('b', { text: 'up' }),
           '. New users haven’t had time to churn, so a fast-growing base flatters the blend.']
        : moved > 0.02
          ? ['Nothing got better. The blend rose only because a bigger share of users are brand new and have not churned yet.']
          : moved < -0.02
            ? ['Nothing got worse. When signups shrink, older, more-churned users dominate the blend and it sags anyway.']
            : ['With steady signups the blend is roughly stable. Now push the growth slider and watch it lie.']));
    out.appendChild(verdict);

    out.appendChild(h('div', { class: 'table-scroll' }, h('table', { class: 'heat plain' }, [
      h('thead', null, h('tr', null, ['Month', 'Existing users', 'New users', 'Overall retention'].map(function (t, i) {
        return h('th', { class: i ? 'num' : '', text: t });
      }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', null, [h('th', { class: 'rowh', text: 'Month ' + r.month }),
          h('td', { class: 'num', text: r.existing.toLocaleString() }), h('td', { class: 'num', text: r.fresh.toLocaleString() }),
          h('td', { class: 'num', text: UI.pct(r.blended) })]);
      }))
    ])));
    out.appendChild(h('p', { class: 'foot muted', text: 'Model: each month’s signups follow the same fixed retention curve (100% → 62% → 50% → 44% → 40% …). “Overall retention” = active users ÷ all users who have ever signed up, the number a blended dashboard would show.' }));
  }

  function build() {
    var root = document.getElementById('mix');
    root.textContent = '';
    root.appendChild(h('div', { class: 'lead' }, [
      h('h2', { text: 'The mix trap' }),
      h('p', { html: '“Retention went from 60% to 70%. Great!” <b>Maybe.</b> Drag the sliders and see how the headline number can move without any cohort behaving differently.' })
    ]));

    var g = slider('s-growth', 'Monthly growth in new signups', -15, 50, 5, state.growth * 100,
      function (v) { return (v > 0 ? '+' : '') + v.toFixed(0) + '% / month'; }, function (v) { state.growth = v / 100; render(root); });
    var d = slider('s-delta', 'Real change in every cohort’s retention', -10, 10, 1, state.delta * 100,
      function (v) { return (v > 0 ? '+' : '') + v.toFixed(0) + ' pts'; }, function (v) { state.delta = v / 100; render(root); });

    function preset(label, growth, delta) {
      return h('button', { type: 'button', class: 'chip', text: label, onclick: function () {
        state.growth = growth; state.delta = delta; build();
      } });
    }
    root.appendChild(h('div', { class: 'controls col' }, [
      h('div', { class: 'sliders' }, [g, d]),
      h('div', { class: 'presets' }, [h('span', { class: 'muted', text: 'Try:' }),
        preset('Growth campaign', 0.40, 0), preset('Growth up, quality down', 0.40, -0.06), preset('Growth stalls', -0.10, 0), preset('Steady state', 0, 0)])
    ]));
    root.appendChild(h('div', { class: 'out card' }));
    render(root);
  }

  window.addEventListener('DOMContentLoaded', build);
})();
