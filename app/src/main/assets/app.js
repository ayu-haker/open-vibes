/* ======================================================================
   Open Vibes — Core Engine
   Extension-based music player · v2.0
   ====================================================================== */

/* ===== UTILITIES ===== */
function esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function escJ(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
function fmtDur(sec) {
  if (!sec || sec < 0) return '';
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function fmtTime(sec) {
  if (!sec || sec < 0) return '0:00';
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function getGreeting() {
  var h = new Date().getHours();
  if (h < 6) return 'Good Night';
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}
function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* ===== DEFAULT SETTINGS ===== */
var DEF = {
  stream_quality: 'medium',
  unmetered_quality: 'off',
  keep_queue: true,
  stop_player: false,
  skip_silence: true,
  auto_radio: true,
  cache_size: 250,
  crossfade: 0,
  sleep_timer: 0,
  playback_speed: 1.0,
  change_pitch: true,
  bass_boost: 0,
  theme: 'dark',
  amoled: false,
  custom_theme: true,
  accent_color: '#1ED760',
  bg_gradient: true,
  dynamic_player: true,
  big_cover: false,
  show_bg: true,
  animations: true,
  back_anim: false,
  scroll_animations: false,
  check_updates: true,
  language: 'system',
  yt_quality: 'best',
  sp_quality: 'high'
};

/* ===== STATE ===== */
var S = {
  currentTrack: null,
  playing: false,
  queue: [],
  queueIndex: -1,
  originalQueue: [],
  shuffle: false,
  repeat: 'off',
  fullOpen: false,
  lyricsOpen: false,
  view: 'list',
  currentTab: 'home',
  libTab: 'playlists',
  searchTab: 'all',
  ytPlayer: null,
  ytReady: false,
  spAudio: null,
  sleepTimerId: null,
  sleepTimerEnd: 0,
  progressRAF: null,
  crossfadeStep: 0,
  onboardingDone: false
};

/* ===== PERSISTED DATA ===== */
var settings = JSON.parse(localStorage.getItem('ov_settings') || '{}');
var playHistory = JSON.parse(localStorage.getItem('ov_history') || '[]');
var favorites = JSON.parse(localStorage.getItem('ov_favs') || '[]');
var extensionRegistry = JSON.parse(localStorage.getItem('ov_extensions') || '{}');

function getSet(k) {
  return settings[k] !== undefined ? settings[k] : DEF[k];
}
function saveSet(k, v) {
  settings[k] = v;
  localStorage.setItem('ov_settings', JSON.stringify(settings));
  if (k === 'theme' || k === 'amoled' || k === 'accent_color') applyTheme();
}
function persistHistory() {
  localStorage.setItem('ov_history', JSON.stringify(playHistory));
}
function persistFavs() {
  localStorage.setItem('ov_favs', JSON.stringify(favorites));
}
function persistExtensions() {
  localStorage.setItem('ov_extensions', JSON.stringify(extensionRegistry));
}

/* ===== CONSTANTS ===== */
var COLORS = [
  '#1ED760', '#E74C3C', '#3498DB', '#9B59B6', '#F39C12', '#1ABC9C',
  '#E67E22', '#E91E63', '#00BCD4', '#FF5722', '#795548', '#6C5CE7',
  '#00CEC9', '#FD79A8', '#A29BFE', '#FFEAA7'
];
var GENRES = [
  { name: 'Pop', color: '#E91E63' },
  { name: 'Hip-Hop', color: '#FF5722' },
  { name: 'Rock', color: '#795548' },
  { name: 'Electronic', color: '#00BCD4' },
  { name: 'R&B', color: '#9B59B6' },
  { name: 'Latin', color: '#F39C12' },
  { name: 'Indie', color: '#1ABC9C' },
  { name: 'Classical', color: '#3498DB' },
  { name: 'Podcasts', color: '#E74C3C' },
  { name: 'Charts', color: '#6C5CE7' },
  { name: 'Mood', color: '#FD79A8' },
  { name: 'Workout', color: '#00CEC9' },
  { name: 'Chill', color: '#A29BFE' },
  { name: 'Focus', color: '#1ED760' },
  { name: 'Sleep', color: '#2D3436' },
  { name: 'Jazz', color: '#E67E22' }
];
var SAMPLE_PLAYLISTS = [
  { name: 'Liked Songs', count: 142, gradient: 'linear-gradient(135deg,#6C5CE7,#A29BFE)' },
  { name: 'Chill Vibes', count: 67, gradient: 'linear-gradient(135deg,#00BCD4,#1ABC9C)' },
  { name: 'Workout Mix', count: 89, gradient: 'linear-gradient(135deg,#E91E63,#FF5722)' },
  { name: 'Late Night', count: 45, gradient: 'linear-gradient(135deg,#2D3436,#636E72)' },
  { name: 'Road Trip', count: 123, gradient: 'linear-gradient(135deg,#F39C12,#E67E22)' },
  { name: 'Study Beats', count: 78, gradient: 'linear-gradient(135deg,#3498DB,#9B59B6)' }
];
var SLEEP_OPTIONS = [15, 30, 45, 60, 90];

/* ===== EXTENSION SYSTEM ===== */
var extensions = [
  {
    id: 'youtube_music',
    name: 'YouTube Music',
    icon: '\u25B6',
    color: '#c4302b',
    enabled: true,
    hasSettings: true,
    search: function(query) {
      return new Promise(function(resolve) {
        var cb = 'ov_yt_' + uid();
        var s = document.createElement('script');
        var timer = setTimeout(function() {
          delete window[cb];
          if (s.parentNode) s.parentNode.removeChild(s);
          resolve([]);
        }, 8000);
        window[cb] = function(data) {
          clearTimeout(timer);
          delete window[cb];
          if (s.parentNode) s.parentNode.removeChild(s);
          if (!data || !data.items) { resolve([]); return; }
          var tracks = [];
          for (var i = 0; i < data.items.length; i++) {
            var item = data.items[i];
            if (!item.id || !item.id.videoId) continue;
            var th = '';
            if (item.snippet && item.snippet.thumbnails) {
              var t = item.snippet.thumbnails.medium || item.snippet.thumbnails.default;
              if (t) th = t.url;
            }
            tracks.push({
              id: item.id.videoId,
              title: item.snippet.title || 'Unknown',
              artist: item.snippet.channelTitle || 'Unknown',
              thumbnail: th,
              source: 'youtube_music',
              duration: 0
            });
          }
          resolve(tracks);
        };
        s.src = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%3D%3D&output=json&callback=' + cb;
        s.onerror = function() {
          clearTimeout(timer);
          delete window[cb];
          if (s.parentNode) s.parentNode.removeChild(s);
          resolve([]);
        };
        document.head.appendChild(s);
      });
    },
    getStreamUrl: function(trackId) {
      return 'https://www.youtube.com/watch?v=' + trackId;
    },
    getSettings: function() {
      return [
        { key: 'yt_quality', title: 'Stream Quality', type: 'select', options: [['best', 'Best Available'], ['high', 'High (720p)'], ['medium', 'Medium (480p)'], ['lowest', 'Lowest']] }
      ];
    },
    saveSettings: function() {},
    getGuide: function() {
      return 'YouTube Music extension plays audio from YouTube videos. Search for any song and it will stream from the best available source.';
    }
  },
  {
    id: 'spotify_embed',
    name: 'Spotify',
    icon: '\u266B',
    color: '#1db954',
    enabled: true,
    hasSettings: true,
    search: function(query) {
      return new Promise(function(resolve) {
        var demoTracks = [
          { id: 'sp_' + uid(), title: query + ' (Preview)', artist: 'Spotify Result', thumbnail: '', source: 'spotify', duration: 30, preview_url: '' },
          { id: 'sp_' + uid(), title: query + ' - Remix', artist: 'Various Artists', thumbnail: '', source: 'spotify', duration: 30, preview_url: '' },
          { id: 'sp_' + uid(), title: query + ' - Live', artist: 'Featured Artist', thumbnail: '', source: 'spotify', duration: 30, preview_url: '' }
        ];
        setTimeout(function() { resolve(demoTracks); }, 300 + Math.random() * 400);
      });
    },
    getStreamUrl: function(trackId) {
      return '';
    },
    getSettings: function() {
      return [
        { key: 'sp_quality', title: 'Preview Quality', type: 'select', options: [['high', 'High (320kbps)'], ['medium', 'Medium (160kbps)'], ['low', 'Low (96kbps)']] }
      ];
    },
    saveSettings: function() {},
    getGuide: function() {
      return 'Spotify integration plays 30-second previews. For full tracks, connect your Spotify Premium account in extension settings.';
    }
  },
  {
    id: 'radio',
    name: 'Radio',
    icon: '\u25C9',
    color: '#FF9800',
    enabled: true,
    hasSettings: false,
    search: function(query) {
      return new Promise(function(resolve) {
        var radioTracks = [];
        var genres = ['Pop Hits', 'Rock Classics', 'Chill Mix', 'Workout Energy', 'Focus Flow', 'Late Night Vibes'];
        for (var i = 0; i < genres.length; i++) {
          radioTracks.push({
            id: 'radio_' + uid(),
            title: genres[i],
            artist: 'Radio Station',
            thumbnail: '',
            source: 'radio',
            duration: 180 + Math.floor(Math.random() * 120)
          });
        }
        setTimeout(function() { resolve(radioTracks); }, 200 + Math.random() * 300);
      });
    },
    getStreamUrl: function(trackId) {
      return '';
    },
    getSettings: function() {
      return [];
    },
    saveSettings: function() {},
    getGuide: function() {
      return 'Radio mode auto-queues related tracks based on what you are listening to. Enable Auto Radio in playback settings for infinite listening.';
    }
  }
];

function getExtension(id) {
  for (var i = 0; i < extensions.length; i++) {
    if (extensions[i].id === id) return extensions[i];
  }
  return null;
}
function getEnabledExtensions() {
  return extensions.filter(function(e) { return e.enabled; });
}
function isExtEnabled(id) {
  var reg = extensionRegistry[id];
  if (reg !== undefined) return reg;
  var ext = getExtension(id);
  return ext ? ext.enabled : false;
}
function setExtEnabled(id, val) {
  extensionRegistry[id] = val;
  persistExtensions();
  var ext = getExtension(id);
  if (ext) ext.enabled = val;
}
function initExtensionStates() {
  for (var id in extensionRegistry) {
    if (extensionRegistry.hasOwnProperty(id)) {
      var ext = getExtension(id);
      if (ext) ext.enabled = extensionRegistry[id];
    }
  }
}

/* ===== UNIFIED SEARCH ===== */
var searchDebounceTimer = null;

function unifiedSearch(query) {
  return new Promise(function(resolve) {
    var promises = [];
    if (typeof MusicAPI !== 'undefined') {
      promises.push(MusicAPI.search(query).catch(function() { return []; }));
    }
    var enabled = getEnabledExtensions();
    for (var i = 0; i < enabled.length; i++) {
      promises.push(enabled[i].search(query).catch(function() { return []; }));
    }
    if (promises.length === 0) { resolve([]); return; }
    Promise.all(promises).then(function(resultSets) {
      var merged = [];
      var seen = {};
      for (var i = 0; i < resultSets.length; i++) {
        for (var j = 0; j < resultSets[i].length; j++) {
          var t = resultSets[i][j];
          if (t.id && !seen[t.id]) { seen[t.id] = true; merged.push(t); }
        }
      }
      resolve(merged);
    });
  });
}

function filterSearchResults(results, tab) {
  if (tab === 'all' || !tab) return results;
  if (tab === 'songs') return results;
  if (tab === 'artists') {
    var seen = {};
    var artists = [];
    for (var i = 0; i < results.length; i++) {
      var a = results[i].artist || 'Unknown';
      if (!seen[a]) { seen[a] = true; artists.push(results[i]); }
    }
    return artists;
  }
  return results;
}

/* ===== DYNAMIC THEMING ===== */
function applyTheme() {
  var theme = getSet('theme');
  var amoled = getSet('amoled');
  var accent = getSet('accent_color') || '#1ED760';
  document.body.classList.remove('theme-light', 'theme-amoled');
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  }
  if (amoled) {
    document.body.classList.add('theme-amoled');
    document.documentElement.style.setProperty('--bg', '#000000');
    document.documentElement.style.setProperty('--bg2', '#050505');
    document.documentElement.style.setProperty('--bg3', '#0a0a0a');
  } else {
    document.documentElement.style.setProperty('--bg', theme === 'light' ? '#f5f5f7' : '#0A0A0F');
    document.documentElement.style.setProperty('--bg2', theme === 'light' ? '#e8e8ec' : '#121218');
    document.documentElement.style.setProperty('--bg3', theme === 'light' ? '#dddde2' : '#1A1A24');
  }
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--dyn-accent', accent);
  var r = parseInt(accent.slice(1, 3), 16);
  var g = parseInt(accent.slice(3, 5), 16);
  var b = parseInt(accent.slice(5, 7), 16);
  document.documentElement.style.setProperty('--dyn-accent-rgb', r + ',' + g + ',' + b);
  document.documentElement.style.setProperty('--accent-dim', 'rgba(' + r + ',' + g + ',' + b + ',0.15)');
  document.documentElement.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.3)');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', amoled ? '#000000' : (theme === 'light' ? '#f5f5f7' : '#0A0A0F'));
}

