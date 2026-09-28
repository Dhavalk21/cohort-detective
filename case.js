/* case.js — Module 3: "Retention dropped from 40% to 30%". A 7-step investigation.
 * Every piece of evidence is computed live from the synthetic dataset in data.js. */
(function () {
  'use strict';
  var h = UI.h, pct = UI.pct;

  // ---------- evidence helpers (all computed from CD.users) ----------
  var ELIG = CD.users.filter(function (u) { return CD.obs(u.cm) >= 3; });   // cohorts with M3 data (Jan–Jun)
  var PRE = ELIG.filter(function (u) { return !u.v2; });
  var POST = ELIG.filter(function (u) { return u.v2; });
  function m3(list) { var r = CD.metric(list, 3, 'retention'); return r ? r.value : null; }
  function where(list, k, v) { return list.filter(function (u) { return u[k] === v; }); }
  function share(list, fn) { return list.filter(fn).length / list.length; }

  function splitBy(key) {
    return CD.dims[key].values.map(function (v) {
      return { label: v, a: m3(where(PRE, key, v)), b: m3(where(POST, key, v)) };
    });
  }
  function note(html) { return h('p', { class: 'ev-note', html: html }); }

  var overallPre = m3(PRE), overallPost = m3(POST);

  // channel-mix counterfactual: post-launch channel retention re-weighted to the pre-launch mix
  function mixAdjustedPost() {
    var adj = 0;
    CD.dims.channel.values.forEach(function (c) {
      adj += share(PRE, function (u) { return u.channel === c; }) * m3(where(POST, 'channel', c));
    });
    return adj;
  }

  function funnel(list) {
    var started = list.filter(function (u) { return u.started; });
    var setup = list.filter(function (u) { return u.setup; });
    var act = list.filter(function (u) { return u.act; });
    return { started: started.length / list.length, setup: setup.length / started.length,
      value: act.length / setup.length, overall: act.length / list.length };
  }

  // ---------- the case ----------
  var STEPS = [
    {
      tag: 'VALIDATE', title: 'Validate the metric',
      q: 'The CEO says: “Month-3 retention fell from 40% to 30%.” Before anything else, what do you do?',
      options: [
        { label: 'Check the definition, tracking and population are unchanged', good: true,
          fb: 'Right. A metric that moved because the definition or instrumentation moved is the cheapest explanation to rule out.',
          ev: function () {
            return h('div', { class: 'ev' }, [
              h('ul', { class: 'checks' }, [
                h('li', { html: '<b>Definition:</b> M3 retention = share of a month’s signups with any activity in month 3. Unchanged since January.' }),
                h('li', { html: '<b>Tracking:</b> the activity event has fired continuously; no gaps or SDK releases in the window.' }),
                h('li', { html: '<b>Population:</b> same signup source of truth; test accounts excluded throughout.' }),
                h('li', { html: '<b>Period:</b> only cohorts with a full three months of follow-up are compared (Jan–Jun).' })
              ]),
              UI.bars(CD.months.slice(0, 6).map(function (m, i) { return { label: m + ' signups', value: CD.signups[i] }; }),
                function (v) { return v.toLocaleString(); }),
              note('Signups grew steadily, with no jump that would suggest duplicate or bot signups. <b>The drop looks real.</b>')
            ]);
          } },
        { label: 'Start redesigning the onboarding flow', good: false,
          fb: 'Too early. You’d be fixing a cause you haven’t found, and it may not even be a real drop.' },
        { label: 'Ask marketing to run a win-back promotion', good: false,
          fb: 'That treats the symptom for existing users. You still don’t know what changed or for whom.' }
      ]
    },
    {
      tag: 'SEGMENT', title: 'Segment it',
      q: 'The drop is real. Is it concentrated in one part of the base? Pick a cut to look at (you can open several).',
      options: [
        { label: 'Split by geography', good: true,
          fb: 'Useful: a uniform drop rules out a regional problem.',
          ev: function () {
            return h('div', { class: 'ev' }, [UI.compareBars(splitBy('geo'), 'Before Apr 8', 'After Apr 8'),
              note('Every country dropped by roughly the same amount. <b>Not a regional issue.</b>')]);
          } },
        { label: 'Split by acquisition channel', good: true,
          fb: 'Good instinct: channel mix is the classic confounder. Paid spend did scale up in April.',
          ev: function () {
            var adj = mixAdjustedPost(), explained = adj - overallPost;
            return h('div', { class: 'ev' }, [UI.compareBars(splitBy('channel'), 'Before Apr 8', 'After Apr 8'),
              note('Paid grew from <b>' + pct(share(PRE, function (u) { return u.channel === 'Paid'; })) + '</b> to <b>' +
                pct(share(POST, function (u) { return u.channel === 'Paid'; })) + '</b> of signups, but retention fell <b>inside every channel</b>. ' +
                'If the mix had stayed the same, post-launch retention would be ' + pct(adj, 1) + ' instead of ' + pct(overallPost, 1) +
                ': mix explains only about <b>' + (explained * 100).toFixed(1) + ' pts</b> of a ' + ((overallPre - overallPost) * 100).toFixed(1) + '-pt drop.')
            ]);
          } },
        { label: 'Split by plan', good: true,
          fb: 'Another way to rule out a pricing or packaging story.',
          ev: function () {
            return h('div', { class: 'ev' }, [UI.compareBars(splitBy('plan'), 'Before Apr 8', 'After Apr 8'),
              note('Free, Pro and Business all fell. <b>Not a plan-specific issue.</b>')]);
          } },
        { label: 'Assume it’s seasonality', good: false,
          fb: 'You have no prior-year data here, and the drop is a step change, not a gentle seasonal drift. Check the data before reaching for a story.' }
      ],
      learned: 'The drop is broad: it shows up in every country, plan and channel. That points to something that changed for everyone, not a mix shift. Now find when it started.'
    },
    {
      tag: 'LOCATE', title: 'Find where it started',
      q: 'The drop is broad. How do you pin down when it began?',
      options: [
        { label: 'Compare M3 retention by signup-month cohort', good: true,
          fb: 'Exactly what cohort analysis is for: hold age constant and compare groups.',
          ev: function () {
            var rows = CD.months.slice(0, 6).map(function (m, i) {
              return { label: CD.monthLabels[i], value: m3(where(CD.users, 'cm', i)), hi: i >= 3 };
            });
            return h('div', { class: 'ev' }, [UI.bars(rows, function (v) { return pct(v, 1); }, 0.5),
              note('Jan–Mar hold near 40%. <b>April is where it breaks</b>, and May and June are worse. The problem starts with April signups.')]);
          } },
        { label: 'Watch the overall retention trend line', good: false,
          fb: 'A blended line mixes old and new cohorts. It shows something moved, not who it moved for or when. That’s the mix trap from the previous tab.' },
        { label: 'Read support tickets from churned users', good: false,
          fb: 'Worth doing later, but without knowing which users to look at you’ll drown in anecdotes.' }
      ],
      learned: 'The problem starts with the April cohort. Now: what changed for April users?'
    },
    {
      tag: 'CHANGE', title: 'Find what changed',
      q: 'The April cohort is where it breaks. What do you check first?',
      options: [
        { label: 'Review the release and change log around April', good: true,
          fb: 'Yes. A step change usually has a dated cause. Then split April by signup date around it.',
          ev: function () {
            var apr = where(CD.users, 'cm', 3);
            var before = apr.filter(function (u) { return !u.v2; }), after = apr.filter(function (u) { return u.v2; });
            return h('div', { class: 'ev' }, [
              h('ul', { class: 'checks log' }, [
                h('li', { html: '<b>Apr 1</b> · Paid acquisition campaign scaled up' }),
                h('li', { class: 'hit', html: '<b>Apr 8</b> · New onboarding flow (v2) released to 100% of new users' }),
                h('li', { html: '<b>No</b> pricing changes, outages or tracking releases in the window' })
              ]),
              UI.bars([{ label: 'Apr 1–7 signups (old onboarding)', value: m3(before) },
                { label: 'Apr 8–30 signups (new onboarding)', value: m3(after), hi: true }], function (v) { return pct(v, 1); }, 0.5),
              note('Same month, same campaign, but users who signed up after April 8 retained far worse. <b>The drop lines up with the onboarding release, not with the calendar month.</b>')
            ]);
          } },
        { label: 'Blame the paid campaign', good: false,
          fb: 'Plausible, and you already tested it: retention fell inside every channel, and mix explains almost none of the drop. It’s a red herring, not the main cause.',
          ev: function () {
            var adj = mixAdjustedPost();
            return h('div', { class: 'ev' }, [note('Re-weighting post-launch signups to the old channel mix gives <b>' + pct(adj, 1) +
              '</b> vs <b>' + pct(overallPost, 1) + '</b> actual. That closes only ' + ((adj - overallPost) * 100).toFixed(1) + ' of ' +
              ((overallPre - overallPost) * 100).toFixed(1) + ' points.')]);
          } },
        { label: 'Decide April users are simply lower quality', good: false,
          fb: 'Users who signed up on April 1–7 came from the same campaign and retained fine. “Lower quality” doesn’t survive a date split.' }
      ],
      learned: 'Onboarding v2 shipped on Apr 8, and April signups before and after it behave very differently. Next: what behaviour actually changed?'
    },
    {
      tag: 'BEHAVIOUR', title: 'Find the behavioural difference',
      q: 'You suspect onboarding v2. What do you compare between v1 and v2 users?',
      options: [
        { label: 'The onboarding funnel: start → setup → first value', good: true,
          fb: 'Right: compare the steps between the change and the outcome to see where users leave.',
          ev: function () {
            var a = funnel(PRE), b = funnel(POST);
            return h('div', { class: 'ev' }, [
              UI.compareBars([
                { label: 'Started onboarding', a: a.started, b: b.started },
                { label: 'Completed setup (of starters)', a: a.setup, b: b.setup },
                { label: 'Reached first value (of setup)', a: a.value, b: b.value },
                { label: 'Activation (start → first value)', a: a.overall, b: b.overall }
              ], 'Onboarding v1', 'Onboarding v2'),
              note('Activation fell from <b>' + pct(a.overall) + '</b> to <b>' + pct(b.overall) + '</b>. Starting and setup barely moved; ' +
                'the collapse is at <b>reaching first value</b> (' + pct(a.value) + ' → ' + pct(b.value) + ').')
            ]);
          } },
        { label: 'Compare advanced-feature adoption', good: false,
          fb: 'That’s downstream. Users who never reach first value will never adopt advanced features, so you’d see a symptom, not the break.' },
        { label: 'Run an NPS survey on churned users', good: false,
          fb: 'Slow, biased toward vocal users, and it can’t tell you which step broke.' }
      ],
      learned: 'Activation fell sharply, and the break is at the “first value” step of v2.'
    },
    {
      tag: 'HYPOTHESIS', title: 'Form a hypothesis',
      q: 'Which hypothesis is best supported by what you’ve found?',
      options: [
        { label: '“Onboarding v2 lowers activation, and activation drives retention.”', good: true,
          fb: 'A good hypothesis is specific, falsifiable, and explains the timing. Check that the mechanism holds in the data.',
          ev: function () {
            var aPre = m3(where(PRE, 'act', true)), aPost = m3(where(POST, 'act', true));
            var nPre = m3(where(PRE, 'act', false)), nPost = m3(where(POST, 'act', false));
            var fa = funnel(PRE).overall;
            var cf = fa * aPost + (1 - fa) * nPost;                   // v2 users at the old activation rate
            var drop = overallPre - overallPost;
            return h('div', { class: 'ev' }, [
              UI.compareBars([
                { label: 'Activated users, M3 retention', a: aPre, b: aPost },
                { label: 'Not-activated users, M3 retention', a: nPre, b: nPost }
              ], 'Onboarding v1', 'Onboarding v2'),
              note('Activated users retain about the same in v1 and v2 (' + pct(aPre) + ' vs ' + pct(aPost) + '), and activated users retain ' +
                (aPost / nPost).toFixed(1) + '× better than the rest. So users didn’t get worse; <b>fewer of them get activated</b>.'),
              note('If v2 had kept the old ' + pct(fa) + ' activation rate, M3 retention would be ~' + pct(cf, 1) + ' instead of ' + pct(overallPost, 1) +
                ': activation explains about <b>' + Math.round((cf - overallPost) / drop * 100) + '%</b> of the drop.')
            ]);
          } },
        { label: '“The paid campaign brought in worse users.”', good: false,
          fb: 'Retention fell within every channel and mix explains almost none of the drop. It doesn’t explain the Apr 8 timing either.' },
        { label: '“Users are churning because of a competitor launch.”', good: false,
          fb: 'Possible, but nothing in the data points to it, and it wouldn’t produce a step change exactly on the release date.' }
      ],
      learned: 'Hypothesis: onboarding v2 lowered activation; activated users retain ~4× better; so retention fell.'
    },
    {
      tag: 'TEST', title: 'Design the test',
      q: 'Correlation isn’t proof. How do you confirm this before rolling anything back?',
      options: [
        { label: 'A/B test v1 vs v2 with activation as the primary metric and M3 retention as the outcome', good: true,
          fb: 'This is the causal check: randomise, measure the mechanism (activation) quickly, and confirm the outcome (retention) as it matures.',
          ev: function () {
            var a = funnel(PRE).overall, b = funnel(POST).overall, pbar = (a + b) / 2, d = a - b;
            var n = Math.ceil(2 * Math.pow(1.96 + 0.84, 2) * pbar * (1 - pbar) / (d * d));
            return h('div', { class: 'ev' }, [
              h('dl', { class: 'plan' }, [
                h('dt', { text: 'Hypothesis' }), h('dd', { text: 'Restoring the v1 first-value path raises activation without hurting anything else.' }),
                h('dt', { text: 'Split' }), h('dd', { text: '50/50 randomised on new signups; v1 (control) vs v2 (treatment).' }),
                h('dt', { text: 'Primary metric' }), h('dd', { text: 'Activation rate within 7 days (' + pct(b) + ' vs ' + pct(a) + ' baseline).' }),
                h('dt', { text: 'Outcome' }), h('dd', { text: 'M3 retention, read once the cohort matures.' }),
                h('dt', { text: 'Guardrails' }), h('dd', { text: 'Setup completion, support contacts, time to first value.' }),
                h('dt', { text: 'Sample' }), h('dd', { text: '~' + n.toLocaleString() + ' users per arm (80% power, 5% significance) to detect the ' + Math.round(d * 100) + '-pt activation gap; about one to two weeks at current signup volume.' })
              ]),
              note('Run funnel analysis and 5–8 user interviews <b>alongside</b> the test to learn <i>why</i> first value broke.')
            ]);
          } },
        { label: 'Roll back to v1 immediately and call it fixed', good: false,
          fb: 'Reasonable as a mitigation, but with no control you can’t confirm the cause or learn what v2 got right. Better: roll back to a holdout while you test.' },
        { label: 'Only run user interviews', good: false,
          fb: 'Interviews explain why, but they can’t show that the release caused the drop or quantify the effect.' }
      ]
    }
  ];

  // ---------- state + rendering ----------
  var state = { step: 0, picked: [], wrong: 0, done: false };
  function resetState() { state = { step: 0, picked: STEPS.map(function () { return {}; }), wrong: 0, done: false }; }
  resetState();

  function unlocked(i) {
    return STEPS[i].options.some(function (o, k) { return o.good && state.picked[i][k]; });
  }

  function pick(i, k) {
    if (state.picked[i][k]) return;
    state.picked[i][k] = true;
    if (!STEPS[i].options[k].good) state.wrong++;
    render();
  }

  function stepper() {
    return h('ol', { class: 'stepper' }, STEPS.map(function (s, i) {
      var cls = state.done || i < state.step ? 'done' : i === state.step ? 'now' : '';
      return h('li', { class: cls }, [h('span', { class: 'dot', text: state.done || i < state.step ? '✓' : i + 1 }), h('span', { class: 'lab', text: s.tag })]);
    }));
  }

  function optionBlock(i, k) {
    var o = STEPS[i].options[k], chosen = state.picked[i][k];
    var wrap = h('div', { class: 'opt-wrap' });
    wrap.appendChild(h('button', { type: 'button', class: 'opt' + (chosen ? (o.good ? ' good' : ' bad') : ''),
      'aria-pressed': chosen ? 'true' : 'false', onclick: function () { pick(i, k); }, text: o.label }));
    if (chosen) {
      wrap.appendChild(h('div', { class: 'fb ' + (o.good ? 'good' : 'bad') }, [
        h('b', { text: o.good ? 'Good call. ' : 'Wrong turn. ' }), o.fb]));
      if (o.ev) wrap.appendChild(o.ev());
    }
    return wrap;
  }

  function summary() {
    var w = state.wrong;
    var rating = w === 0 ? 'Clean investigation' : w <= 3 ? 'Sharp detective' : 'Persistent detective';
    return h('div', { class: 'card done-card' }, [
      h('h3', { text: 'Case closed · ' + rating }),
      h('p', { class: 'muted', text: w + (w === 1 ? ' wrong turn' : ' wrong turns') + ' along the way.' }),
      h('div', { class: 'answer' }, [
        h('p', { html: '<b>The interview answer, in one breath:</b>' }),
        h('blockquote', { html: '“I’d first confirm the drop is real. Then I’d segment it and see it’s broad, not a mix effect. A signup-cohort view shows it starts with April users, ' +
          'and the release log shows onboarding v2 shipped on April 8. Activation fell from ' + pct(funnel(PRE).overall) + ' to ' + pct(funnel(POST).overall) +
          ', concentrated at reaching first value, and activated users retain about ' + (m3(where(POST, 'act', true)) / m3(where(POST, 'act', false))).toFixed(0) +
          '× better. My hypothesis is that v2 hurts activation and that drives the retention drop. I’d confirm it with an A/B test on activation, then M3 retention, and fix the first-value step.”' })
      ]),
      h('div', { class: 'row-actions' }, [
        h('button', { type: 'button', class: 'btn', text: 'Replay the case', onclick: function () { resetState(); render(); window.scrollTo({ top: 0 }); } }),
        h('a', { class: 'btn ghost', href: '#explorer', text: 'Back to the explorer' })
      ])
    ]);
  }

  function render() {
    var root = document.getElementById('case');
    root.textContent = '';
    root.appendChild(h('div', { class: 'lead' }, [
      h('h2', { text: 'Guided case: “Retention dropped from 40% to 30%”' }),
      h('p', { html: 'You’re the PM. Work the case in seven moves. Every chart is computed live from the same dataset as the explorer, and wrong turns get feedback, not a game over.' })
    ]));
    root.appendChild(stepper());

    if (state.done) { root.appendChild(summary()); return; }

    var i = state.step, S = STEPS[i];
    var card = h('div', { class: 'card step-card' });
    card.appendChild(h('div', { class: 'step-head' }, [h('span', { class: 'tag', text: 'Step ' + (i + 1) + ' · ' + S.tag }), h('span', { class: 'muted', text: 'Wrong turns: ' + state.wrong })]));
    card.appendChild(h('h3', { text: S.title }));
    card.appendChild(h('p', { class: 'q', text: S.q }));
    S.options.forEach(function (_, k) { card.appendChild(optionBlock(i, k)); });

    if (unlocked(i)) {
      if (S.learned) card.appendChild(h('div', { class: 'insight' }, h('p', null, [h('b', { text: 'What you know now · ' }), S.learned])));
      var last = i === STEPS.length - 1;
      card.appendChild(h('div', { class: 'row-actions' }, [
        h('button', { type: 'button', class: 'btn', text: last ? 'Close the case →' : 'Next step →',
          onclick: function () { if (last) state.done = true; else state.step++; render(); window.scrollTo({ top: 0 }); } })
      ]));
    } else {
      card.appendChild(h('p', { class: 'muted hint', text: 'Pick the move you’d make. You can open more than one.' }));
    }
    root.appendChild(card);
  }

  window.addEventListener('DOMContentLoaded', render);
})();
