(function () {
  var links = window.BETTERPLAY_LINKS || {};
  var appStoreUrl = (links.appStoreUrl || '').trim();
  var playStoreUrl = (links.playStoreUrl || '').trim();
  var testFlightUrl = (links.testFlightUrl || '').trim();
  var firebaseUrl = (links.firebaseUrl || '').trim();
  // Prefer public store links when live; fall back to beta distribution.
  var iosUrl = appStoreUrl || testFlightUrl;
  var androidUrl = playStoreUrl || firebaseUrl;
  var testerEmail = (links.testerEmail || 'betterplay.application@gmail.com').trim();
  var isLive = !!(appStoreUrl && playStoreUrl);

  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  var eyebrow = document.getElementById('eyebrow');
  var lede = document.getElementById('lede');
  var getHeading = document.querySelector('.get h2');
  var getLede = document.querySelector('.get-lede');
  if (isLive) {
    if (eyebrow) eyebrow.textContent = 'Now on the App Store & Google Play';
    if (lede) {
      lede.textContent =
        'Pickup games, hangouts, and group plans — organized in one place. Download BetterPlay and show up.';
    }
    if (getHeading) getHeading.textContent = 'Get the app';
    if (getLede) {
      getLede.textContent =
        'Available on iPhone and Android. Pick your phone and you’re in.';
    }
  }

  function setMail(id) {
    var el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.href = 'mailto:' + testerEmail;
    el.textContent = testerEmail;
  }
  setMail('mail-ios');
  setMail('mail-android');

  function wirePlatform(buttonId, noteId, url, liveLabel) {
    var button = document.getElementById(buttonId);
    var note = document.getElementById(noteId);
    if (!button) {
      return;
    }

    if (url) {
      button.href = url;
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
      if (liveLabel && (appStoreUrl || playStoreUrl)) {
        button.textContent = liveLabel;
      }
      if (note) {
        note.hidden = true;
      }
    } else {
      button.hidden = true;
      if (note) {
        note.hidden = false;
      }
    }
  }

  wirePlatform('link-ios', 'note-ios', iosUrl, 'Download on the App Store');
  wirePlatform(
    'link-android',
    'note-android',
    androidUrl,
    'Get it on Google Play',
  );

  document.querySelectorAll('[data-platform]').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      var platform = btn.getAttribute('data-platform');
      var url = platform === 'ios' ? iosUrl : androidUrl;
      if (url) {
        event.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    });
  });

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  if (isIOS) {
    document.getElementById('panel-ios')?.classList.add('is-likely');
  } else if (isAndroid) {
    document.getElementById('panel-android')?.classList.add('is-likely');
  }

  var params = new URLSearchParams(window.location.search);
  var eventId = params.get('e') || params.get('event');
  var eventName = params.get('name');

  if (eventId) {
    var eyebrowEl = document.getElementById('eyebrow');
    var ledeEl = document.getElementById('lede');
    var hint = document.getElementById('event-hint');
    if (eyebrowEl) eyebrowEl.textContent = 'You’re invited';
    if (ledeEl) {
      ledeEl.textContent = eventName
        ? 'Open BetterPlay to view “' + decodeURIComponent(eventName) + '”.'
        : 'Open BetterPlay to view this event.';
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent =
        'Already have the app? Deep links open the event once you’re signed in.';
    }
  }
})();