/* ===== TAB NAVIGATION ===== */
function showTab(name) {
  S.currentTab = name;
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.add('hidden'); });
  var el = document.getElementById('screen-' + name);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.tab-item').forEach(function(t) { t.classList.remove('active'); });
  var idx = { home: 0, search: 1, library: 2, settings: 3 }[name] || 0;
  var tabs = document.querySelectorAll('.tab-item');
  if (tabs[idx]) tabs[idx].classList.add('active');
  if (name === 'library') renderLibrary(S.libTab);
  if (name === 'settings') loadSettingsUI();
  if (name === 'home') updateGreeting();
  tryAdBreakpoint();
}

var _navCount = 0;
function tryAdBreakpoint() {
  _navCount++;
  if (_navCount % 5 === 0 && window.AdBridge) {
    try { AdBridge.showInterstitial(); } catch (e) {}
  }
}

function updateGreeting() {
  var el = document.getElementById('greeting');
  if (el) el.textContent = getGreeting();
}

/* ===== HOME FEED ===== */
var HOME_FEED = {
  recent: [
    { t: 'Blinding Lights', a: 'The Weeknd', dur: 200 },
    { t: 'Shape of You', a: 'Ed Sheeran', dur: 234 },
    { t: 'Starboy', a: 'The Weeknd', dur: 188 },
    { t: 'Bohemian Rhapsody', a: 'Queen', dur: 354 },
    { t: 'Levitating', a: 'Dua Lipa', dur: 203 },
    { t: 'Save Your Tears', a: 'The Weeknd', dur: 215 },
    { t: 'Peaches', a: 'Justin Bieber', dur: 198 },
    { t: 'Stay', a: 'The Kid LAROI', dur: 141 },
    { t: 'Watermelon Sugar', a: 'Harry Styles', dur: 174 },
    { t: 'Heat Waves', a: 'Glass Animals', dur: 238 }
  ],
  made: [
    { t: 'Midnight Rain', a: 'Taylor Swift', dur: 174 },
    { t: 'As It Was', a: 'Harry Styles', dur: 167 },
    { t: 'Bad Guy', a: 'Billie Eilish', dur: 194 },
    { t: 'Circles', a: 'Post Malone', dur: 215 },
    { t: 'Sunflower', a: 'Post Malone', dur: 158 },
    { t: 'Dynamite', a: 'BTS', dur: 199 },
    { t: 'Montero', a: 'Lil Nas X', dur: 137 },
    { t: 'Kiss Me More', a: 'Doja Cat', dur: 198 },
    { t: 'Good 4 U', a: 'Olivia Rodrigo', dur: 178 },
    { t: 'Industry Baby', a: 'Lil Nas X', dur: 212 }
  ],
  newReleases: [
    { t: 'Flowers', a: 'Miley Cyrus', dur: 200 },
    { t: 'Anti-Hero', a: 'Taylor Swift', dur: 200 },
    { t: 'Unholy', a: 'Sam Smith', dur: 156 },
    { t: 'Lift Me Up', a: 'Rihanna', dur: 218 },
    { t: 'Calm Down', a: 'Rema', dur: 239 },
    { t: 'Escapism', a: 'Raye', dur: 264 },
    { t: 'Creepin', a: 'Metro Boomin', dur: 208 },
    { t: 'Boy\'s A Liar', a: 'PinkPantheress', dur: 149 },
    { t: 'Kill Bill', a: 'SZA', dur: 153 },
    { t: 'Spring Snow', a: 'Arctic Monkeys', dur: 187 }
  ],
  charts: [
    { t: 'Blinding Lights', a: 'The Weeknd', dur: 200 },
    { t: 'Shape of You', a: 'Ed Sheeran', dur: 234 },
    { t: 'Despacito', a: 'Luis Fonsi', dur: 228 },
    { t: 'Someone Like You', a: 'Adele', dur: 285 },
    { t: 'Uptown Funk', a: 'Bruno Mars', dur: 270 },
    { t: 'Rolling in the Deep', a: 'Adele', dur: 225 },
    { t: 'Call Me Maybe', a: 'Carly Rae Jepsen', dur: 193 },
    { t: 'Happy', a: 'Pharrell Williams', dur: 233 },
    { t: 'Shake It Off', a: 'Taylor Swift', dur: 219 },
    { t: 'Old Town Road', a: 'Lil Nas X', dur: 113 }
  ]
};
var CARD_GRADIENTS = [
  'linear-gradient(135deg,#E91E63,#FF5722)',
  'linear-gradient(135deg,#1ED760,#00BCD4)',
  'linear-gradient(135deg,#6C5CE7,#A29BFE)',
  'linear-gradient(135deg,#F39C12,#E74C3C)',
  'linear-gradient(135deg,#9B59B6,#E91E63)',
  'linear-gradient(135deg,#00CEC9,#1ED760)',
  'linear-gradient(135deg,#3498DB,#2D3436)',
  'linear-gradient(135deg,#E67E22,#F39C12)',
  'linear-gradient(135deg,#FD79A8,#E91E63)',
  'linear-gradient(135deg,#795548,#E67E22)'
];

function buildCarousels() {
  buildCarousel('carouselRecent', HOME_FEED.recent, 'Recently Played');
  buildCarousel('carouselMade', HOME_FEED.made, 'Made For You');
  buildCarousel('carouselNew', HOME_FEED.newReleases, 'New Releases');
  buildCarousel('carouselCharts', HOME_FEED.charts, 'Top Charts');
  if (typeof MusicAPI !== 'undefined') {
    MusicAPI.getPopularTracks().then(function(tracks) {
      if (tracks && tracks.length > 0) {
        var chartsContainer = document.getElementById('carouselCharts');
        if (chartsContainer) {
          var html = '';
          for (var i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            var g = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
            var imgStyle = t.thumbnail ? 'background-image:url(' + esc(t.thumbnail) + ');background-size:cover;background-position:center;' : 'background:' + g + ';';
            html += '<div class="card" onclick="playFromCard(this)" data-track=\'' + escJ(JSON.stringify(t)) + '\'>' +
              '<div class="card-img" style="' + imgStyle + 'display:flex;align-items:center;justify-content:center;font-size:2.5em;">' + (t.thumbnail ? '' : '\uD83C\uDFB5') + '</div>' +
              '<div class="card-body"><div class="card-title">' + esc(t.title) + '</div>' +
              '<div class="card-sub">' + esc(t.artist) + '</div></div></div>';
          }
          chartsContainer.innerHTML = html;
        }
      }
    }).catch(function() {});
  }
}

