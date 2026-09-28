/* explorer.js — Module 1: GROUP → TRACK → COMPARE */
(function () {
  'use strict';
  var h = UI.h, D = CD.dims;
  var state = { dim: 'month', metric: 'retention', view: 'heatmap', fdim: '', fval: '' };

  function select(id, options, value, onChange) {
    var sel = h('select', { id: id, onchange: function (e) { onChange(e.target.value); } },
      options.map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === value ? 'selected' : null }); }));
    return sel;
  }
  function field(label, control) { return h('label', { class: 'field' }, [h('span', { text: label }), control]); }

  function segmented(name, options, value, onChange) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': name }, options.map(function (o) {
      return h('button', { type: 'button', class: o[0] === value ? 'on' : '', 'aria-pressed': o[0] === value,
        onclick: function () { onChange(o[0]); }, text: o[1] });
    }));
  }

  function fmtFor(metric) { return metric === 'revenue' ? UI.eur : function (v) { return UI.pct(v); }; }

  function heatmap(t) {
    var fmt = fmtFor(t.kind), max = 0;
    t.groups.forEach(function (g) { g.cells.forEach(function (c) { if (c && c.value > max) max = c.value; }); });
    var head = h('tr', null, [h('th', { text: D[t.dim].label }), h('th', { class: 'num', text: 'Users' })]
      .concat(t.groups[0].cells.map(function (_, m) { return h('th', { class: 'num', text: 'M' + m }); })));
    var rows = t.groups.map(function (g) {
      var cells = g.cells.map(function (c, m) {
        var col = UI.heat(c && c.value, max);
        return h('td', { class: 'num cell' + (c ? '' : ' empty'), style: 'background:' + col.bg + ';color:' + col.fg,
          title: c ? g.key + ' · month ' + m + ' · ' + fmt(c.value) + ' (n=' + c.n + ')' : 'Not enough time has passed yet',
          text: c ? fmt(c.value) : '—' });
      });
      var label = [g.key];
      if (t.dim === 'month' && g.key === "Apr '26") label.push(h('span', { class: 'flag', title: 'Onboarding v2 shipped on Apr 8', text: 'v2 ships' }));
      return h('tr', null, [h('th', { class: 'rowh' }, label), h('td', { class: 'num muted', text: g.size.toLocaleString() })].concat(cells));
    });
    return h('div', { class: 'table-scroll' }, h('table', { class: 'heat' }, [h('thead', null, head), h('tbody', null, rows)]));
  }

  function curves(t) {
    var colors = UI.seriesColors(t.dim, t.groups.length);
    var fmt = fmtFor(t.kind);
    return UI.lineChart({
      xLabels: t.groups[0].cells.map(function (_, m) { return 'M' + m; }),
      yFmt: t.kind === 'revenue' ? function (v) { return '€' + v.toFixed(0); } : null,
      ariaLabel: (t.kind === 'revenue' ? 'Revenue' : 'Retention') + ' curves by ' + D[t.dim].label,
      series: t.groups.map(function (g, i) {
        return { name: g.key, color: colors[i], values: g.cells.map(function (c) { return c && c.value; }) };
      })
    });
  }

  function insight(t) {
    var fmt = fmtFor(t.kind), M = 3;
    var have = t.groups.filter(function (g) { return g.cells[M]; });
    var box = h('div', { class: 'insight' });
    if (have.length >= 2) {
      var sorted = have.slice().sort(function (a, b) { return b.cells[M].value - a.cells[M].value; });
      var hi = sorted[0], lo = sorted[sorted.length - 1];
      box.appendChild(h('p', null, [h('b', { text: 'COMPARE · ' }), 'At month 3, ', h('b', { text: hi.key }), ' leads with ' + fmt(hi.cells[M].value) +
        ' and ', h('b', { text: lo.key }), ' trails with ' + fmt(lo.cells[M].value) + '.']));
    }
    if (t.dim === 'month' && !state.fdim && t.kind === 'retention') {
      box.appendChild(h('p', null, [h('b', { text: 'Spot it: ' }),
        'read down the M3 column. Jan–Mar sit near 40%, then every cohort from April slides. Something changed for those users. ',
        h('a', { href: '#case', class: 'link', text: 'Investigate it in the guided case →' })]));
    } else if (state.fdim) {
      box.appendChild(h('p', null, [h('b', { text: 'Segment × cohort · ' }),
        'Segmentation asks ', h('i', { text: 'who' }), ' behaves differently. Cohort analysis asks how a group behaves ', h('i', { text: 'over time' }),
        '. Filtering to ' + D[state.fdim].label.toLowerCase() + ' = ' + state.fval + ' does both at once.']));
    } else {
      box.appendChild(h('p', null, [h('b', { text: 'Tip · ' }),
        'a cohort is any shared characteristic, not only signup date. Try “Signup month” with a filter like Segment = Enterprise to combine both ideas.']));
    }
    return box;
  }

  function render(root) {
    var f = state.fdim ? { dim: state.fdim, value: state.fval } : null;
    var t = CD.cohortTable(state.dim, f, state.metric);
    var out = root.querySelector('.out');
    out.textContent = '';
    if (!t.groups.length) { out.appendChild(h('p', { class: 'muted', text: 'No users match that combination.' })); return; }
    out.appendChild(h('div', { class: 'out-head' }, [
      h('h3', { text: (state.metric === 'revenue' ? 'Revenue per signed-up user' : 'Retention') + ' by ' + D[state.dim].label.toLowerCase() }),
      h('span', { class: 'muted', text: t.total.toLocaleString() + ' users' + (f ? ' · ' + D[f.dim].label + ' = ' + f.value : '') })
    ]));
    out.appendChild(state.view === 'heatmap' ? heatmap(t) : curves(t));
    out.appendChild(h('p', { class: 'foot muted', text: state.metric === 'retention'
      ? 'Retention = share of a cohort’s signups with any activity in that month since signup (M0 = signup month). A dash means the cohort is too young.'
      : 'Revenue = average subscription revenue per signed-up user in that month (paying users only contribute; expansion +5% per month).' }));
    out.appendChild(insight(t));
  }

  function build() {
    var root = document.getElementById('explorer');
    var dimOpts = Object.keys(D).map(function (k) { return [k, D[k].label]; });
    var fdimOpts = [['', 'None']].concat(dimOpts);
    var controls;

    // One code path: rebuild the control bar and the output whenever anything changes.
    function refresh() {
      if (state.fdim === state.dim) state.fdim = '';
      if (state.fdim && D[state.fdim].values.indexOf(state.fval) < 0) state.fval = D[state.fdim].values[0];
      var fresh = makeControls();
      if (controls) controls.replaceWith(fresh); else root.insertBefore(fresh, root.querySelector('.out'));
      controls = fresh;
      render(root);
    }
    function makeControls() {
      return h('div', { class: 'controls' }, [
        field('Group cohorts by', select('c-dim', dimOpts, state.dim, function (v) { state.dim = v; refresh(); })),
        field('Metric', segmented('Metric', [['retention', 'Retention %'], ['revenue', 'Revenue']], state.metric, function (v) { state.metric = v; refresh(); })),
        field('View', segmented('View', [['heatmap', 'Heatmap'], ['curves', 'Curves']], state.view, function (v) { state.view = v; refresh(); })),
        field('Combine with filter', select('f-dim', fdimOpts, state.fdim, function (v) { state.fdim = v; refresh(); })),
        state.fdim ? field('Value', select('f-val', D[state.fdim].values.map(function (v) { return [v, v]; }), state.fval,
          function (v) { state.fval = v; render(root); })) : null
      ]);
    }

    root.textContent = '';
    root.appendChild(h('div', { class: 'lead' }, [
      h('h2', { text: 'Cohort explorer' }),
      h('p', { html: '<b>GROUP</b> users who share something, <b>TRACK</b> them over time, <b>COMPARE</b> the groups. ' +
        'The data is a synthetic SaaS product with ' + CD.users.length.toLocaleString() + ' signups over nine months.' })
    ]));
    root.appendChild(h('div', { class: 'out card' }));
    refresh();
  }

  window.addEventListener('DOMContentLoaded', build);
})();
