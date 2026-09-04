
//---------Service-workder---------------

   // Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}

// MediaSession integration (lets OS hardware keys & lockscreen control playback)
function updateMediaSession(title, artist, artworkUrl) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Cadmium Track',
      artist: artist || 'YouTube Audio',
      album: 'Cadmium Player',
      artwork: [
        { src: artworkUrl || 'icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (player && player.previousVideo) player.previousVideo();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (player && player.nextVideo) player.nextVideo();
    });
  }
}
     

// --- MUSIC DATABASE ---
const MUSIC_DB = {
    default: 'PLJkOl8HwYL9E',
    hiphop_classics: 'PLxA687tYuMWgEVasBziZoZ1Bk7JLnu-Rf', 
    violin_classics:'PLTu5Y9SG5tGys9gUErycyqW9sD77qkfkv', 
    lofi_chill: 'PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo'
};


const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let isShuffleOn = false;
let loopMode = 0; // 0 = Off, 1 = Loop Playlist, 2 = Loop Single
let progressInterval;
let currentSource = 'PLJkOl8HwYL9E'; // Default playlist ID or video array
let lastFetchedTitle = "";
let clockTimer;

// Parsed synced lyrics cache: [{ time: seconds, text: string }]
let syncedLyrics = [];
let activeLyricIndex = -1;
let lyricsRequestId = 0;
let isSeeking = false;

function getSongName(rawTitle) {
    const title = String(rawTitle || 'Playing Track')
        .replace(/\s+/g, ' ')
        .replace(/^\s*[\[(].*?[\])]\s*/g, '')
        .trim();

    return title
        .replace(/\s*(?:\||-|–|—|•|:)\s*(?:official|music|audio|video|lyrics?|lyric|visualizer|remix|4k|8k|hd|full song|feat\.?|ft\.?).*$/i, '')
        .replace(/\s*\((?:official|music|audio|video|lyrics?|visualizer|remix|4k|8k|hd).*?\)\s*$/i, '')
        .trim() || title;
}

const WEATHER_SCENES = [
    { name: 'clear', codes: [0, 1] },
    { name: 'cloudy', codes: [2, 3] },
    { name: 'fog', codes: [45, 48] },
    { name: 'rain', codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82] },
    { name: 'snow', codes: [71, 73, 75, 77, 85, 86] },
    { name: 'storm', codes: [95, 96, 99] }
];

const WEATHER_ACCENTS = {
    clear: ['236, 190, 112', '255, 229, 170'],
    cloudy: ['155, 188, 197', '214, 231, 232'],
    fog: ['174, 190, 180', '225, 236, 222'],
    rain: ['82, 184, 164', '173, 244, 210'],
    snow: ['150, 210, 238', '222, 246, 255'],
    storm: ['92, 150, 224', '188, 221, 255']
};

const WEATHER_BACKGROUNDS = {
    clear: [
        'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=2200&q=88'
    ],
    cloudy: [
        'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=2200&q=88'
    ],
    fog: [
        'https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1516912481808-3406841bd33c?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=2200&q=88'
    ],
    rain: [
        'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1501691223387-dd0500403074?auto=format&fit=crop&w=2200&q=88'
    ],
    snow: [
        'https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1453306458620-5bbef13a5bca?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1548777123-e216912df7d8?auto=format&fit=crop&w=2200&q=88'
    ],
    storm: [
        'https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1527482937786-6b1f7f1ebc8b?auto=format&fit=crop&w=2200&q=88',
        'https://images.unsplash.com/photo-1594156596782-656c93e4d504?auto=format&fit=crop&w=2200&q=88'
    ]
};

const WEATHER_SEARCH_TERMS = {
    clear: 'sunny landscape nature', cloudy: 'cloudy sky landscape', fog: 'fog mist landscape',
    rain: 'rainy landscape', snow: 'snowy landscape', storm: 'thunderstorm landscape'
};
const WEATHER_IMAGE_CACHE_KEY = 'cadmium-weather-images-v1';
let weatherBackgroundLayer;
let weatherBackgroundScene = '';
let weatherImageRequestId = 0;
const weatherUsedImages = {};
const weatherNextPages = {};
const weatherLoadingScenes = new Set();
let weatherBackgroundTimer;
let lastWeatherBackground = '';

