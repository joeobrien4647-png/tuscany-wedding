'use strict';

(function () {
  var weekend = document.querySelector('[data-weekend]');
  if (weekend) {
    var tablist = weekend.querySelector('[data-weekend-tabs]');
    var tabs = Array.from(weekend.querySelectorAll('[data-weekend-tab]'));
    var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('href').slice(1)); });
    if (tablist && tabs.length && panels.every(Boolean)) {
      tablist.setAttribute('role', 'tablist');
      tabs.forEach(function (tab, index) {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panels[index].id);
        panels[index].setAttribute('role', 'tabpanel');
        panels[index].setAttribute('aria-labelledby', tab.id);
        panels[index].tabIndex = 0;
        tab.addEventListener('click', function (event) {
          event.preventDefault();
          selectDay(index, false, true);
        });
        tab.addEventListener('keydown', function (event) {
          var next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else if (event.key !== ' ') return;
          event.preventDefault();
          selectDay(next, true, true);
        });
      });
      function selectDay(index, focus, updateHash) {
        tabs.forEach(function (tab, tabIndex) {
          var selected = index === tabIndex;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
          panels[tabIndex].hidden = !selected;
        });
        if (focus) tabs[index].focus();
        if (updateHash && window.history && window.history.replaceState) {
          try { window.history.replaceState(null, '', '#' + panels[index].id); } catch (error) { /* Selection works even when history is restricted. */ }
        }
      }
      function followHash() {
        var index = panels.findIndex(function (panel) { return '#' + panel.id === window.location.hash; });
        if (index !== -1) selectDay(index, false, false);
      }
      selectDay(0, false, false);
      followHash();
      window.addEventListener('hashchange', followHash);
    }
  }

  var planner = document.querySelector('[data-route-planner]');
  if (!planner) return;
  var form = planner.querySelector('[data-route-form]');
  var airport = document.getElementById('route-airport');
  var transport = document.getElementById('route-transport');
  var status = document.getElementById('route-status');
  var result = planner.querySelector('[data-route-result]');
  var title = document.getElementById('route-result-title');
  var airportResult = planner.querySelector('[data-route-airport-result]');
  var transportResult = planner.querySelector('[data-route-transport-result]');
  var comparison = document.querySelector('[data-route-comparison]');
  var airports = document.querySelector('[data-route-airports]');
  var transports = document.querySelector('[data-route-transports]');
  if (![form, airport, transport, status, result, title, airportResult, transportResult, comparison, airports, transports].every(Boolean)) return;
  var airportGuides = Array.from(airports.querySelectorAll('[data-airport-guidance]'));
  var transportGuides = Array.from(transports.querySelectorAll('[data-transport-guidance]'));

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var airportGuide = airportGuides.find(function (guide) { return guide.getAttribute('data-airport-guidance') === airport.value; });
    var transportGuide = transportGuides.find(function (guide) { return guide.getAttribute('data-transport-guidance') === transport.value; });
    airport.setAttribute('aria-invalid', String(!airportGuide));
    transport.setAttribute('aria-invalid', String(!transportGuide));
    if (!airportGuide || !transportGuide) {
      result.hidden = true;
      status.setAttribute('data-state', 'error');
      status.textContent = !airportGuide && !transportGuide ? 'Choose an airport and how you’ll travel onwards.' : !airportGuide ? 'Choose an airport from the list.' : 'Choose how you’ll travel onwards.';
      (!airportGuide ? airport : transport).focus();
      return;
    }
    airportResult.replaceChildren(airportGuide.cloneNode(true));
    transportResult.replaceChildren(transportGuide.cloneNode(true));
    title.textContent = 'From ' + airportGuide.getAttribute('data-route-label') + ', ' + transportGuide.getAttribute('data-route-label');
    result.hidden = false;
    status.removeAttribute('data-state');
    status.textContent = title.textContent + ': your planning guide is ready below.';
  });
  [airport, transport].forEach(function (field) {
    field.addEventListener('change', function () {
      field.removeAttribute('aria-invalid');
      result.hidden = true;
      status.removeAttribute('data-state');
      status.textContent = 'Select Show my route to see your planning guide.';
    });
  });
  comparison.appendChild(airports);
  comparison.appendChild(transports);
  comparison.hidden = false;
  planner.hidden = false;
  var comparisonWasOpen = false;
  window.addEventListener('beforeprint', function () {
    comparisonWasOpen = comparison.open;
    comparison.open = true;
  });
  window.addEventListener('afterprint', function () { comparison.open = comparisonWasOpen; });
})();
