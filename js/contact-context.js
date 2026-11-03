(function () {
  'use strict';
  var form = document.getElementById('kontaktskjema');
  if (!form) return;
  var topic = document.getElementById('emne');
  var message = document.getElementById('melding');
  var registration = document.getElementById('regnr');
  var helper = document.getElementById('melding-hjelp');
  var params = new URLSearchParams(window.location.search);
  var requested = params.get('emne');
  if (topic && (requested === 'Diagnose' || requested === 'Utleige')) topic.value = requested;
  if (topic && topic.value === 'Utleige' && params.get('utstyr') && !message.value) {
    message.value = 'Eg ønskjer å leige ' + params.get('utstyr').slice(0,160) + '.\nKøyretøy/modell: \nØnskt leigeperiode: ';
  }
  function updateTopic() {
    if (!topic || !helper) return;
    helper.textContent = topic.value === 'Utleige'
      ? 'Kva utstyr vil du leige, til kva køyretøy og i kva periode? Ta gjerne med merke, modell og årsmodell.'
      : 'Kva skjer, og kvar står bilen, maskina eller varmaren? Ta gjerne med reg.nr. eller modell.';
  }
  if (topic) { topic.addEventListener('change',updateTopic); updateTopic(); }
  // Keep the established API contract. The API forwards `message` and `package`.
  form.addEventListener('formdata',function (event) {
    var details = [];
    if (topic) details.push('Emne: ' + topic.value);
    if (registration && registration.value.trim()) details.push('Registreringsnummer: ' + registration.value.trim());
    var original = String(event.formData.get('message') || '');
    if (details.length) event.formData.set('message',details.join('\n') + '\n\n' + original);
  });
})();
