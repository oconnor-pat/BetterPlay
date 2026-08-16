(function () {
  var links = window.BETTERPLAY_LINKS || {};
  var testFlightUrl = (links.testFlightUrl || '').trim();
  var firebaseUrl = (links.firebaseUrl || '').trim();
  var testerEmail = (links.testerEmail || 'hello@joinbetterplay.com').trim();

  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
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

  function wirePlatform(buttonId, noteId, url) {
    var button = document.getElementById(buttonId);
    var note = document.getElementById(noteId);
    if (!button) {
      return;
    }

    if (url) {
      button.href = url;
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
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

  wirePlatform('link-ios', 'note-ios', testFlightUrl);
  wirePlatform('link-android', 'note-android', firebaseUrl);

  // Hero CTAs jump to the matching panel, or straight to the store/invite link.
  document.querySelectorAll('[data-platform]').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      var platform = btn.getAttribute('data-platform');
      var url = platform === 'ios' ? testFlightUrl : firebaseUrl;
      if (url) {
        event.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      // Fall through to #get-the-app anchor for email fallback copy.
    });
  });

  // Soft-highlight the likely platform.
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  if (isIOS) {
    document.getElementById('panel-ios')?.classList.add('is-likely');
  } else if (isAndroid) {
    document.getElementById('panel-android')?.classList.add('is-likely');
  }

  // Event share support: https://joinbetterplay.com/?e=<eventId>
  // Optional: &name= for a friendlier blurb (URL-encoded).
  var params = new URLSearchParams(window.location.search);
  var eventId = params.get('e') || params.get('event');
  var eventName = params.get('name');

  if (eventId) {
    var eyebrow = document.getElementById('eyebrow');
    var lede = document.getElementById('lede');
    var hint = document.getElementById('event-hint');

    if (eyebrow) {
      eyebrow.textContent = "You're invited";
    }
    if (lede) {
      lede.textContent = eventName
        ? 'Someone shared "' +
          eventName +
          '" on BetterPlay. Get the app to RSVP and see the details.'
        : 'Someone shared an event on BetterPlay. Get the app to RSVP and see the details.';
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent =
        'Install BetterPlay below, then open the app and find the event on your Events tab.';
    }
  }
})();