function getWeatherImageCache() {
    try { return JSON.parse(localStorage.getItem(WEATHER_IMAGE_CACHE_KEY) || '{}'); }
    catch (error) { return {}; }
}

function saveWeatherImageCache(cache) {
    try { localStorage.setItem(WEATHER_IMAGE_CACHE_KEY, JSON.stringify(cache)); }
    catch (error) { /* The fallback pool remains available. */ }
}

function getWeatherImage(scene) {
    const fallbacks = WEATHER_BACKGROUNDS[scene] || WEATHER_BACKGROUNDS.cloudy;
    const cachedImages = getWeatherImageCache()[scene] || [];
    const images = [...new Set([...cachedImages, ...fallbacks])];
    const usedImages = weatherUsedImages[scene] || [];
    let availableImages = images.filter(image => !usedImages.includes(image) && image !== lastWeatherBackground);
    if (!availableImages.length) {
        weatherUsedImages[scene] = lastWeatherBackground ? [lastWeatherBackground] : [];
        availableImages = images.filter(image => image !== lastWeatherBackground);
        loadWeatherImages(scene);
    }
    const image = availableImages[Math.floor(Math.random() * availableImages.length)];
    weatherUsedImages[scene] = [...(weatherUsedImages[scene] || []), image];
    return image;
}

function getWeatherOverlay(scene) {
    const overlays = {
        clear: 'linear-gradient(135deg, rgba(14, 28, 30, 0.42), rgba(12, 18, 22, 0.28))',
        cloudy: 'linear-gradient(135deg, rgba(13, 19, 23, 0.62), rgba(18, 25, 29, 0.44))',
        fog: 'linear-gradient(135deg, rgba(24, 34, 35, 0.52), rgba(46, 51, 49, 0.34))',
        rain: 'linear-gradient(135deg, rgba(4, 12, 15, 0.7), rgba(8, 14, 19, 0.48))',
        snow: 'linear-gradient(135deg, rgba(22, 32, 37, 0.48), rgba(49, 58, 62, 0.3))',
        storm: 'linear-gradient(135deg, rgba(4, 12, 15, 0.7), rgba(8, 14, 19, 0.48))'
    };
    return overlays[scene] || overlays.cloudy;
}

function applyWeatherBackground(scene, image) {
    if (!weatherBackgroundLayer) {
        weatherBackgroundLayer = document.createElement('div');
        weatherBackgroundLayer.className = 'weather-background-layer';
        weatherBackgroundLayer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(weatherBackgroundLayer);
    }
    weatherBackgroundLayer.style.backgroundImage = `${getWeatherOverlay(scene)}, url("${image}")`;
    weatherBackgroundLayer.classList.remove('weather-background-reveal');
    void weatherBackgroundLayer.offsetWidth;
    weatherBackgroundLayer.classList.add('weather-background-reveal');
}

function rotateWeatherBackground(scene) {
    lastWeatherBackground = getWeatherImage(scene);
    applyWeatherBackground(scene, lastWeatherBackground);
}

