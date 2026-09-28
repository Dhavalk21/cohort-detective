/* app.js — hash-based tab switching */
(function () {
  'use strict';
  var TABS = ['explorer', 'mix', 'case'];

  function show() {
    var id = (location.hash || '').replace('#', '');
    if (TABS.indexOf(id) < 0) id = 'explorer';
    TABS.forEach(function (t) {
      document.getElementById(t).hidden = t !== id;
      var link = document.querySelector('[data-tab="' + t + '"]');
      link.classList.toggle('on', t === id);
      if (t === id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', show);
  window.addEventListener('DOMContentLoaded', show);
})();
