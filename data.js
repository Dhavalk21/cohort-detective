/* data.js — synthetic SaaS dataset for Cohort Detective.
 *
 * The story baked into the data (so the guided case has a real answer):
 *   - Retention metric = % of signups active in month 3 (M3).
 *   - Jan–Mar cohorts sit around 40% M3 retention.
 *   - On Apr 8 a new onboarding flow (v2) ships. It cuts activation
 *     (reaching first value) from ~70% to ~45%, mostly at the last step.
 *   - Activated users retain ~3x better than non-activated ones, so M3
 *     retention falls to ~30% for later cohorts.
 *   - A paid campaign scales up on Apr 1: a red herring: mix explains well under 1 pt of the drop.
 * Everything is generated with a seeded PRNG, so it is identical on every load.
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  var MONTH_LABELS = MONTHS.map(function (m) { return m + " '26"; });
  var LAST = MONTHS.length - 1;             // index of latest cohort (Sep)
  var MAXM = 6;                             // track months M0..M6
  var SIGNUPS = [520, 560, 610, 700, 760, 820, 880, 940, 990];
  var LAUNCH = { cm: 3, day: 8 };           // onboarding v2 goes live Apr 8

  var DIMS = {
    month:   { label: 'Signup month',        values: MONTH_LABELS },
    channel: { label: 'Acquisition channel', values: ['Paid', 'Organic', 'Referral'] },
    plan:    { label: 'Plan',                values: ['Free', 'Pro', 'Business'] },
    segment: { label: 'Customer segment',    values: ['SMB', 'Mid-market', 'Enterprise'] },
    geo:     { label: 'Geography',           values: ['Germany', 'UK', 'France', 'US'] }
  };

  var PRICE = { Free: 0, Pro: 29, Business: 99 };
  var MULT = {
    channel: { Paid: 0.85, Organic: 1.05, Referral: 1.2 },
    plan:    { Free: 0.85, Pro: 1.08, Business: 1.25 },
    segment: { 'SMB': 0.95, 'Mid-market': 1.05, 'Enterprise': 1.15 },
    geo:     { Germany: 1.02, UK: 1.0, France: 0.94, US: 1.04 }
  };
  // Monthly activity probability by month since signup
  var ACTIVATED = [1, 0.82, 0.64, 0.50, 0.44, 0.40, 0.37];
  var NOT_ACTIVATED = [1, 0.45, 0.25, 0.15, 0.11, 0.09, 0.08];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(2026);
  function pick(values, weights) {
    var r = rand(), c = 0;
    for (var i = 0; i < values.length; i++) { c += weights[i]; if (r < c) return values[i]; }
    return values[values.length - 1];
  }

  // months of follow-up available for cohort cm (data is "as of" end of Sep 2026)
  function obs(cm) { return Math.min(MAXM, LAST - cm); }

  var users = [];
  for (var cm = 0; cm < MONTHS.length; cm++) {
    for (var i = 0; i < SIGNUPS[cm]; i++) {
      var day = 1 + Math.floor(rand() * 28);
      var v2 = cm > LAUNCH.cm || (cm === LAUNCH.cm && day >= LAUNCH.day);
      var channel = pick(DIMS.channel.values, cm >= 3 ? [0.50, 0.32, 0.18] : [0.43, 0.37, 0.20]);
      var plan = pick(DIMS.plan.values, [0.50, 0.35, 0.15]);
      var segment = pick(DIMS.segment.values, [0.60, 0.28, 0.12]);
      var geo = pick(DIMS.geo.values, [0.28, 0.24, 0.18, 0.30]);

      // onboarding funnel: started -> setup done -> first value
      var started = rand() < 0.95;
      var setup = started && rand() < (v2 ? 0.84 : 0.88);
      var act = setup && rand() < (v2 ? 0.564 : 0.837);

      var mult = MULT.channel[channel] * MULT.plan[plan] * MULT.segment[segment] * MULT.geo[geo];
      var active = [1];
      var o = obs(cm);
      for (var m = 1; m <= o; m++) {
        var base = act ? ACTIVATED[m] : NOT_ACTIVATED[m];
        active.push(rand() < Math.min(0.98, base * mult) ? 1 : 0);
      }
      users.push({
        id: users.length + 1, cm: cm, month: MONTH_LABELS[cm], day: day,
        channel: channel, plan: plan, segment: segment, geo: geo,
        v2: v2, started: started, setup: setup, act: act, active: active
      });
    }
  }

  // Value of a metric at month m for a list of users. Only users whose cohort
  // has lived at least m months count (otherwise young cohorts would look bad).
  function metric(list, m, kind) {
    var n = 0, sum = 0;
    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      if (obs(u.cm) < m) continue;
      n++;
      if (u.active[m]) sum += kind === 'revenue' ? PRICE[u.plan] * (1 + 0.05 * m) : 1;
    }
    if (!n) return null;
    return { value: sum / n, n: n };
  }

  // Cohort table: one row per value of `dim`, columns M0..M6.
  // `filter` = {dim, value} restricts users first (e.g. segment = Enterprise).
  function cohortTable(dim, filter, kind) {
    var list = users;
    if (filter && filter.dim && filter.value) {
      list = users.filter(function (u) { return u[filter.dim] === filter.value; });
    }
    var groups = [];
    DIMS[dim].values.forEach(function (key) {
      var g = list.filter(function (u) { return u[dim] === key; });
      if (!g.length) return;
      var cells = [];
      for (var m = 0; m <= MAXM; m++) cells.push(metric(g, m, kind));
      groups.push({ key: key, size: g.length, cells: cells });
    });
    return { dim: dim, kind: kind, groups: groups, total: list.length };
  }

  var CD = {
    users: users, dims: DIMS, months: MONTHS, monthLabels: MONTH_LABELS,
    maxM: MAXM, launch: LAUNCH, signups: SIGNUPS,
    obs: obs, metric: metric, cohortTable: cohortTable
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CD;
  root.CD = CD;
})(typeof window !== 'undefined' ? window : globalThis);