function buildCarousel(containerId, items) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var g = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
    var trackData = JSON.stringify({
      id: item.t.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: item.t,
      artist: item.a,
      thumbnail: '',
      source: 'youtube_music',
      duration: item.dur || 0
    });
    html += '<div class="card" onclick="playFromCard(this)" data-track=\'' + escJ(trackData) + '\'>' +
      '<div class="card-img" style="background:' + g + ';display:flex;align-items:center;justify-content:center;font-size:2.5em;">\uD83C\uDFB5</div>' +
      '<div class="card-body"><div class="card-title">' + esc(item.t) + '</div>' +
      '<div class="card-sub">' + esc(item.a) + '</div></div></div>';
  }
  c.innerHTML = html;
}

function playFromCard(el) {
  var data = JSON.parse(el.getAttribute('data-track'));
  var track = {
    id: data.id,
    title: data.title,
    artist: data.artist,
    thumbnail: data.thumbnail,
    source: data.source,
    duration: data.duration || 0
  };
  playSong(track);
  addToQueue(track);
}

/* ===== GENRE GRID ===== */
function buildGenres() {
  var g = document.getElementById('genreGrid');
  if (!g) return;
  var html = '';
  for (var i = 0; i < GENRES.length; i++) {
    var genre = GENRES[i];
    html += '<div class="genre-tile" style="background:' + genre.color + ';" onclick="searchGenre(\'' + esc(genre.name) + '\')">' +
      '<span style="position:relative;z-index:1;">' + esc(genre.name) + '</span></div>';
  }
  g.innerHTML = html;
}

function searchGenre(name) {
  var inp = document.getElementById('searchInput');
  if (inp) {
    inp.value = name;
    doSearch();
  }
}

/* ===== SEARCH ===== */
function initSearch() {
  var inp = document.getElementById('searchInput');
  if (!inp) return;
  inp.addEventListener('input', function() {
    clearTimeout(searchDebounceTimer);
    var q = this.value.trim();
    if (q.length < 2) {
      document.getElementById('searchContent').style.display = '';
      document.getElementById('searchResults').style.display = 'none';
      return;
    }
    searchDebounceTimer = setTimeout(doSearch, 400);
  });
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      clearTimeout(searchDebounceTimer);
      doSearch();
    }
  });
}

function setSearchTab(btn, tab) {
  S.searchTab = tab;
  document.querySelectorAll('.search-tabs .lib-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  var r = document.getElementById('searchResults');
  if (r && r.getAttribute('data-results')) {
    var results = JSON.parse(r.getAttribute('data-results'));
    renderSearchResults(results, tab);
  }
}

function doSearch() {
  var q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) return;
  document.getElementById('searchContent').style.display = 'none';
  var r = document.getElementById('searchResults');
  r.style.display = '';
  r.innerHTML = '<div style="padding:0 8px;">' +
    '<div class="skeleton" style="width:100%;height:56px;margin-bottom:6px;"></div>' +
    '<div class="skeleton" style="width:100%;height:56px;margin-bottom:6px;"></div>' +
    '<div class="skeleton" style="width:100%;height:56px;margin-bottom:6px;"></div>' +
    '<div class="skeleton" style="width:100%;height:56px;margin-bottom:6px;"></div>' +
    '<div class="skeleton" style="width:100%;height:56px;"></div></div>';

  unifiedSearch(q).then(function(results) {
    r.setAttribute('data-results', JSON.stringify(results));
    renderSearchResults(results, S.searchTab);
  });
}

function renderSearchResults(results, tab) {
  var r = document.getElementById('searchResults');
  var filtered = filterSearchResults(results, tab);
  if (filtered.length === 0) {
    r.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDD0E</div><p>No results found.<br>Try a different search term.</p></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += trackHTML(filtered[i], i + 1);
  }
  r.innerHTML = html;
}

/* ===== TRACK HTML ===== */
function trackHTML(t, num) {
  var isPlaying = S.currentTrack && S.currentTrack.id === t.id;
  var isFav = isFavorite(t.id);
  var trackData = escJ(JSON.stringify(t));
  var sourceIcon = '';
  if (t.source === 'ytmusic') sourceIcon = '<span style="color:#c4302b;font-size:0.6rem;margin-left:4px;">YT</span>';
  else if (t.source === 'jiosaavn') sourceIcon = '<span style="color:#E91E63;font-size:0.6rem;margin-left:4px;">Jio</span>';
  else if (t.source === 'spotify') sourceIcon = '<span style="color:#1db954;font-size:0.6rem;margin-left:4px;">SP</span>';
  else if (t.source === 'radio') sourceIcon = '<span style="color:#FF9800;font-size:0.6rem;margin-left:4px;">RD</span>';

  var artSrc = t.thumbnail || t.albumCover || '';
  var artStyle = artSrc ? '' : 'background:var(--bg3);';

  return '<div class="track' + (isPlaying ? ' playing' : '') + '" onclick="playFromTrack(this)" data-track=\'' + trackData + '\'>' +
    '<span class="track-num">' + (num || '') + '</span>' +
    '<img class="track-art" src="' + esc(artSrc) + '" style="' + artStyle + '" onerror="this.style.background=\'var(--bg3)\';this.style.display=\'block\';">' +
    '<div class="track-info"><div class="track-name">' + esc(t.title) + sourceIcon + '</div>' +
    '<div class="track-artist">' + esc(t.artist || 'Unknown') + '</div></div>' +
    '<span class="track-dur">' + fmtDur(t.duration) + '</span>' +
    '<div class="track-actions"><button onclick="event.stopPropagation();toggleFavById(\'' + escJ(t.id) + '\')">' +
    (isFav ? '\u2665' : '\u2661') + '</button></div></div>';
}

function playFromTrack(el) {
  var data = JSON.parse(el.getAttribute('data-track'));
  playSong(data);
  addToQueue(data);
}

/* ===== PLAYBACK ENGINE ===== */
function playSong(track) {
  if (!track) return;
  S.currentTrack = track;
  addToHistory(track);
  if (typeof MusicAPI !== 'undefined') MusicAPI.addRecent(track);
  updateMiniPlayer();
  updateFullPlayer();
  updateTrackHighlights();
  updateFavButton();

  notifyNative('play', {
    title: track.title || '',
    artist: track.artist || '',
    duration: track.duration || 0
  });

  var source = track.source || '';
  if (source === 'ytmusic') {
    resolveAndPlayYT(track);
  } else if (source === 'jiosaavn') {
    resolveAndPlayJio(track);
  } else if (source === 'spotify') {
    if (track.preview_url) {
      playFromUrl(track.preview_url, track);
    } else {
      simulatePlayback(track);
    }
  } else {
    simulatePlayback(track);
  }
}

async function resolveAndPlayJio(track) {
  if (typeof MusicAPI === 'undefined') { simulatePlayback(track); return; }
  try {
    showToast('Loading stream...');
    var url = await MusicAPI.getStreamUrl(track.id, track);
    if (url) {
      playFromUrl(url, track);
    } else {
      showToast('Failed to get stream, simulating');
      simulatePlayback(track);
    }
  } catch (e) {
    console.error('[Playback] JioSaavn failed:', e);
    showToast('Stream error, trying simulation');
    simulatePlayback(track);
  }
}

async function resolveAndPlayYT(track) {
  if (typeof MusicAPI === 'undefined') { simulatePlayback(track); return; }
  try {
    showToast('Loading stream...');
    var url = await MusicAPI.getStreamUrl(track.id, track);
    if (url) {
      playFromUrl(url, track);
    } else {
      simulatePlayback(track);
    }
  } catch (e) {
    console.error('[Playback] YT stream failed:', e);
    simulatePlayback(track);
  }
}

function playFromUrl(url, track) {
  stopCurrentAudio();
  var audio = new Audio();
  audio.src = url;
  audio.playbackRate = getSet('playback_speed');
  S.spAudio = audio;
  audio.play().then(function() {
    S.playing = true;
    updatePlayButtons();
    startProgressLoop();
    if (track) notifyNative('play', { title: track.title, artist: track.artist, duration: track.duration || 0 });
  }).catch(function(e) {
    console.error('[Playback] Audio play failed:', e);
    showToast('Playback failed');
    simulatePlayback(track);
  });
  audio.addEventListener('ended', function() {
    S.playing = false;
    updatePlayButtons();
    handleTrackEnd();
  });
  audio.addEventListener('error', function(e) {
    console.error('[Playback] Audio error:', e);
    showToast('Audio error');
    simulatePlayback(track);
  });
}

function simulatePlayback(track) {
  stopCurrentAudio();
  S.playing = true;
  updatePlayButtons();
  startProgressLoop();
}

function stopCurrentAudio() {
  if (S.ytPlayer && S.ytPlayer.pauseVideo) {
    try { S.ytPlayer.pauseVideo(); } catch (e) {}
  }
  if (S.spAudio) {
    S.spAudio.pause();
    S.spAudio = null;
  }
  S.playing = false;
  notifyNative('pause', {});
  if (S.progressRAF) {
    cancelAnimationFrame(S.progressRAF);
    S.progressRAF = null;
  }
}

/* ===== YOUTUBE PLAYER ===== */
function playYouTube(videoId) {
  if (!S.ytReady) {
    window.onYouTubeIframeAPIReady = function() { createYTPlayer(videoId); };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    S.ytReady = true;
  } else if (S.ytPlayer && S.ytPlayer.loadVideoById) {
    S.ytPlayer.loadVideoById(videoId);
  } else {
    createYTPlayer(videoId);
  }
}

function createYTPlayer(videoId) {
  var holder = document.getElementById('ytHolder');
  holder.innerHTML = '<div id="ytDiv"></div>';
  S.ytPlayer = new YT.Player('ytDiv', {
    height: '1',
    width: '1',
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: function() {
        S.playing = true;
        updatePlayButtons();
        startProgressLoop();
        applyPlaybackSettings();
      },
      onStateChange: function(e) {
        if (e.data === YT.PlayerState.PLAYING) {
          S.playing = true;
          updatePlayButtons();
          startProgressLoop();
        } else if (e.data === YT.PlayerState.PAUSED) {
          S.playing = false;
          updatePlayButtons();
        } else if (e.data === YT.PlayerState.ENDED) {
          S.playing = false;
          updatePlayButtons();
          handleTrackEnd();
        }
      },
      onError: function() {
        S.playing = false;
        updatePlayButtons();
      }
    }
  });
}

