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
  if (topic && Array.from(topic.options).some(function(option){return option.value === requested;})) topic.value = requested;
  if (topic && message && topic.value === 'Utleige' && params.get('utstyr') && !message.value) {
    message.value = 'Eg ønskjer å leige ' + params.get('utstyr').slice(0,160) + '.\nBilmodell og årsmodell: \nØnskt leigeperiode: ';
  }
  if (topic && message && topic.value === 'Byte av 78 mm hjullager' && !message.value) {
    message.value = 'Eg ønskjer hjelp med byte av 78 mm Gen 2 / HBU 2.1-hjullager.\nBilmodell og årsmodell: \nStad: \nØnskt tidspunkt: ';
  }
  function updateTopic() {
    if (!topic || !helper) return;
    helper.textContent = topic.value === 'Byte av 78 mm hjullager'
      ? 'Kva bil gjeld det, og kvar står han? Ta med bilmodell, årsmodell og ønskt tidspunkt. Reg.nr. er valfritt.'
      : topic.value === 'Utleige'
      ? 'Kva utstyr vil du leige, til kva køyretøy og i kva periode? Ta gjerne med merke, modell og årsmodell.'
      : 'Kva skjer, og kvar står bilen, maskina eller varmaren? Ta gjerne med reg.nr. eller modell.';
  }
  if (topic) { topic.addEventListener('change',updateTopic); updateTopic(); }
  form.addEventListener('reset',function(){setTimeout(updateTopic,0);});
  // Keep the established API contract. The API forwards `message` and `package`.
  form.addEventListener('formdata',function (event) {
    var details = [];
    if (topic) details.push('Emne: ' + topic.value);
    if (registration && registration.value.trim()) details.push('Registreringsnummer: ' + registration.value.trim());
    var original = String(event.formData.get('message') || '');
    if (details.length) event.formData.set('message',details.join('\n') + '\n\n' + original);
  });
})();
