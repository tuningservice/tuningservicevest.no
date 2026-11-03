document.addEventListener('click', function (event) {
  var link = event.target.closest && event.target.closest('a[href]');
  if (!link) return;
  var href = link.getAttribute('href');
  var method = href.indexOf('tel:') === 0 ? 'phone' : href.indexOf('mailto:') === 0 ? 'email' : null;
  if (method && typeof gtag === 'function') gtag('event', 'conversion_event_contact', {contact_method:method});
});