function applyPlaybackSettings() {
  if (S.ytPlayer && S.ytPlayer.setPlaybackRate) {
    var speed = getSet('playback_speed');
    try { S.ytPlayer.setPlaybackRate(speed); } catch (e) {}
  }
}

function handleTrackEnd() {
  if (S.repeat === 'one') {
    if (S.currentTrack && S.currentTrack.source === 'youtube_music' && S.ytPlayer) {
      S.ytPlayer.seekTo(0);
      S.ytPlayer.playVideo();
    } else {
      playSong(S.currentTrack);
    }
    return;
  }
  playerNext();
}

/* ===== SPOTIFY PREVIEW ===== */
function playSpotifyPreview(url) {
  stopCurrentAudio();
  S.spAudio = new Audio();
  S.spAudio.src = url;
  S.spAudio.playbackRate = getSet('playback_speed');
  S.spAudio.play().then(function() {
    S.playing = true;
    updatePlayButtons();
    startProgressLoop();
  }).catch(function() {
    simulatePlayback(S.currentTrack);
  });
  S.spAudio.addEventListener('ended', function() {
    S.playing = false;
    updatePlayButtons();
    handleTrackEnd();
  });
}

/* ===== PROGRESS TRACKING ===== */
function startProgressLoop() {
  if (S.progressRAF) cancelAnimationFrame(S.progressRAF);
  var _stateUpdateCounter = 0;
  function tick() {
    updateProgressUI();
    _stateUpdateCounter++;
    if (_stateUpdateCounter % 300 === 0 && S.currentTrack) {
      var dur = 0, cur = 0;
      if (S.currentTrack.source === 'youtube_music' && S.ytPlayer && S.ytPlayer.getDuration) {
        try { dur = S.ytPlayer.getDuration(); cur = S.ytPlayer.getCurrentTime(); } catch (e) {}
      } else if (S.spAudio) {
        dur = S.spAudio.duration || 0;
        cur = S.spAudio.currentTime || 0;
      } else {
        dur = S.currentTrack.duration || 180;
        if (S._simStart) cur = Math.min((Date.now() - S._simStart) / 1000, dur);
      }
      notifyNative('update_state', {
        title: S.currentTrack.title || '',
        artist: S.currentTrack.artist || '',
        playing: S.playing,
        position: Math.floor(cur * 1000),
        duration: Math.floor(dur * 1000)
      });
    }
    S.progressRAF = requestAnimationFrame(tick);
  }
  S.progressRAF = requestAnimationFrame(tick);
}

function updateProgressUI() {
  var dur = 0, cur = 0;
  if (S.currentTrack && S.currentTrack.source === 'youtube_music' && S.ytPlayer && S.ytPlayer.getDuration) {
    try {
      dur = S.ytPlayer.getDuration();
      cur = S.ytPlayer.getCurrentTime();
    } catch (e) {}
  } else if (S.spAudio) {
    dur = S.spAudio.duration || 0;
    cur = S.spAudio.currentTime || 0;
  } else if (S.playing && S.currentTrack) {
    dur = S.currentTrack.duration || 180;
    if (!S._simStart) S._simStart = Date.now();
    cur = Math.min((Date.now() - S._simStart) / 1000, dur);
    if (cur >= dur) {
      S._simStart = null;
      handleTrackEnd();
      return;
    }
  }
  if (dur > 0) {
    var pct = (cur / dur) * 100;
    var barFill = document.getElementById('fpBarFill');
    if (barFill) barFill.style.width = pct + '%';
    var miniP = document.getElementById('miniPlayer');
    if (miniP) {
      miniP.style.setProperty('--mini-progress', pct + '%');
      var pb = miniP.querySelector('::before');
    }
    var fpNow = document.getElementById('fpTimeNow');
    if (fpNow) fpNow.textContent = fmtTime(cur);
    var fpDur = document.getElementById('fpTimeDur');
    if (fpDur) fpDur.textContent = fmtTime(dur);
    checkCrossfade(cur, dur);
    updateLyricsPosition(cur);
  }
}

/* ===== PLAYER CONTROLS ===== */
function playerToggle() {
  if (!S.currentTrack) return;
  var src = S.currentTrack.source || '';
  if (src === 'youtube_music' && S.ytPlayer && S.ytPlayer.getPlayerState) {
    var state = S.ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      S.ytPlayer.pauseVideo();
      S.playing = false;
      notifyNative('pause', {});
    } else {
      S.ytPlayer.playVideo();
      S.playing = true;
      notifyNative('play', { title: S.currentTrack.title, artist: S.currentTrack.artist, duration: S.currentTrack.duration || 0 });
    }
  } else if (S.spAudio) {
    if (S.spAudio.paused) {
      S.spAudio.play();
      S.playing = true;
      notifyNative('play', { title: S.currentTrack.title, artist: S.currentTrack.artist, duration: S.currentTrack.duration || 0 });
    } else {
      S.spAudio.pause();
      S.playing = false;
      notifyNative('pause', {});
    }
  } else {
    S.playing = !S.playing;
    if (S.playing) {
      startProgressLoop();
      notifyNative('play', { title: S.currentTrack.title, artist: S.currentTrack.artist, duration: S.currentTrack.duration || 0 });
    } else {
      notifyNative('pause', {});
    }
  }
  updatePlayButtons();
}

function playerNext() {
  if (S.queue.length === 0) return;
  if (S.queueIndex < S.queue.length - 1) {
    S.queueIndex++;
    playSong(S.queue[S.queueIndex]);
  } else if (S.repeat === 'all') {
    S.queueIndex = 0;
    playSong(S.queue[S.queueIndex]);
  } else if (getSet('auto_radio') && S.currentTrack) {
    generateRadioQueue(S.currentTrack);
    S.queueIndex++;
    playSong(S.queue[S.queueIndex]);
  } else {
    S.playing = false;
    updatePlayButtons();
  }
}

function playerPrev() {
  if (S.queue.length === 0) return;
  if (S.queueIndex > 0) {
    S.queueIndex--;
    playSong(S.queue[S.queueIndex]);
  } else if (S.repeat === 'all') {
    S.queueIndex = S.queue.length - 1;
    playSong(S.queue[S.queueIndex]);
  }
}

function updatePlayButtons() {
  var icon = S.playing ? '\u23F8' : '\u25B6';
  var miniBtn = document.getElementById('miniPlayBtn');
  if (miniBtn) miniBtn.textContent = icon;
  var fpBtn = document.getElementById('fpPlayBtn');
  if (fpBtn) fpBtn.textContent = icon;
  var fpArt = document.getElementById('fpArt');
  if (fpArt) fpArt.classList.toggle('spinning', S.playing && getSet('dynamic_player'));
}

/* ===== QUEUE MANAGEMENT ===== */
function addToQueue(track) {
  S.queue.push(track);
  S.queueIndex = S.queue.length - 1;
}

function playNextInQueue(track) {
  S.queue.splice(S.queueIndex + 1, 0, track);
}

function removeFromQueue(index) {
  if (index < 0 || index >= S.queue.length) return;
  S.queue.splice(index, 1);
  if (index < S.queueIndex) S.queueIndex--;
  if (S.queueIndex >= S.queue.length) S.queueIndex = S.queue.length - 1;
}

function toggleShuffle() {
  S.shuffle = !S.shuffle;
  var btn = document.getElementById('fpShuffle');
  if (btn) btn.classList.toggle('active', S.shuffle);
  if (S.shuffle) {
    S.originalQueue = S.queue.slice();
    var current = S.queueIndex >= 0 ? S.queue[S.queueIndex] : null;
    var shuffled = shuffleArray(S.queue);
    S.queue = shuffled;
    if (current) {
      S.queueIndex = shuffled.indexOf(current);
      if (S.queueIndex === -1) S.queueIndex = 0;
    }
  } else if (S.originalQueue.length > 0) {
    var cur = S.queueIndex >= 0 ? S.queue[S.queueIndex] : null;
    S.queue = S.originalQueue.slice();
    S.originalQueue = [];
    if (cur) {
      S.queueIndex = S.queue.indexOf(cur);
      if (S.queueIndex === -1) S.queueIndex = 0;
    }
  }
}

function toggleRepeat() {
  var modes = ['off', 'all', 'one'];
  var idx = modes.indexOf(S.repeat);
  S.repeat = modes[(idx + 1) % modes.length];
  var btn = document.getElementById('fpRepeat');
  if (btn) {
    btn.classList.toggle('active', S.repeat !== 'off');
    btn.textContent = S.repeat === 'one' ? '\u21BB' : '\u27F3';
  }
}

function generateRadioQueue(fromTrack) {
  var radioTracks = [];
  var sources = ['youtube_music'];
  var variations = ['Remix', 'Live', 'Acoustic', 'Cover', 'Instrumental', 'Extended Mix', 'Radio Edit', 'VIP Mix'];
  for (var i = 0; i < 8; i++) {
    var suffix = variations[i % variations.length];
    radioTracks.push({
      id: 'radio_' + uid(),
      title: (fromTrack.title || 'Track') + ' ' + suffix,
      artist: fromTrack.artist || 'Various Artists',
      thumbnail: fromTrack.thumbnail || '',
      source: sources[i % sources.length],
      duration: 180 + Math.floor(Math.random() * 120)
    });
  }
  S.queue = S.queue.concat(radioTracks);
}

