(function () {
  'use strict';
  var body = document.body;
  function editing(element) {
    if (!element || !element.matches) return false;
    return element.matches('textarea, select, input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="hidden"])');
  }
  document.addEventListener('focusin', function (event) {
    body.classList.toggle('postcard-editing', editing(event.target));
  });
  document.addEventListener('focusout', function (event) {
    body.classList.toggle('postcard-editing', editing(event.relatedTarget));
  });
}());