async function loadWeatherImages(scene) {
    if (weatherLoadingScenes.has(scene)) return;
    weatherLoadingScenes.add(scene);
    const requestId = ++weatherImageRequestId;
    try {
        const query = WEATHER_SEARCH_TERMS[scene] || WEATHER_SEARCH_TERMS.cloudy;
        const page = weatherNextPages[scene] || 1;
        const response = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=30&page=${page}`);
        if (!response.ok) throw new Error(`Openverse request failed: ${response.status}`);
        const data = await response.json();
        const images = (data.results || []).map(result => result.thumbnail || result.url).filter(Boolean);
        weatherNextPages[scene] = page + 1;
        const cache = getWeatherImageCache();
        cache[scene] = [...new Set([...(cache[scene] || []), ...images])].slice(0, 120);
        saveWeatherImageCache(cache);
        if (requestId === weatherImageRequestId && weatherBackgroundScene === scene) rotateWeatherBackground(scene);
    } catch (error) {
        console.warn(`Openverse background images unavailable for ${scene}:`, error);
    } finally {
        weatherLoadingScenes.delete(scene);
    }
}

function startWeatherBackgroundRotation(scene) {
    clearInterval(weatherBackgroundTimer);
    weatherBackgroundScene = scene;
    rotateWeatherBackground(scene);
    loadWeatherImages(scene);
    weatherBackgroundTimer = setInterval(() => rotateWeatherBackground(scene), 5 * 60 * 1000);
}

function getWeatherScene(weatherCode) {
    return WEATHER_SCENES.find(scene => scene.codes.includes(weatherCode))?.name || 'cloudy';
}

function setWeatherAccent(scene) {
    const mainCard = document.getElementById('main-card');
    const [accent, brightAccent] = WEATHER_ACCENTS[scene] || WEATHER_ACCENTS.rain;
    if (!mainCard) return;
    mainCard.style.setProperty('--background-accent', accent);
    mainCard.style.setProperty('--background-accent-bright', brightAccent);
    mainCard.style.setProperty('--ui-accent', `rgb(${accent})`);
    mainCard.style.setProperty('--ui-accent-bright', `rgb(${brightAccent})`);
}

function getDeviceLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is unavailable'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }),
            reject,
            { enableHighAccuracy: false, timeout: 7000, maximumAge: 900000 }
        );
    });
}

async function getIpLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Primary IP location lookup failed');
        const location = await response.json();
        return { latitude: location.latitude, longitude: location.longitude, city: location.city };
    } catch (error) {
        const response = await fetch('https://ipwho.is/');
        if (!response.ok) throw new Error('IP location lookup failed');
        const location = await response.json();
        return { latitude: location.latitude, longitude: location.longitude, city: location.city };
    }
}

async function updateWeatherBackground() {
    try {
        let location;
        try {
            location = await getDeviceLocation();
        } catch (error) {
            location = await getIpLocation();
        }

        const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code,is_day&timezone=auto`
        );
        if (!weatherResponse.ok) throw new Error('Weather lookup failed');
        const weather = await weatherResponse.json();
        const scene = getWeatherScene(weather.current.weather_code);
        document.body.dataset.weather = scene;
        setWeatherAccent(scene);
        startWeatherBackgroundRotation(scene);

        if (!location.city) {
            const placeResponse = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.latitude}&lon=${location.longitude}`
            );
            if (placeResponse.ok) {
                const place = await placeResponse.json();
                location.city = place.address?.city || place.address?.town || place.address?.village;
            }
        }

        if (location.city) {
            document.body.dataset.city = location.city;
            document.title = `${location.city} - Cadmium Music Player`;
        }
    } catch (error) {
        document.body.dataset.weather = 'rain';
        setWeatherAccent('rain');
        console.warn('Dynamic weather background unavailable:', error);
    }
}

function setArtworkAccent(image) {
    const mainCard = document.getElementById('main-card');
    if (!mainCard) return;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        mainCard.style.setProperty('--art-accent', `${red}, ${green}, ${blue}`);
        const brightRed = Math.round(red + (255 - red) * 0.42);
        const brightGreen = Math.round(green + (255 - green) * 0.42);
        const brightBlue = Math.round(blue + (255 - blue) * 0.42);
        mainCard.style.setProperty('--art-accent-bright', `${brightRed}, ${brightGreen}, ${brightBlue}`);
    } catch (error) {
        mainCard.style.setProperty('--art-accent', '145, 173, 205');
        mainCard.style.setProperty('--art-accent-bright', '191, 207, 226');
    }
}

function extractPlaylistId(value) {
    const input = value.trim();
    if (!input) return null;

    try {
        const url = new URL(input);
        const playlistId = url.searchParams.get('list');
        if (playlistId) return playlistId;
    } catch (error) {
        // The input may be a playlist ID instead of a URL.
    }

    return /^[A-Za-z0-9_-]{10,}$/.test(input) ? input : null;
}

function getSavedPlaylists() {
    try {
        return JSON.parse(localStorage.getItem('cadmium-playlists') || '[]');
    } catch (error) {
        return [];
    }
}

function getHiddenPlaylists() {
    try {
        return JSON.parse(localStorage.getItem('cadmium-hidden-playlists') || '[]');
    } catch (error) {
        return [];
    }
}

function saveHiddenPlaylists(playlists) {
    localStorage.setItem('cadmium-hidden-playlists', JSON.stringify(playlists));
}

function renderCustomPlaylists() {
    const container = document.getElementById('custom-playlists');
    if (!container) return;

    container.replaceChildren(...getSavedPlaylists().map(playlist => {
        const row = document.createElement('div');
        row.className = 'playlist-row';
        const button = document.createElement('button');
        button.className = 'playlist-chip playlist-select custom-playlist-chip';
        button.type = 'button';
        button.textContent = playlist.name;
        button.title = `Play ${playlist.name}`;
        button.onclick = () => switchPlaylist(playlist.id, button);
        const removeButton = document.createElement('button');
        removeButton.className = 'playlist-remove';
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label', `Remove ${playlist.name}`);
        removeButton.title = 'Remove playlist';
        removeButton.textContent = 'x';
        removeButton.onclick = () => removePlaylist(playlist.id, false);
        row.append(button, removeButton);
        return row;
    }));
}

function removePlaylist(playlistId, isDefault) {
    if (isDefault) {
        saveHiddenPlaylists([...new Set([...getHiddenPlaylists(), playlistId])]);
        const row = document.querySelector(`.playlist-row[data-playlist-id="${playlistId}"]`);
        row?.remove();
    } else {
        const savedPlaylists = getSavedPlaylists().filter(playlist => playlist.id !== playlistId);
        localStorage.setItem('cadmium-playlists', JSON.stringify(savedPlaylists));
        renderCustomPlaylists();
    }
}

function restoreHiddenDefaults() {
    document.querySelectorAll('#default-playlists .playlist-row').forEach(row => {
        if (getHiddenPlaylists().includes(row.dataset.playlistId)) row.remove();
    });
}

function addCustomPlaylist(event) {
    event.preventDefault();
    const input = document.getElementById('custom-playlist-input');
    const feedback = document.getElementById('playlist-feedback');
    const playlistId = extractPlaylistId(input?.value || '');

    if (!playlistId) {
        if (feedback) feedback.textContent = 'Enter a valid YouTube playlist URL or ID.';
        return false;
    }

    const savedPlaylists = getSavedPlaylists().filter(playlist => playlist.id !== playlistId);
    const name = `My playlist ${savedPlaylists.length + 1}`;
    savedPlaylists.unshift({ id: playlistId, name });
    localStorage.setItem('cadmium-playlists', JSON.stringify(savedPlaylists.slice(0, 8)));
    renderCustomPlaylists();
    input.value = '';
    if (feedback) feedback.textContent = `${name} added.`;
    return false;
}

const LYRICS_OFFSET = 0.2; // Timing offset in seconds
const carousel = document.getElementById('carousel');

// Center carousel on the album art (Slide index 1)
function resetCarouselToCenter(smooth = false) {
    if (carousel) {
        carousel.scrollTo({ left: carousel.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    resetCarouselToCenter(false);
    updateWeatherBackground();
    renderCustomPlaylists();
    restoreHiddenDefaults();
    setPlayerVolume(Number(localStorage.getItem('cadmium-volume') || 70));
    updateClock();
    clockTimer = setInterval(updateClock, 1000);

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) volumeSlider.addEventListener('input', event => setPlayerVolume(event.target.value));
});

// Carousel Indicator Dots Tracking
if (carousel) {
    carousel.addEventListener('scroll', () => {
        const slideWidth = carousel.clientWidth || 240;
        const index = Math.round(carousel.scrollLeft / slideWidth);
        const dot0 = document.getElementById('dot-0');
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        if (dot0) dot0.classList.toggle('active', index === 0);
        if (dot1) dot1.classList.toggle('active', index === 1);
        if (dot2) dot2.classList.toggle('active', index === 2);
    });
}

function onYouTubeIframeAPIReady() {
    createPlayer(currentSource, false);
}

// Universal player builder (supports playlist IDs, single videos, or video ID arrays)
function createPlayer(source, autoPlay = false) {
    if (player && typeof player.destroy === 'function') {
        player.destroy();
    }

    const container = document.getElementById('player-container');
    if (container) {
        container.innerHTML = '<div id="yt-player"></div>';
    }

let playerVars = {
    'autoplay': autoPlay ? 1 : 0,
    'controls': 0,
    'disablekb': 1,
    'enablejsapi': 1,
    'origin': window.location.origin // Tells YouTube your exact localhost URL
};

    if (Array.isArray(source)) {
        playerVars.playlist = source.join(',');
    } else if (typeof source === 'string' && source.startsWith('PL')) {
        playerVars.listType = 'playlist';
        playerVars.list = source;
    } else if (typeof source === 'string') {
        playerVars.playlist = source;
    }

    player = new YT.Player('yt-player', {
        height: '10',
        width: '10',
        playerVars: playerVars,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    resetCarouselToCenter(false);
    setPlayerVolume(Number(localStorage.getItem('cadmium-volume') || 70));
    if (isShuffleOn && player.setShuffle) player.setShuffle(true);
    if (loopMode === 1 && player.setLoop) player.setLoop(true);
}

function onPlayerStateChange(event) {
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const videoData = player.getVideoData();


    if (event.data === YT.PlayerState.PLAYING) {
        
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        
        const videoData = player.getVideoData();
        const title = getSongName(videoData.title);
        
        const titleEl = document.getElementById('track-title');
        if (titleEl) titleEl.innerText = title;
        
        const videoId = videoData.video_id;
        if (videoId) {
            const artContainer = document.getElementById('album-art-container');
            if (artContainer) {
                const artwork = document.createElement('img');
                const glassOverlay = artContainer.querySelector('.art-glass-overlay');
                artwork.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                artwork.alt = 'Album Art';
                artwork.crossOrigin = 'anonymous';
                artwork.addEventListener('load', () => setArtworkAccent(artwork), { once: true });
                artContainer.replaceChildren(artwork);
                if (glassOverlay) artContainer.appendChild(glassOverlay);
            }
        }
const artUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'icon-512.png';
updateMediaSession(title, "YouTube Stream", artUrl);

        if (title !== lastFetchedTitle) {
            lastFetchedTitle = title;
            fetchLyrics(title);
        }
        
        clearInterval(progressInterval);
        progressInterval = setInterval(updateProgressBar, 100);

    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        clearInterval(progressInterval);
    }
}

// Auto-skip unplayable/restricted tracks
function onPlayerError(event) {
    console.warn("Track skipped or restricted (Error: " + event.data + ")");
    if (player && player.nextVideo) {
        player.nextVideo();
    }
}

// Universal switch function for all playlist chips
function switchPlaylist(source, buttonElement) {
    document.querySelectorAll('.playlist-select').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');

    currentSource = source;
    createPlayer(source, true);
    resetCarouselToCenter(true);
}

// Helper alias for video arrays
function switchVideoQueue(videoIdsArray, buttonElement) {
    switchPlaylist(videoIdsArray, buttonElement);
}

// --- Synced Lyrics Engine ---

function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

    for (const line of lines) {
        const match = timeReg.exec(line);
        if (match) {
            const mins = parseInt(match[1], 10);
            const secs = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0').substring(0, 3), 10) / 1000 : 0;
            const time = mins * 60 + secs + ms;
            const text = line.replace(timeReg, '').trim();
            if (text) {
                result.push({ time, text });
            }
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

async function fetchLyrics(rawTitle) {
    const container = document.getElementById('lyrics-container');
    if (!container) return;
    const requestId = ++lyricsRequestId;

    container.innerHTML = '<div id="lyrics-content" style="opacity: 0.6;">Searching lyrics...</div>';
    syncedLyrics = [];
    activeLyricIndex = -1;

    const cleanedTitle = rawTitle
        .replace(/(\[.*?\]|\(.*?\))/g, '')
        .replace(/(official video|official audio|music video|8k|4k|hd|lyrics|audio)/gi, '')
        .trim();

    try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanedTitle)}`);
        if (!res.ok) throw new Error(`Lyrics request failed: ${res.status}`);
        const data = await res.json();

        if (requestId !== lyricsRequestId) return;
        
        if (data && data.length > 0) {
            const hit = data[0];
            if (hit.syncedLyrics) {
                syncedLyrics = parseLRC(hit.syncedLyrics);
                container.replaceChildren(...syncedLyrics.map((lyric, index) => {
                    const line = document.createElement('div');
                    line.className = 'lyric-line';
                    line.id = `lyric-${index}`;
                    line.textContent = lyric.text;
                    return line;
                }));
            } else if (hit.plainLyrics) {
                const plainLyrics = document.createElement('div');
                plainLyrics.style.whiteSpace = 'pre-wrap';
                plainLyrics.style.opacity = '0.8';
                plainLyrics.textContent = hit.plainLyrics;
                container.replaceChildren(plainLyrics);
            } else {
                container.innerHTML = '<div style="opacity: 0.6;">No lyrics found for this track.</div>';
            }
        } else {
            container.innerHTML = '<div style="opacity: 0.6;">No lyrics found for this track.</div>';
        }
    } catch (err) {
        container.innerHTML = '<div style="opacity: 0.6;">Could not load lyrics.</div>';
    }
}