/* ===== LYRICS SYSTEM ===== */
var MOCK_LYRICS = [
  { time: 0, text: '♪ ♪ ♪' },
  { time: 5, text: 'When the night has come' },
  { time: 9, text: 'And the land is dark' },
  { time: 13, text: 'And the moon is the only light we\'ll see' },
  { time: 19, text: 'No I won\'t be afraid' },
  { time: 23, text: 'Oh I won\'t be afraid' },
  { time: 27, text: 'Just as long as you stand' },
  { time: 31, text: 'Stand by me' },
  { time: 36, text: 'So darling, darling, stand' },
  { time: 40, text: 'By me, oh stand by me' },
  { time: 45, text: 'Oh stand, stand by me' },
  { time: 50, text: 'Stand by me' },
  { time: 55, text: '' },
  { time: 58, text: 'If the sky that we look upon' },
  { time: 62, text: 'Should tumble and fall' },
  { time: 66, text: 'And the mountains should crumble to the sea' },
  { time: 72, text: 'I won\'t cry, I won\'t cry' },
  { time: 76, text: 'No I won\'t shed a tear' },
  { time: 80, text: 'Just as long as you stand' },
  { time: 84, text: 'Stand by me' },
  { time: 89, text: 'So darling, darling, stand' },
  { time: 93, text: 'By me, oh stand by me' },
  { time: 98, text: 'Oh stand, stand by me' },
  { time: 103, text: 'Stand by me' },
  { time: 108, text: '' },
  { time: 120, text: 'Whenever I\'m in trouble' },
  { time: 124, text: 'You can stand by me' },
  { time: 128, text: 'Oh stand by me' },
  { time: 133, text: 'Oh stand, stand by me' },
  { time: 138, text: 'Stand by me' },
  { time: 143, text: 'So darling, darling, stand' },
  { time: 147, text: 'By me, oh stand by me' },
  { time: 152, text: 'Oh stand, stand by me' },
  { time: 157, text: 'Stand by me' },
  { time: 163, text: '♪ ♪ ♪' }
];

