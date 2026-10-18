'use strict';

document.querySelectorAll('[data-guest-print]').forEach(function (button) {
  button.hidden = false;
  button.addEventListener('click', function () {
    window.print();
  });
});
