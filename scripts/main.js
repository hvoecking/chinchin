'use strict';

var _ = require('lodash');
var $ = require('jquery');
var rp = require('request-promise');
var xpath = require('xpath');

var QUERY_URL = 'https://dict.leo.org/dictQuery/m-vocab/chde/query.xml';
var AJAX_URL = 'https://dict.leo.org/dictQuery/m-vocab/chde/ajax.xml';
var MP3_URL = 'https://dict.leo.org/media/audio/%s.mp3';
var PNG_URL = 'https://dict.leo.org/media/strokes/';

var entries_path = '//sectionlist/section/entry';
var de_path = 'side[@lang="de"]/words/word';
var cs_path = 'side/repr/cc/cs';
var pn_path = 'side/repr/cc/pn';
var pn1_path = 'side[@lang="ch"]/words/word/cc/pn';
var ajax_id_path = 'side/ibox/@ajaxid';
var mp3_path = 'side[@lang="ch"]/ibox/pron/@url';

var parser = new DOMParser();

var history = [];
var history_i = -1;

$('#query').on('keydown', function (e) {
  console.log(e.keyCode);
  if (e.keyCode === 13) {  //checks whether the pressed key is 'Enter'
    history.push(e.currentTarget.value);
    history_i = history.length - 1;
    fetch();
  }
  if (e.keyCode === 40) { // checks whether the pressed key is "down arrow"

  }
});

function updateHistoryButtons() {
  if (history_i - 1 < 0) {
    $('#back').prop('disabled', true);
    $('#back').text('\u2205');
  } else {
    $('#back').prop('disabled', false);
    $('#back').text(history[history_i - 1]);
  }

  if (history_i + 1 === history.length) {
    $('#forward').prop('disabled', true);
    $('#forward').text('\u2205');
  } else {
    $('#forward').prop('disabled', false);
    $('#forward').text(history[history_i + 1]);
  }
}

updateHistoryButtons();

$('#back').on('click', function(e) {
  history_i -= 1;
  fetch();
});

$('#forward').on('click', function(e) {
  history_i += 1;
  fetch();
});

var char3000 = null;

//rp({uri: chrome.extension.getURL('resources/3000char.html')}).then(console.log);

function get_all(doc, query_path, retrieve_path, query) {
  return [entries, retrieved];
}

function transform(body) {
  var doc = parser.parseFromString(body, 'application/xml');
  return function(selector) {
    return _.map(xpath.select(selector, doc), 'textContent');
  };
}

function fetch_query(query) {
  var options = {
    uri: QUERY_URL,
    qs: {
      tolerMode: 'no',
      lp: 'chde',
      lang: 'de',
      rmWords: 'off',
      rmSearch: 'on',
      search: query,
      searchLoc: 0,
      resultOrder: 'basic',
      multiwordShowSingle: 'on',
      sectLenMax: 16,
      n: 3,
      t: new Date().toISOString(),
    },
    transform: transform,
  };

  return rp(options);
}

function fetch_ajax(ajax_id) {
  var options = {
    uri: AJAX_URL,
    qs: {
      lang: 'de',
      offset: ajax_id,
      rmWords: 'off',
    },
    transform: transform,
  };

  return rp(options);
}

function fetch() {
  var query = history[history_i];
  $('#query').val(query);
  updateHistoryButtons();

  var data = {
    query: query,
    translation: {},
    debug: {
      ajax_ids: [],
    },
  };
  var characterSeq = null;
  var $strokes = $('#strokes');
  $strokes.empty();

  fetch_query(query)
    .then(function (doc) {
      var entries = null;
      var pin1yin1s = null;

      var pin1yin1 = query.match(/(\w+[0-4])+/)
      if (pin1yin1) {
        var TRANSLATE_FROM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?!.';
        var TRANSLATE_TO__ = 'abcdefghijklmnopqrstuvwxyz';
        entries = [
          entries_path, '[',
            'translate(',
              pn1_path, ',',
              '"', TRANSLATE_FROM, '",',
              '"', TRANSLATE_TO__, '"',
            ')',
            '=',
            '"', query, '"', 
          ']',
        ].join('');
        characterSeq = _.uniq(doc(entries + '/' + cs_path + '/text()'));
        pin1yin1s = [query]
      } else {
        entries = entries_path + '[' + cs_path + '="' + query + '"]';
        characterSeq = [query];
        pin1yin1s = doc(entries + '/' + pn1_path + '/text()');
      }

      var translation = data.translation;
      var debug = data.debug;

      return _.flatten(characterSeq.map(function(characters) {
        entries = entries_path + '[' + cs_path + '="' + characters + '"]';

        var splitted = characters.replace(/\?|\!|\./g, '').split('');
        if (splitted.length > 1) {
          translation[characters] = doc([
            entries,
            de_path,
            'text()',
          ].join('/'));
        }

        return splitted.map(function(character) {
          return fetch_query(character);
        });
      }));
    })
    .each(function (doc) {
      var translation = data.translation;
      var debug = data.debug;
      var character = doc('//search/@original');
      var entries = entries_path + '[' + cs_path + '="' + character + '"]';
      translation[character] = doc([
        entries,
        de_path,
        'text()',
      ].join('/'));

      var ajax_id = doc([
        entries,
        ajax_id_path,
      ].join('/'))[0];
      debug.ajax_ids.push(ajax_id);

      return fetch_ajax(ajax_id)
        .then(function(doc) {
          var png_id = doc([
              '/',
              'additionalInfo',
              'side[@lang="ch"]',
              'info[@linkType="CH_STROKES_E"]',
              'contentGroup',
              'content[text()="' + character + '"]',
              '@href',
            ].join('/'));

          var xhr = new XMLHttpRequest();
          xhr.open('GET', PNG_URL + png_id, true);
          xhr.responseType = 'blob';
          xhr.onload = function(e) {
            var img = document.createElement('img');
            img.src = window.URL.createObjectURL(this.response);
            img.id = character;

            var a = document.createElement('a');
            a.appendChild(img);
            a.href = '#' + character;

            $strokes.append(a);
          };

          xhr.send();
        });
    })
    .then(function() {
      var formatted = JSON.stringify(data.translation, 2, ' ');
      $('#translation').val(formatted);
      $('#translation').attr('rows', formatted.split('\n').length + 1);
//      'http://www.zein.se/patrick/3000char.html'
//      '//html/body/blockquote/table/tbody/tr/td[font/text()="' + + "']'
    })
    .catch(function (err) {
      console.error(err);
    });
}