function buildLyricsView() {
  var existing = document.getElementById('lyricsOverlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'lyricsOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:250;background:var(--bg);display:none;flex-direction:column;overflow:hidden;transition:transform 0.35s cubic-bezier(0.32,0.72,0,1);transform:translateY(100%);';
  overlay.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;flex-shrink:0;">' +
      '<button onclick="closeLyrics()" style="background:none;border:none;color:var(--text);font-size:1.3rem;cursor:pointer;padding:8px;">\u2193</button>' +
      '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text2);">Lyrics</div>' +
      '<button onclick="closeLyrics()" style="background:none;border:none;color:var(--text);font-size:1rem;cursor:pointer;padding:8px;">\u2715</button>' +
    '</div>' +
    '<div id="lyricsTrackInfo" style="padding:0 20px 12px;text-align:center;">' +
      '<div id="lyricsTitle" style="font-size:1.1rem;font-weight:800;"></div>' +
      '<div id="lyricsArtist" style="font-size:0.8rem;color:var(--text2);margin-top:4px;"></div>' +
    '</div>' +
    '<div id="lyricsScroll" style="flex:1;overflow-y:auto;padding:20px 28px 80px;text-align:center;scroll-behavior:smooth;">' +
      '<div id="lyricsLines"></div>' +
    '</div>' +
    '<div style="position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(transparent,var(--bg));pointer-events:none;"></div>';
  document.body.appendChild(overlay);
}

function showLyrics() {
  var overlay = document.getElementById('lyricsOverlay');
  if (!overlay) buildLyricsView();
  overlay = document.getElementById('lyricsOverlay');
  if (S.currentTrack) {
    document.getElementById('lyricsTitle').textContent = S.currentTrack.title || '';
    document.getElementById('lyricsArtist').textContent = S.currentTrack.artist || '';
  }
  var linesDiv = document.getElementById('lyricsLines');
  linesDiv.innerHTML = '';
  for (var i = 0; i < MOCK_LYRICS.length; i++) {
    var line = MOCK_LYRICS[i];
    var p = document.createElement('p');
    p.setAttribute('data-time', line.time);
    p.textContent = line.text || '•';
    p.style.cssText = 'padding:10px 0;font-size:1.1rem;font-weight:600;color:var(--text3);transition:all 0.3s;opacity:0.4;transform:scale(0.95);';
    linesDiv.appendChild(p);
  }
  overlay.style.display = 'flex';
  requestAnimationFrame(function() {
    overlay.style.transform = 'translateY(0)';
  });
  S.lyricsOpen = true;
}

function closeLyrics() {
  var overlay = document.getElementById('lyricsOverlay');
  if (!overlay) return;
  overlay.style.transform = 'translateY(100%)';
  setTimeout(function() { overlay.style.display = 'none'; }, 350);
  S.lyricsOpen = false;
}

function updateLyricsPosition(currentTime) {
  if (!S.lyricsOpen) return;
  var lines = document.querySelectorAll('#lyricsLines p');
  if (!lines.length) return;
  var activeIdx = 0;
  for (var i = 0; i < MOCK_LYRICS.length; i++) {
    if (MOCK_LYRICS[i].time <= currentTime) activeIdx = i;
  }
  for (var j = 0; j < lines.length; j++) {
    var isActive = j === activeIdx;
    var isPast = j < activeIdx;
    lines[j].style.opacity = isActive ? '1' : (isPast ? '0.25' : '0.4');
    lines[j].style.color = isActive ? 'var(--dyn-accent)' : 'var(--text3)';
    lines[j].style.transform = isActive ? 'scale(1.05)' : 'scale(0.95)';
    lines[j].style.fontWeight = isActive ? '800' : '600';
  }
  if (lines[activeIdx]) {
    lines[activeIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ===== SLEEP TIMER ===== */
function setSleepTimer(minutes) {
  clearSleepTimer();
  if (minutes <= 0) return;
  S.sleepTimerEnd = Date.now() + minutes * 60 * 1000;
  S.sleepTimerId = setInterval(function() {
    var remaining = S.sleepTimerEnd - Date.now();
    if (remaining <= 0) {
      clearSleepTimer();
      if (S.playing) playerToggle();
      return;
    }
    updateSleepTimerDisplay(remaining);
  }, 1000);
  updateSleepTimerDisplay(minutes * 60 * 1000);
  saveSet('sleep_timer', minutes);
}

function clearSleepTimer() {
  if (S.sleepTimerId) {
    clearInterval(S.sleepTimerId);
    S.sleepTimerId = null;
  }
  S.sleepTimerEnd = 0;
  saveSet('sleep_timer', 0);
  updateSleepTimerDisplay(0);
}

function updateSleepTimerDisplay(remaining) {
  var el = document.getElementById('sleepTimerDisplay');
  if (!el) return;
  if (remaining <= 0) {
    el.style.display = 'none';
    return;
  }
  var totalSec = Math.ceil(remaining / 1000);
  var m = Math.floor(totalSec / 60);
  var s = totalSec % 60;
  el.style.display = 'block';
  el.textContent = 'Sleep: ' + m + ':' + (s < 10 ? '0' : '') + s;
}

/* ===== CROSSFADE ===== */
var crossfadeState = { active: false, fading: false, nextTrack: null };

function checkCrossfade(currentTime, duration) {
  var cf = getSet('crossfade');
  if (cf <= 0 || !S.playing || S.repeat === 'one') return;
  var remaining = duration - currentTime;
  if (remaining <= cf && remaining > 0 && !crossfadeState.fading) {
    crossfadeState.fading = true;
    crossfadeState.nextTrack = getNextQueueTrack();
    if (crossfadeState.nextTrack && S.ytPlayer) {
      var progress = remaining / cf;
      try {
        var vol = Math.max(0, Math.round(progress * 100));
        S.ytPlayer.setVolume(vol);
      } catch (e) {}
    } else if (crossfadeState.nextTrack && S.spAudio) {
      var progress2 = remaining / cf;
      S.spAudio.volume = Math.max(0, progress2);
    }
  }
  if (crossfadeState.fading && remaining <= 0) {
    crossfadeState.fading = false;
    if (S.ytPlayer) {
      try { S.ytPlayer.setVolume(100); } catch (e) {}
    } else if (S.spAudio) {
      S.spAudio.volume = 1.0;
    }
  }
}

function getNextQueueTrack() {
  if (S.queueIndex < S.queue.length - 1) {
    return S.queue[S.queueIndex + 1];
  }
  return null;
}

/* ===== FAVORITES & HISTORY ===== */
function isFavorite(trackId) {
  for (var i = 0; i < favorites.length; i++) {
    if (favorites[i].id === trackId) return true;
  }
  return false;
}

function toggleFav(track) {
  var idx = -1;
  for (var i = 0; i < favorites.length; i++) {
    if (favorites[i].id === track.id) { idx = i; break; }
  }
  if (idx > -1) {
    favorites.splice(idx, 1);
  } else {
    favorites.unshift(track);
  }
  persistFavs();
  updateTrackHighlights();
}

function toggleFavById(trackId) {
  for (var i = 0; i < favorites.length; i++) {
    if (favorites[i].id === trackId) {
      favorites.splice(i, 1);
      persistFavs();
      updateTrackHighlights();
      return;
    }
  }
}

function toggleFavCurrent() {
  if (!S.currentTrack) return;
  toggleFav(S.currentTrack);
  updateFavButton();
  var btn = document.querySelector('.fp-extra .fp-extra-btn');
  if (btn) {
    btn.classList.add('liked');
    setTimeout(function() { btn.classList.remove('liked'); }, 400);
  }
}

function updateFavButton() {
  var btns = document.querySelectorAll('.fp-extra .fp-extra-btn');
  if (btns[0] && S.currentTrack) {
    btns[0].textContent = isFavorite(S.currentTrack.id) ? '\u2665' : '\u2661';
    btns[0].classList.toggle('active', isFavorite(S.currentTrack.id));
  }
}

function addToHistory(track) {
  playHistory = playHistory.filter(function(h) { return h.id !== track.id; });
  playHistory.unshift(track);
  if (playHistory.length > 100) playHistory = playHistory.slice(0, 100);
  persistHistory();
}

/* ===== LIBRARY ===== */
function switchLibTab(btn, tab) {
  S.libTab = tab;
  document.querySelectorAll('#libTabs .lib-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  renderLibrary(tab);
}

function setView(v) {
  S.view = v;
  document.getElementById('viewList').classList.toggle('active', v === 'list');
  document.getElementById('viewGrid').classList.toggle('active', v === 'grid');
  var c = document.getElementById('libraryContent');
  if (v === 'grid') {
    c.style.display = 'grid';
    c.style.gridTemplateColumns = 'repeat(2, 1fr)';
    c.style.gap = '10px';
  } else {
    c.style.display = '';
    c.style.gridTemplateColumns = '';
    c.style.gap = '';
  }
  renderLibrary(S.libTab);
}

function renderLibrary(tab) {
  var c = document.getElementById('libraryContent');
  if (!c) return;
  if (tab === 'playlists') {
    if (S.view === 'grid') {
      c.innerHTML = SAMPLE_PLAYLISTS.map(function(p) {
        return '<div class="track" style="flex-direction:column;align-items:stretch;padding:0;overflow:hidden;" onclick="void(0)">' +
          '<div style="height:120px;background:' + p.gradient + ';display:flex;align-items:center;justify-content:center;font-size:2.5em;">\uD83C\uDFB5</div>' +
          '<div style="padding:10px 12px;"><div class="track-name">' + esc(p.name) + '</div><div class="track-artist">' + p.count + ' songs</div></div></div>';
      }).join('');
    } else {
      c.innerHTML = SAMPLE_PLAYLISTS.map(function(p) {
        return '<div class="track" onclick="void(0)"><div style="width:44px;height:44px;border-radius:8px;background:' + p.gradient + ';display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">\uD83C\uDFB5</div>' +
          '<div class="track-info"><div class="track-name">' + esc(p.name) + '</div><div class="track-artist">' + p.count + ' songs</div></div></div>';
      }).join('');
    }
  } else if (tab === 'artists') {
    var artists = [
      { name: 'The Weeknd', img: '' },
      { name: 'Taylor Swift', img: '' },
      { name: 'Ed Sheeran', img: '' },
      { name: 'Billie Eilish', img: '' },
      { name: 'Dua Lipa', img: '' },
      { name: 'Post Malone', img: '' }
    ];
    if (S.view === 'grid') {
      c.style.gridTemplateColumns = 'repeat(3, 1fr)';
      c.innerHTML = artists.map(function(a) {
        return '<div style="text-align:center;cursor:pointer;padding:8px;" onclick="searchGenre(\'' + esc(a.name) + '\')">' +
          '<div style="width:100%;aspect-ratio:1;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:2em;margin-bottom:6px;">\uD83C\uDFA4</div>' +
          '<div style="font-size:0.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(a.name) + '</div></div>';
      }).join('');
    } else {
      c.innerHTML = artists.map(function(a) {
        return '<div class="track" onclick="searchGenre(\'' + esc(a.name) + '\')">' +
          '<div style="width:44px;height:44px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">\uD83C\uDFA4</div>' +
          '<div class="track-info"><div class="track-name">' + esc(a.name) + '</div><div class="track-artist">Artist</div></div></div>';
      }).join('');
    }
  } else if (tab === 'albums') {
    var albums = [
      { name: 'After Hours', artist: 'The Weeknd', gradient: 'linear-gradient(135deg,#E74C3C,#C0392B)' },
      { name: 'Midnights', artist: 'Taylor Swift', gradient: 'linear-gradient(135deg,#2D3436,#6C5CE7)' },
      { name: 'Divide', artist: 'Ed Sheeran', gradient: 'linear-gradient(135deg,#3498DB,#1ABC9C)' },
      { name: 'Happier Than Ever', artist: 'Billie Eilish', gradient: 'linear-gradient(135deg,#DFE6E9,#B2BEC3)' },
      { name: 'Future Nostalgia', artist: 'Dua Lipa', gradient: 'linear-gradient(135deg,#E91E63,#9C27B0)' }
    ];
    if (S.view === 'grid') {
      c.style.gridTemplateColumns = 'repeat(2, 1fr)';
      c.innerHTML = albums.map(function(al) {
        return '<div class="track" style="flex-direction:column;align-items:stretch;padding:0;overflow:hidden;" onclick="void(0)">' +
          '<div style="aspect-ratio:1;background:' + al.gradient + ';display:flex;align-items:center;justify-content:center;font-size:2.5em;">\uD83C\uDFB5</div>' +
          '<div style="padding:10px 12px;"><div class="track-name">' + esc(al.name) + '</div><div class="track-artist">' + esc(al.artist) + '</div></div></div>';
      }).join('');
    } else {
      c.innerHTML = albums.map(function(al) {
        return '<div class="track" onclick="void(0)">' +
          '<div style="width:44px;height:44px;border-radius:8px;background:' + al.gradient + ';display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">\uD83C\uDFB5</div>' +
          '<div class="track-info"><div class="track-name">' + esc(al.name) + '</div><div class="track-artist">' + esc(al.artist) + '</div></div></div>';
      }).join('');
    }
    if (S.view === 'grid') c.style.gridTemplateColumns = 'repeat(2, 1fr)';
  } else if (tab === 'recent') {
    c.style.gridTemplateColumns = '';
    if (playHistory.length === 0) {
      c.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDD04</div><p>No recently played tracks.<br>Start listening to build your history.</p></div>';
      return;
    }
    c.innerHTML = playHistory.map(function(t, i) { return trackHTML(t, i + 1); }).join('');
  } else if (tab === 'favs') {
    c.style.gridTemplateColumns = '';
    if (favorites.length === 0) {
      c.innerHTML = '<div class="empty"><div class="empty-icon">\u2661</div><p>No favorites yet.<br>Tap the heart icon on any track to add it here.</p></div>';
      return;
    }
    c.innerHTML = favorites.map(function(t, i) { return trackHTML(t, i + 1); }).join('');
  } else if (tab === 'downloaded') {
    c.style.gridTemplateColumns = '';
    c.innerHTML = '<div class="empty"><div class="empty-icon">\u2B07</div><p>No downloaded tracks.<br>Download music for offline listening.</p></div>';
  } else {
    c.style.gridTemplateColumns = '';
    c.innerHTML = '<div class="empty"><div class="empty-icon">\uD83C\uDFB5</div><p>Browse and play music to build your library.</p></div>';
  }
}

/* ===== FULL PLAYER ===== */
function openFullPlayer() {
  if (!S.currentTrack) return;
  S.fullOpen = true;
  updateFullPlayer();
  document.getElementById('fullPlayer').classList.add('open');
  buildLyricsView();
}

function closeFullPlayer() {
  S.fullOpen = false;
  document.getElementById('fullPlayer').classList.remove('open');
}

function updateFullPlayer() {
  var t = S.currentTrack;
  if (!t) return;
  var fpArt = document.getElementById('fpArt');
  if (fpArt) fpArt.src = t.thumbnail || '';
  var fpTitle = document.getElementById('fpTitle');
  if (fpTitle) fpTitle.textContent = t.title || '';
  var fpArtist = document.getElementById('fpArtist');
  if (fpArtist) fpArtist.textContent = t.artist || '';
  var sourceNames = { youtube_music: 'YOUTUBE MUSIC', spotify: 'SPOTIFY', radio: 'RADIO' };
  var fpSource = document.getElementById('fpSource');
  if (fpSource) fpSource.textContent = sourceNames[t.source] || 'MUSIC';
  updateFavButton();
}

function initProgressBarSeek() {
  var bar = document.getElementById('fpBarWrap');
  if (!bar) return;
  bar.addEventListener('click', function(e) {
    var rect = bar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (S.currentTrack && S.currentTrack.source === 'youtube_music' && S.ytPlayer && S.ytPlayer.getDuration) {
      try { S.ytPlayer.seekTo(pct * S.ytPlayer.getDuration(), true); } catch (e) {}
    } else if (S.spAudio) {
      S.spAudio.currentTime = pct * S.spAudio.duration;
    } else if (S.playing && S.currentTrack) {
      var dur = S.currentTrack.duration || 180;
      S._simStart = Date.now() - (pct * dur * 1000);
    }
  });
  bar.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });
  bar.addEventListener('touchend', function(e) {
    e.stopPropagation();
    var touch = e.changedTouches[0];
    var rect = bar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    if (S.currentTrack && S.currentTrack.source === 'youtube_music' && S.ytPlayer && S.ytPlayer.getDuration) {
      try { S.ytPlayer.seekTo(pct * S.ytPlayer.getDuration(), true); } catch (e) {}
    } else if (S.spAudio) {
      S.spAudio.currentTime = pct * S.spAudio.duration;
    } else if (S.playing && S.currentTrack) {
      var dur = S.currentTrack.duration || 180;
      S._simStart = Date.now() - (pct * dur * 1000);
    }
  }, { passive: false });
}

/* ===== MINI PLAYER ===== */
function updateMiniPlayer() {
  var t = S.currentTrack;
  var art = document.getElementById('miniArt');
  var title = document.getElementById('miniTitle');
  var artist = document.getElementById('miniArtist');
  if (!t) return;
  if (art) art.src = t.thumbnail || '';
  if (title) title.textContent = t.title || 'No Track';
  if (artist) artist.textContent = t.artist || 'Select a song';
}

/* ===== ONBOARDING ===== */
function checkOnboarding() {
  S.onboardingDone = localStorage.getItem('ov_onboarding') === 'done';
  return S.onboardingDone;
}

function showOnboarding() {
  var existing = document.getElementById('onboardingOverlay');
  if (existing) existing.remove();
  var screens = [
    { icon: '\uD83C\uDFB6', title: 'Welcome to Open Vibes', desc: 'Your personal music companion powered by extensions.' },
    { icon: '\uD83D\uDD0D', title: 'Search Everything', desc: 'Search across YouTube, Spotify, and Radio all at once.' },
    { icon: '\uD83C\uDFB5', title: 'Play & Discover', desc: 'Add to queue, create playlists, and discover new music.' },
    { icon: '\u2601', title: 'Extensions', desc: 'Customize your sources with powerful extensions.' }
  ];
  var overlay = document.createElement('div');
  overlay.id = 'onboardingOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;';

  var slidesHtml = '';
  for (var i = 0; i < screens.length; i++) {
    slidesHtml += '<div class="ob-slide" data-idx="' + i + '" style="display:' + (i === 0 ? 'flex' : 'none') + ';flex-direction:column;align-items:center;text-align:center;padding:0 40px;">' +
      '<div style="font-size:4em;margin-bottom:24px;">' + screens[i].icon + '</div>' +
      '<div style="font-size:1.5rem;font-weight:800;margin-bottom:12px;">' + screens[i].title + '</div>' +
      '<div style="font-size:0.9rem;color:var(--text2);line-height:1.6;">' + screens[i].desc + '</div></div>';
  }

  var dotsHtml = '<div id="obDots" style="display:flex;gap:8px;margin:32px 0;">';
  for (var j = 0; j < screens.length; j++) {
    dotsHtml += '<div class="ob-dot" data-idx="' + j + '" style="width:8px;height:8px;border-radius:50%;background:' + (j === 0 ? 'var(--dyn-accent)' : 'var(--text3)') + ';transition:all 0.3s;"></div>';
  }
  dotsHtml += '</div>';

  overlay.innerHTML =
    '<div style="position:absolute;top:16px;right:16px;"><button onclick="finishOnboarding()" style="background:none;border:none;color:var(--text2);font-size:0.85rem;cursor:pointer;padding:8px 16px;font-weight:600;">Skip</button></div>' +
    '<div id="obSlides">' + slidesHtml + '</div>' +
    dotsHtml +
    '<button id="obNextBtn" onclick="obNext()" style="background:var(--dyn-accent);color:#000;border:none;padding:14px 48px;border-radius:24px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Next</button>';

  document.body.appendChild(overlay);
}

var obCurrentSlide = 0;
var obTotalSlides = 4;

function obNext() {
  obCurrentSlide++;
  if (obCurrentSlide >= obTotalSlides) {
    finishOnboarding();
    return;
  }
  var slides = document.querySelectorAll('.ob-slide');
  var dots = document.querySelectorAll('.ob-dot');
  for (var i = 0; i < slides.length; i++) {
    slides[i].style.display = i === obCurrentSlide ? 'flex' : 'none';
    dots[i].style.background = i === obCurrentSlide ? 'var(--dyn-accent)' : 'var(--text3)';
    dots[i].style.transform = i === obCurrentSlide ? 'scale(1.3)' : 'scale(1)';
  }
  var btn = document.getElementById('obNextBtn');
  if (btn) btn.textContent = obCurrentSlide === obTotalSlides - 1 ? 'Get Started' : 'Next';
}

function finishOnboarding() {
  localStorage.setItem('ov_onboarding', 'done');
  S.onboardingDone = true;
  var overlay = document.getElementById('onboardingOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(function() { overlay.remove(); }, 300);
  }
  obCurrentSlide = 0;
}

/* ===== SETTINGS UI ===== */
function buildSettings() {
  var c = document.getElementById('settingsContent');
  if (!c) return;
  c.innerHTML =
    group('Playback', [
      sel('stream_quality', 'Stream Quality', [['highest', 'Highest'], ['medium', 'Medium'], ['lowest', 'Lowest']]),
      sel('unmetered_quality', 'Unmetered Quality', [['off', 'Off'], ['highest', 'Highest'], ['medium', 'Medium'], ['lowest', 'Lowest']]),
      tog('keep_queue', 'Keep Player Queue', 'Recover queue on app reopen'),
      tog('stop_player', 'Stop Player', 'Stop when removed from recents'),
      tog('skip_silence', 'Skip Silence', 'Gapless playback'),
      tog('auto_radio', 'Auto Start Radio', 'Infinite queue from related songs'),
      sli('cache_size', 'Cache Size', 'MB', '200', '1000', '250'),
      sli('crossfade', 'Crossfade', 'seconds', '0', '12', '0'),
      sleepTimerSetting()
    ]) +
    group('Audio', [
      sli('playback_speed', 'Playback Speed', 'x', '0.5', '2.0', '1.0', '0.1'),
      tog('change_pitch', 'Preserve Pitch', 'Maintain pitch at different speeds'),
      sli('bass_boost', 'Bass Boost', '/10', '0', '10', '0')
    ]) +
    group('Look & Feel', [
      sel('theme', 'Theme', [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]),
      tog('custom_theme', 'Custom Theme Color', 'Use accent color'),
      div('colorPalette', 'Accent Color'),
      tog('amoled', 'AMOLED', 'Pitch-black for OLED'),
      tog('bg_gradient', 'Background Gradient', 'Color tint based on context'),
      tog('dynamic_player', 'Dynamic Player Color', 'Color from artwork'),
      tog('big_cover', 'Bigger Covers', 'Increase artwork size'),
      tog('show_bg', 'Show Background', 'Artwork in player')
    ]) +
    group('Animations', [
      tog('animations', 'Enable Animations', 'Smooth transitions'),
      tog('back_anim', 'Back Animation', 'Return animation effects'),
      tog('scroll_animations', 'Scroll Animations', 'Animate elements on scroll')
    ]) +
    group('Other', [
      tog('check_updates', 'Check for Updates', 'Auto-check on launch'),
      act('Export Settings', '\uD83D\uDCE4', 'exportSettings()'),
      act('Import Settings', '\uD83D\uDCE5', 'importSettings()'),
      sel('language', 'Language', [
        ['system', 'System'], ['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'],
        ['fr', 'French'], ['de', 'German'], ['ja', 'Japanese'], ['ko', 'Korean'],
        ['pt', 'Portuguese'], ['ru', 'Russian'], ['ar', 'Arabic'], ['zh-CN', 'Chinese (Simplified)']
      ])
    ]) +
    group('Extensions', extensions.map(function(ext) {
      return extCard(ext);
    }).join('')) +
    '<div style="padding:16px 0 80px;text-align:center;">' +
    '<div style="font-size:0.7rem;color:var(--text3);">Open Vibes v2.0</div>' +
    '<div style="font-size:0.65rem;color:var(--text3);margin-top:4px;">Built with Echo Nightly</div>' +
    '<div style="margin-top:12px;display:flex;justify-content:center;gap:8px;">' +
    '<a href="https://github.com/brahmkshatriya/echo" target="_blank" style="padding:6px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:0.7rem;text-decoration:none;">GitHub</a>' +
    '<a href="https://discord.gg/J3WvbBUU8Z" target="_blank" style="padding:6px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:0.7rem;text-decoration:none;">Discord</a>' +
    '</div></div>';
}

function group(title, items) {
  return '<div class="settings-group"><div class="settings-group-title">' + title + '</div>' + items.join('') + '</div>';
}
function tog(key, title, desc) {
  return '<div class="setting"><div class="setting-icon">\u26AA</div><div class="setting-text"><div class="setting-title">' + title + '</div>' +
    (desc ? '<div class="setting-desc">' + desc + '</div>' : '') +
    '</div><div class="setting-control"><label class="toggle"><input type="checkbox" id="s_' + key + '" onchange="onSettingToggle(\'' + key + '\',this.checked)"><span class="toggle-track"></span></label></div></div>';
}
function sel(key, title, opts) {
  var html = '<div class="setting"><div class="setting-icon">\u25BC</div><div class="setting-text"><div class="setting-title">' + title + '</div></div><div class="setting-control"><select class="setting-select" id="s_' + key + '" onchange="saveSet(\'' + key + '\',this.value)">';
  for (var i = 0; i < opts.length; i++) {
    html += '<option value="' + opts[i][0] + '">' + opts[i][1] + '</option>';
  }
  html += '</select></div></div>';
  return html;
}
function sli(key, title, unit, min, max, def, step) {
  return '<div class="setting"><div class="setting-icon">\u2312</div><div class="setting-text"><div class="setting-title">' + title + '</div><div class="setting-desc"><span id="sv_' + key + '">' + def + '</span> ' + unit + '</div></div><div class="setting-control"><input type="range" class="setting-slider" id="s_' + key + '" min="' + min + '" max="' + max + '" value="' + def + '" step="' + (step || 1) + '" oninput="onSettingSlider(\'' + key + '\',this.value,\'' + unit + '\')"></div></div>';
}
function div(id, title) {
  return '<div class="setting"><div class="setting-text"><div class="setting-title">' + title + '</div></div><div class="color-palette" id="' + id + '"></div></div>';
}
function act(title, icon, fn) {
  return '<div class="setting" onclick="' + fn + '" style="cursor:pointer;"><div class="setting-icon">' + icon + '</div><div class="setting-text"><div class="setting-title">' + title + '</div></div><div class="setting-control" style="color:var(--text3);">\u203A</div></div>';
}
function extCard(ext) {
  var enabledState = isExtEnabled(ext.id);
  return '<div class="ext-card">' +
    '<div class="ext-card-head">' +
    '<div class="ext-card-icon" style="background:' + ext.color + ';">' + ext.icon + '</div>' +
    '<div class="ext-card-info"><h3>' + esc(ext.name) + '</h3><p>' + esc(ext.getGuide().substring(0, 60)) + '...</p></div>' +
    '<div class="setting-control"><label class="toggle"><input type="checkbox" ' + (enabledState ? 'checked' : '') + ' onchange="toggleExtension(\'' + ext.id + '\',this.checked)"><span class="toggle-track"></span></label></div>' +
    '</div></div>';
}
function sleepTimerSetting() {
  var html = '<div class="setting"><div class="setting-icon">\u23F0</div><div class="setting-text"><div class="setting-title">Sleep Timer</div><div class="setting-desc" id="sleepTimerDisplay" style="display:none;"></div></div><div class="setting-control"><select class="setting-select" id="s_sleep_timer" onchange="onSleepTimerChange(this.value)"><option value="0">Off</option>';
  for (var i = 0; i < SLEEP_OPTIONS.length; i++) {
    html += '<option value="' + SLEEP_OPTIONS[i] + '">' + SLEEP_OPTIONS[i] + ' min</option>';
  }
  html += '</select></div></div>';
  return html;
}

function onSettingToggle(key, val) {
  saveSet(key, val);
  if (key === 'amoled' || key === 'theme' || key === 'bg_gradient') applyTheme();
}
function onSettingSlider(key, val, unit) {
  var display = document.getElementById('sv_' + key);
  if (display) display.textContent = val + (unit === 'x' ? 'x' : (unit === '/10' ? '/10' : ' ' + unit));
  saveSet(key, parseFloat(val));
  if (key === 'playback_speed') applyPlaybackSettings();
}
function onSleepTimerChange(val) {
  var minutes = parseInt(val);
  if (minutes > 0) {
    setSleepTimer(minutes);
  } else {
    clearSleepTimer();
  }
}
function toggleExtension(id, enabled) {
  setExtEnabled(id, enabled);
}

function cycleProvider() {
  if (typeof MusicAPI === 'undefined') { showToast('Music API not loaded'); return; }
  var current = MusicAPI.getProvider();
  var providers = ['jiosaavn', 'ytmusic'];
  var names = { jiosaavn: 'JioSaavn', ytmusic: 'YouTube Music' };
  var idx = providers.indexOf(current);
  var next = providers[(idx + 1) % providers.length];
  MusicAPI.setProvider(next);
  var el = document.getElementById('valProvider');
  if (el) el.textContent = names[next] || next;
  showToast('Provider: ' + (names[next] || next));
}

function loadSettingsUI() {
  Object.keys(DEF).forEach(function(k) {
    var el = document.getElementById('s_' + k);
    if (!el) return;
    var v = getSet(k);
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
    var sv = document.getElementById('sv_' + k);
    if (sv) sv.textContent = v;
  });
  initColorPalette();
  var stSelect = document.getElementById('s_sleep_timer');
  if (stSelect) stSelect.value = getSet('sleep_timer') || 0;
}

function initColorPalette() {
  var p = document.getElementById('colorPalette');
  if (!p) return;
  var cur = getSet('accent_color') || '#1ED760';
  p.innerHTML = '';
  for (var i = 0; i < COLORS.length; i++) {
    var c = COLORS[i];
    var dot = document.createElement('div');
    dot.className = 'color-dot' + (c === cur ? ' active' : '');
    dot.style.background = c;
    dot.onclick = (function(color) {
      return function() { pickColor(color); };
    })(c);
    p.appendChild(dot);
  }
}

function pickColor(c) {
  saveSet('accent_color', c);
  applyTheme();
  initColorPalette();
}

/* ===== EXPORT / IMPORT ===== */
function exportSettings() {
  var data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    settings: settings,
    playHistory: playHistory,
    favorites: favorites,
    extensions: extensionRegistry
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'openvibes_export_' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function importSettings() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (data.settings) {
          settings = data.settings;
          localStorage.setItem('ov_settings', JSON.stringify(settings));
        }
        if (data.playHistory) {
          playHistory = data.playHistory;
          persistHistory();
        }
        if (data.favorites) {
          favorites = data.favorites;
          persistFavs();
        }
        if (data.extensions) {
          extensionRegistry = data.extensions;
          persistExtensions();
          initExtensionStates();
        }
        loadSettingsUI();
        applyTheme();
        alert('Settings imported successfully!');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ===== TRACK HIGHLIGHTS ===== */
function updateTrackHighlights() {
  document.querySelectorAll('.track').forEach(function(el) {
    var attr = el.getAttribute('data-track');
    if (!attr) return;
    try {
      var t = JSON.parse(attr);
      var isPlaying = S.currentTrack && S.currentTrack.id === t.id;
      el.classList.toggle('playing', isPlaying);
      var favBtn = el.querySelector('.track-actions button');
      if (favBtn) favBtn.textContent = isFavorite(t.id) ? '\u2665' : '\u2661';
    } catch (e) {}
  });
}

/* ===== MINI PLAYER PROGRESS LINE ===== */
function updateMiniProgress() {
  var mini = document.getElementById('miniPlayer');
  if (!mini) return;
  var dur = 0, cur = 0;
  if (S.currentTrack && S.currentTrack.source === 'youtube_music' && S.ytPlayer && S.ytPlayer.getDuration) {
    try { dur = S.ytPlayer.getDuration(); cur = S.ytPlayer.getCurrentTime(); } catch (e) {}
  } else if (S.spAudio) {
    dur = S.spAudio.duration || 0;
    cur = S.spAudio.currentTime || 0;
  } else if (S.playing && S.currentTrack) {
    dur = S.currentTrack.duration || 180;
    if (!S._simStart) S._simStart = Date.now();
    cur = Math.min((Date.now() - S._simStart) / 1000, dur);
  }
  if (dur > 0) {
    var pct = (cur / dur) * 100;
    var styleSheet = document.styleSheets[0];
    if (styleSheet) {
      try {
        var rules = styleSheet.cssRules || styleSheet.rules;
        var found = false;
        for (var i = 0; i < rules.length; i++) {
          if (rules[i].selectorText === '#miniPlayer::before') {
            rules[i].style.width = pct + '%';
            found = true;
            break;
          }
        }
        if (!found) {
          try { styleSheet.insertRule('#miniPlayer::before { width: ' + pct + '%; }', rules.length); } catch (e) {}
        }
      } catch (e) {
        mini.style.setProperty('--mini-progress', pct + '%');
      }
    }
  }
}

/* ===== KEYBOARD SHORTCUTS ===== */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        playerToggle();
        break;
      case 'ArrowRight':
        if (e.ctrlKey || e.metaKey) playerNext();
        break;
      case 'ArrowLeft':
        if (e.ctrlKey || e.metaKey) playerPrev();
        break;
      case 'KeyL':
        if (S.fullOpen) showLyrics();
        break;
      case 'Escape':
        if (S.lyricsOpen) closeLyrics();
        else if (S.fullOpen) closeFullPlayer();
        break;
    }
  });
}

