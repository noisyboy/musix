
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

// Parsed synced lyrics cache: [{ time: seconds, text: string }]
let syncedLyrics = [];
let activeLyricIndex = -1;

const LYRICS_OFFSET = 0.2; // Timing offset in seconds
const carousel = document.getElementById('carousel');

// Center carousel on the album art (Slide index 1)
function resetCarouselToCenter(smooth = false) {
    if (carousel) {
        carousel.scrollTo({ left: 240, behavior: smooth ? 'smooth' : 'auto' });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    resetCarouselToCenter(false);
});

// Carousel Indicator Dots Tracking
if (carousel) {
    carousel.addEventListener('scroll', () => {
        const index = Math.round(carousel.scrollLeft / 240);
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
        const title = videoData.title || "Playing Track";
        
        const titleEl = document.getElementById('track-title');
        if (titleEl) titleEl.innerText = title;
        
        const videoId = videoData.video_id;
        if (videoId) {
            const artContainer = document.getElementById('album-art-container');
            if (artContainer) {
                artContainer.innerHTML = `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="Album Art">`;
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
    document.querySelectorAll('.playlist-chip').forEach(btn => btn.classList.remove('active'));
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

    container.innerHTML = '<div id="lyrics-content" style="opacity: 0.6;">Searching lyrics...</div>';
    syncedLyrics = [];
    activeLyricIndex = -1;

    const cleanedTitle = rawTitle
        .replace(/(\[.*?\]|\(.*?\))/g, '')
        .replace(/(official video|official audio|music video|8k|4k|hd|lyrics|audio)/gi, '')
        .trim();

    try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanedTitle)}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const hit = data[0];
            if (hit.syncedLyrics) {
                syncedLyrics = parseLRC(hit.syncedLyrics);
                container.innerHTML = syncedLyrics
                    .map((l, i) => `<div class="lyric-line" id="lyric-${i}">${l.text}</div>`)
                    .join('');
            } else if (hit.plainLyrics) {
                container.innerHTML = `<div style="white-space: pre-wrap; opacity: 0.8;">${hit.plainLyrics}</div>`;
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

function toggleShuffle() {
    if (!player || !player.setShuffle) return;
    isShuffleOn = !isShuffleOn;
    player.setShuffle(isShuffleOn);
    const btn = document.getElementById('btn-shuffle');
    if (btn) btn.classList.toggle('active', isShuffleOn);
}

function toggleLoop() {
    if (!player || !player.setLoop) return;
    loopMode = (loopMode + 1) % 3;
    const btn = document.getElementById('btn-loop');
    const iconLoop = document.getElementById('icon-loop');
    const iconLoopOne = document.getElementById('icon-loop-one');
    
    if (loopMode === 0) {
        player.setLoop(false);
        if (btn) btn.classList.remove('active');
        if (iconLoop) iconLoop.style.display = 'block';
        if (iconLoopOne) iconLoopOne.style.display = 'none';
    } else if (loopMode === 1) {
        player.setLoop(true);
        if (btn) btn.classList.add('active');
        if (iconLoop) iconLoop.style.display = 'block';
        if (iconLoopOne) iconLoopOne.style.display = 'none';
    } else if (loopMode === 2) {
        player.setLoop(true);
        if (btn) btn.classList.add('active');
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
        
        const percentage = duration > 0 ? (current / duration) * 100 : 0;
        
        const progFill = document.getElementById('progress-fill');
        if (progFill) progFill.style.width = `${percentage}%`;
        
        const mainCard = document.getElementById('main-card');
        if (mainCard) mainCard.style.setProperty('--fill-level', `${percentage}%`);
    }
}

const progressBg = document.getElementById('progress-bg');
if (progressBg) {
    progressBg.addEventListener('click', function(e) {
        if (player && player.getDuration) {
            const rect = this.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            const seekTime = percentage * player.getDuration();
            
            player.seekTo(seekTime, true);
            const mainCard = document.getElementById('main-card');
            if (mainCard) mainCard.style.setProperty('--fill-level', `${percentage * 100}%`);
            syncLyricsScroll(seekTime);
        }
    });
}
