// Copyright (c) 2015 Heye Vöcking

(function () {
  'use strict';

  try {
    chrome.app.runtime.onLaunched.addListener(
      function (launchData) {
        chrome.app.window.create(
          'index.html',
          { id: "window" },
          function (win) {
            win.contentWindow.launchData = launchData;
          }
        );
      }
    );
  } catch (ignore) {
    // This fails on testing, which seems to be fine
  }

}());