/* ===== NATIVE BRIDGE (Playback ↔ Android Service) ===== */
var NativeBridge = window.NativeBridge || null;
function notifyNative(action, data) {
  if (!NativeBridge) return;
  try {
    switch (action) {
      case 'play':
        NativeBridge.play(
          (data && data.title) || '',
          (data && data.artist) || '',
          (data && data.duration) || 0
        );
        break;
      case 'pause':
        NativeBridge.pause();
        break;
      case 'next':
        NativeBridge.next();
        break;
      case 'prev':
        NativeBridge.prev();
        break;
      case 'stop':
        NativeBridge.stop();
        break;
      case 'update_state':
        NativeBridge.updateState(
          (data && data.title) || '',
          (data && data.artist) || '',
          (data && data.playing) || false,
          (data && data.position) || 0,
          (data && data.duration) || 0
        );
        break;
      case 'focus':
        NativeBridge.requestAudioFocus();
        break;
      case 'abandon_focus':
        NativeBridge.abandonAudioFocus();
        break;
    }
  } catch (e) {}
}

/* ===== AD SAFEGUARDS ===== */
var _adState = { showing: false, type: null, wasPlayingBefore: false };

function onAdBannerShown() {
  _adState = { showing: true, type: 'banner', wasPlayingBefore: S.playing };
  console.log('[AdSafeguard] Banner shown, player was playing: ' + S.playing);
  if (NativeBridge) NativeBridge.logAdEvent('banner', 'shown');
}