function syncLyricsScroll(currentTime) {
    if (!syncedLyrics.length) return;

    const adjustedTime = currentTime + LYRICS_OFFSET;

    let currentIndex = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
        if (adjustedTime >= syncedLyrics[i].time) {
            currentIndex = i;
        } else {
            break;
        }
    }

    if (currentIndex !== -1 && currentIndex !== activeLyricIndex) {
        const prevEl = document.getElementById(`lyric-${activeLyricIndex}`);
        if (prevEl) prevEl.classList.remove('active');

        activeLyricIndex = currentIndex;
        const activeEl = document.getElementById(`lyric-${activeLyricIndex}`);
        
        if (activeEl) {
            activeEl.classList.add('active');
            
            const container = document.getElementById('lyrics-container');
            if (container) {
                const targetScroll = (activeEl.offsetTop - container.offsetTop) - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
                container.scrollTo({
                    top: Math.max(0, targetScroll),
                    behavior: 'smooth'
                });
            }
        }
    }
}

// --- Playback Controls ---

function togglePlayPause() {
    if (!player || !player.getPlayerState) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function setPlayerVolume(value) {
    const volume = Math.max(0, Math.min(100, Number(value) || 0));
    const slider = document.getElementById('volume-slider');
    const output = document.getElementById('volume-value');
    if (slider) {
        slider.value = String(volume);
        slider.setAttribute('aria-valuenow', String(volume));
    }
    if (output) output.textContent = `${volume}%`;
    localStorage.setItem('cadmium-volume', String(volume));
    if (player && player.setVolume) player.setVolume(volume);
}

function updateClock() {
    const now = new Date();
    const clock = document.getElementById('live-clock');
    const date = document.getElementById('live-date');
    if (clock) {
        clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        clock.dateTime = now.toISOString();
    }
    if (date) date.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function toggleShuffle() {
    if (!player || !player.setShuffle) return;
    isShuffleOn = !isShuffleOn;
    player.setShuffle(isShuffleOn);
    const btn = document.getElementById('btn-shuffle');
    if (btn) {
        btn.classList.toggle('active', isShuffleOn);
        btn.setAttribute('aria-pressed', String(isShuffleOn));
    }
}

function toggleLoop() {
    if (!player || !player.setLoop) return;
    loopMode = (loopMode + 1) % 3;
    const btn = document.getElementById('btn-loop');
    const iconLoop = document.getElementById('icon-loop');
    const iconLoopOne = document.getElementById('icon-loop-one');
    
    if (loopMode === 0) {
        player.setLoop(false);
        if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        }
        if (iconLoop) iconLoop.style.display = 'block';
        if (iconLoopOne) iconLoopOne.style.display = 'none';
    } else if (loopMode === 1) {
        player.setLoop(true);
        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        }
        if (iconLoop) iconLoop.style.display = 'block';
        if (iconLoopOne) iconLoopOne.style.display = 'none';
    } else if (loopMode === 2) {
        player.setLoop(true);
        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        }
        if (iconLoop) iconLoop.style.display = 'none';
        if (iconLoopOne) iconLoopOne.style.display = 'block';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateProgressBar() {
    if (player && player.getCurrentTime && player.getDuration) {
        const current = player.getCurrentTime();
        const duration = player.getDuration();

        if (isSeeking) return;
        
        syncLyricsScroll(current);

        // Single-track loop preemptive seek override
        if (loopMode === 2 && duration > 0 && (duration - current) < 0.4) {
            player.seekTo(0, true);
            return;
        }
        
        const curTimeEl = document.getElementById('current-time');
        const totTimeEl = document.getElementById('total-time');
        if (curTimeEl) curTimeEl.innerText = formatTime(current);
        if (totTimeEl) totTimeEl.innerText = formatTime(duration);
        
        const percentage = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;
        
        const progFill = document.getElementById('progress-fill');
        if (progFill) progFill.style.width = `${percentage}%`;

        const progressBg = document.getElementById('progress-bg');
        if (progressBg) {
            progressBg.setAttribute('aria-valuemax', String(Math.round(duration)));
            progressBg.setAttribute('aria-valuenow', String(Math.round(current)));
            progressBg.setAttribute('aria-valuetext', formatTime(current));
        }
        
    }
}

const progressBg = document.getElementById('progress-bg');
if (progressBg) {
    function seekToClientPosition(clientX) {
        if (!player || !player.getDuration) return;

        const duration = player.getDuration();
        if (!Number.isFinite(duration) || duration <= 0) return;

        const rect = progressBg.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const seekTime = percentage * duration;
        player.seekTo(seekTime, true);

        const percentageValue = percentage * 100;
        const progFill = document.getElementById('progress-fill');
        if (progFill) progFill.style.width = `${percentageValue}%`;
        progressBg.setAttribute('aria-valuemax', String(Math.round(duration)));
        progressBg.setAttribute('aria-valuenow', String(Math.round(seekTime)));
        progressBg.setAttribute('aria-valuetext', formatTime(seekTime));

        const curTimeEl = document.getElementById('current-time');
        if (curTimeEl) curTimeEl.innerText = formatTime(seekTime);
        syncLyricsScroll(seekTime);
    }

    progressBg.addEventListener('pointerdown', (event) => {
        isSeeking = true;
        progressBg.setPointerCapture(event.pointerId);
        seekToClientPosition(event.clientX);
    });

    progressBg.addEventListener('pointermove', (event) => {
        if (isSeeking) seekToClientPosition(event.clientX);
    });

    progressBg.addEventListener('pointerup', (event) => {
        seekToClientPosition(event.clientX);
        isSeeking = false;
        progressBg.releasePointerCapture(event.pointerId);
    });

    progressBg.addEventListener('pointercancel', () => {
        isSeeking = false;
    });

    progressBg.addEventListener('keydown', (event) => {
        if (!player || !player.getDuration || !player.getCurrentTime) return;

        const duration = player.getDuration();
        const current = player.getCurrentTime();
        let seekTime;
        if (event.key === 'ArrowLeft') seekTime = current - 5;
        else if (event.key === 'ArrowRight') seekTime = current + 5;
        else if (event.key === 'Home') seekTime = 0;
        else if (event.key === 'End') seekTime = duration;
        else return;

        event.preventDefault();
        seekToClientPosition(progressBg.getBoundingClientRect().left + (Math.max(0, Math.min(duration, seekTime)) / duration) * progressBg.getBoundingClientRect().width);
    });
}