function onAdBannerHidden() {
  _adState = { showing: false, type: null, wasPlayingBefore: false };
  console.log('[AdSafeguard] Banner hidden');
  if (NativeBridge) NativeBridge.logAdEvent('banner', 'hidden');
}

function onAdInterstitialShown() {
  _adState = { showing: true, type: 'interstitial', wasPlayingBefore: S.playing };
  console.log('[AdSafeguard] Interstitial shown, player was playing: ' + S.playing);
  if (NativeBridge) NativeBridge.logAdEvent('interstitial', 'shown');
}

function onAdInterstitialDismissed() {
  console.log('[AdSafeguard] Interstitial dismissed, player state: ' + S.playing);
  if (NativeBridge) NativeBridge.logAdEvent('interstitial', 'dismissed');
  _adState = { showing: false, type: null, wasPlayingBefore: false };
}

function assertPlaybackUninterrupted() {
  if (_adState.showing && _adState.wasPlayingBefore && !S.playing) {
    console.error('[AdSafeguard] VIOLATION: Player was playing before ad but is now paused during ad!');
    if (NativeBridge) NativeBridge.logAdEvent('violation', 'playback_interrupted');
  }
}
setInterval(assertPlaybackUninterrupted, 500);

/* ===== handleBack for Android ===== */
function handleBack() {
  if (_adState.showing && _adState.type === 'interstitial') {
    return 'true';
  }
  return 'false';
}

/* ===== handleNativeCommand from Android Service ===== */
function handleNativeCommand(command) {
  console.log('[NativeCommand] ' + command);
  switch (command) {
    case 'play':
      if (S.currentTrack && !S.playing) playerToggle();
      break;
    case 'pause':
      if (S.currentTrack && S.playing) playerToggle();
      break;
    case 'next':
      playerNext();
      break;
    case 'prev':
      playerPrev();
      break;
    case 'shuffle':
      toggleShuffle();
      break;
    case 'repeat':
      toggleRepeat();
      break;
    case 'like':
      if (S.currentTrack) toggleFavorite(S.currentTrack.id);
      break;
    case 'seek':
      break;
  }
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', function() {
  initExtensionStates();
  updateGreeting();
  buildCarousels();
  buildGenres();
  buildSettings();
  loadSettingsUI();
  applyTheme();
  initSearch();
  renderLibrary('playlists');
  updateMiniPlayer();
  initProgressBarSeek();
  initKeyboardShortcuts();
  buildLyricsView();
  if (typeof MusicAPI !== 'undefined') {
    var providerNames = { jiosaavn: 'JioSaavn', ytmusic: 'YouTube Music' };
    var provEl = document.getElementById('valProvider');
    if (provEl) provEl.textContent = providerNames[MusicAPI.getProvider()] || 'JioSaavn';
  }

  if (!checkOnboarding()) {
    showOnboarding();
  }

  var savedSleep = getSet('sleep_timer');
  if (savedSleep && savedSleep > 0) {
    setSleepTimer(savedSleep);
  }
});
