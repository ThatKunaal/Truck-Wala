/* ============================================================
   HORN OK PLEASE
   LOCAL MUSIC PLAYER

   Playback engine:
   Native HTML5 Audio

   NO YOUTUBE
   NO YOUTUBE API
   NO IFRAME
============================================================ */

(function () {

  "use strict";


  /* ==========================================================
     DOM ELEMENTS
  ========================================================== */

  const clockEl =
    document.getElementById("clockTime");

  const thumbEl =
    document.getElementById("songThumb");

  const titleEl =
    document.getElementById("songTitle");

  const artistEl =
    document.getElementById("songArtist");

  const statusEl =
    document.getElementById("playerStatus");


  /* ---------------- CONTROLS ---------------- */

  const btnPrev =
    document.getElementById("btnPrev");

  const btnPlay =
    document.getElementById("btnPlay");

  const btnNext =
    document.getElementById("btnNext");


  /* ---------------- PLAY / PAUSE ICONS ---------------- */

  const iconPlay =
    btnPlay
      ? btnPlay.querySelector(".icon-play")
      : null;

  const iconPause =
    btnPlay
      ? btnPlay.querySelector(".icon-pause")
      : null;


  /* ---------------- PROGRESS ---------------- */

  const progressFillEl =
    document.getElementById("progressFill");

  const progressHandleEl =
    document.getElementById("progressHandle");

  const progressTrackEl =
    document.getElementById("progressTrack");

  const timeCurrentEl =
    document.getElementById("timeCurrent");

  const timeDurationEl =
    document.getElementById("timeDuration");


  const playerCardEl =
    document.querySelector(".player");


  /* ==========================================================
     AUDIO ENGINE
  ========================================================== */

  const audio =
    document.getElementById("audioPlayer") ||
    new Audio();

  audio.preload = "metadata";


  /* ==========================================================
     PLAYER STATE
  ========================================================== */

  let currentSongIndex = 0;

  let playbackHistory = [];

  /*
     NEW:
     Stores songs that have NOT been played
     in the current shuffle cycle.

     This prevents a song from repeating
     until every song has played once.
  */
  let unplayedSongIndices = [];

  let isNavigatingHistory = false;

  let statusClearTimeoutId = null;


  /* ==========================================================
     CLOCK
  ========================================================== */

  function initClock() {

    if (!clockEl) {
      return;
    }


    function formatClock(date) {

      let hours =
        date.getHours();

      const minutes =
        date.getMinutes();


      const suffix =
        hours >= 12
          ? "pm"
          : "am";


      hours =
        hours % 12 || 12;


      return (
        `${hours}:${String(minutes).padStart(2, "0")} ${suffix}`
      );

    }


    function tick() {

      clockEl.textContent =
        formatClock(new Date());

    }


    tick();

    setInterval(
      tick,
      30000
    );

  }


  /* ==========================================================
     FORMAT TIME
  ========================================================== */

  function formatTime(totalSeconds) {

    const seconds =
      Math.max(
        0,
        Math.floor(
          Number(totalSeconds) || 0
        )
      );


    const minutes =
      Math.floor(seconds / 60);


    const remainingSeconds =
      String(
        seconds % 60
      ).padStart(2, "0");


    return (
      `${minutes}:${remainingSeconds}`
    );

  }


  /* ==========================================================
     STATUS MESSAGE
  ========================================================== */

  function setStatus(
    message,
    isError = false
  ) {

    if (!statusEl) {
      return;
    }


    clearTimeout(
      statusClearTimeoutId
    );


    statusEl.textContent =
      message || "";


    statusEl.classList.toggle(
      "is-error",
      Boolean(isError)
    );


    statusEl.classList.toggle(
      "is-visible",
      Boolean(message)
    );


    if (message) {

      statusClearTimeoutId =
        setTimeout(
          () => {

            statusEl.classList.remove(
              "is-visible"
            );

          },
          4000
        );

    }

  }


  /* ==========================================================
     PLAY / PAUSE BUTTON STATE
  ========================================================== */

  function setPlayButtonState(
    isPlaying
  ) {

    if (!btnPlay) {
      return;
    }


    btnPlay.setAttribute(
      "aria-pressed",
      String(isPlaying)
    );


    btnPlay.setAttribute(
      "aria-label",
      isPlaying
        ? "Pause"
        : "Play"
    );


    if (iconPlay) {

      iconPlay.hidden =
        isPlaying;

    }


    if (iconPause) {

      iconPause.hidden =
        !isPlaying;

    }

  }


  /* ==========================================================
     BUFFERING STATE
  ========================================================== */

  function setBufferingState(
    isBuffering
  ) {

    if (!playerCardEl) {
      return;
    }


    playerCardEl.classList.toggle(
      "is-buffering",
      Boolean(isBuffering)
    );

  }


  /* ==========================================================
     UPDATE PROGRESS UI
  ========================================================== */

  function updateProgressUI(
    currentTime,
    duration
  ) {

    const safeDuration =
      Number.isFinite(duration)
        ? duration
        : 0;


    const safeCurrent =
      Number.isFinite(currentTime)
        ? currentTime
        : 0;


    const percent =
      safeDuration > 0
        ? Math.min(
            100,
            Math.max(
              0,
              (safeCurrent / safeDuration) * 100
            )
          )
        : 0;


    if (progressFillEl) {

      progressFillEl.style.width =
        `${percent}%`;

    }


    if (progressHandleEl) {

      progressHandleEl.style.left =
        `${percent}%`;

    }


    if (timeCurrentEl) {

      timeCurrentEl.textContent =
        formatTime(safeCurrent);

    }


    if (timeDurationEl) {

      timeDurationEl.textContent =
        safeDuration > 0
          ? formatTime(safeDuration)
          : "0:00";

    }

  }


  /* ==========================================================
     GET CURRENT SONG
  ========================================================== */

  function getCurrentSong() {

    return (
      songs[currentSongIndex] ||
      null
    );

  }


  /* ==========================================================
     THUMBNAIL
  ========================================================== */

  function setThumbnail(song) {

    if (!thumbEl || !song) {
      return;
    }


    thumbEl.alt =
      `Album art for ${song.title}`;


    thumbEl.onerror =
      function () {

        thumbEl.onerror = null;

        thumbEl.src =
          "images/thumbnail-placeholder.svg";

      };


    thumbEl.src =
      song.thumbnail ||
      "images/thumbnail-placeholder.svg";

  }


  /* ==========================================================
     RENDER CURRENT SONG
  ========================================================== */

  function renderSong(song) {

    if (!song) {
      return;
    }


    if (titleEl) {

      titleEl.textContent =
        song.title;

    }


    if (artistEl) {

      artistEl.textContent =
        song.artist;

    }


    setThumbnail(song);


    updateProgressUI(
      0,
      0
    );


    setStatus("");

  }


  /* ==========================================================
     LOAD SONG
  ========================================================== */

  function loadSong(
    index,
    options = {}
  ) {

    const {

      autoplay = false,

      addToHistory = true,

      resetTime = true

    } = options;


    /* ---------------- NO SONGS ---------------- */

    if (
      !Array.isArray(songs) ||
      songs.length === 0
    ) {

      setStatus(
        "No songs available.",
        true
      );

      return false;

    }


    /* ---------------- NORMALIZE INDEX ---------------- */

    const nextIndex =
      (
        index % songs.length +
        songs.length
      ) % songs.length;


    const previousIndex =
      currentSongIndex;


    currentSongIndex =
      nextIndex;


    /* ---------------- HISTORY ---------------- */

    if (
      addToHistory &&
      !isNavigatingHistory &&
      previousIndex !== nextIndex
    ) {

      playbackHistory.push(
        previousIndex
      );

    }


    /* ---------------- SONG ---------------- */

    const song =
      getCurrentSong();


    if (!song) {

      setStatus(
        "Song unavailable.",
        true
      );

      return false;

    }


    renderSong(song);


    setBufferingState(false);

    setPlayButtonState(false);


    /* ---------------- STOP OLD SONG ---------------- */

    audio.pause();


    /* ---------------- SET NEW FILE ---------------- */

    audio.src =
      song.src;


    /* ---------------- RESET POSITION ---------------- */

    if (resetTime) {

      try {

        audio.currentTime =
          0;

      } catch (error) {

        // Metadata may not have loaded yet.

      }

    }


    /* ---------------- LOAD ---------------- */

    audio.load();


    /* ---------------- AUTOPLAY ---------------- */

    if (autoplay) {

      playCurrentSong();

    }


    return true;

  }


  /* ==========================================================
     SHUFFLE POOL
  ========================================================== */

  function initializeShufflePool() {

    if (
      !Array.isArray(songs) ||
      songs.length === 0
    ) {

      unplayedSongIndices = [];

      return;

    }


    /*
       Song 1 is loaded initially.

       Therefore all OTHER songs are placed
       into the unplayed pool.
    */

    unplayedSongIndices =
      songs
        .map(
          (_, index) => index
        )
        .filter(
          index =>
            index !== currentSongIndex
        );

  }


  /* ==========================================================
     GET RANDOM UNPLAYED SONG
  ========================================================== */

  function getRandomSongIndex() {

    /*
       No songs left in the current cycle.
    */

    if (
      unplayedSongIndices.length === 0
    ) {

      return -1;

    }


    /*
       Pick a random position from
       the unplayed pool.
    */

    const randomPosition =
      Math.floor(
        Math.random() *
        unplayedSongIndices.length
      );


    const randomIndex =
      unplayedSongIndices[
        randomPosition
      ];


    /*
       IMPORTANT:

       Remove the selected song immediately.

       Therefore it cannot be selected
       again until a new cycle starts.
    */

    unplayedSongIndices.splice(
      randomPosition,
      1
    );


    return randomIndex;

  }


  /* ==========================================================
   NEXT SONG
   Play every song once.
   After all songs are played, start a NEW shuffle cycle.
   ========================================================== */

function playNextSong() {

  if (
    !Array.isArray(songs) ||
    songs.length === 0
  ) {
    return;
  }


  /* Get a random song that hasn't played yet */

  let nextIndex =
    getRandomSongIndex();


  /*
     All songs have played.

     Instead of stopping, create a fresh
     shuffle pool and continue playing.
  */

  if (nextIndex === -1) {

    initializeShufflePool();

    nextIndex =
      getRandomSongIndex();

  }


  /*
     Play the next random song.
  */

  if (nextIndex !== -1) {

    loadSong(
      nextIndex,
      {
        autoplay: true,
        addToHistory: true
      }
    );

  }

}

  /* ==========================================================
     PREVIOUS SONG
  ========================================================== */

  function playPreviousSong() {

    if (
      playbackHistory.length === 0
    ) {

      setStatus(
        "No previous song yet."
      );

      return;

    }


    const previousIndex =
      playbackHistory.pop();


    isNavigatingHistory =
      true;


    loadSong(
      previousIndex,
      {
        autoplay: true,
        addToHistory: false
      }
    );


    isNavigatingHistory =
      false;

  }


  /* ==========================================================
     PLAY CURRENT SONG
  ========================================================== */

  async function playCurrentSong() {

    if (!audio.src) {

      setStatus(
        "No song loaded.",
        true
      );

      return;

    }


    try {

      setBufferingState(
        true
      );


      await audio.play();


      setBufferingState(
        false
      );


      setStatus("");

    }

    catch (error) {

      setBufferingState(
        false
      );


      setPlayButtonState(
        false
      );


      if (
        error &&
        error.name === "NotAllowedError"
      ) {

        setStatus(
          "Press Play to start the song.",
          true
        );

      }

      else {

        setStatus(
          "This song could not be played.",
          true
        );

      }


      console.error(
        "[Horn OK Please] Playback error:",
        error
      );

    }

  }


  /* ==========================================================
     PLAY / PAUSE
  ========================================================== */

  function togglePlayPause() {

    if (audio.paused) {

      playCurrentSong();

    }

    else {

      audio.pause();

    }

  }


  /* ==========================================================
     SEEK
  ========================================================== */

  function seekFromClientX(
    clientX
  ) {

    if (
      !progressTrackEl ||
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {

      return;

    }


    const rect =
      progressTrackEl.getBoundingClientRect();


    if (
      rect.width <= 0
    ) {

      return;

    }


    const fraction =
      Math.min(
        1,
        Math.max(
          0,
          (
            clientX -
            rect.left
          ) / rect.width
        )
      );


    audio.currentTime =
      audio.duration *
      fraction;


    updateProgressUI(
      audio.currentTime,
      audio.duration
    );

  }


  /* ==========================================================
     AUDIO EVENTS
  ========================================================== */

  audio.addEventListener(
    "play",
    function () {

      setPlayButtonState(
        true
      );


      setBufferingState(
        false
      );

    }
  );


  audio.addEventListener(
    "playing",
    function () {

      setPlayButtonState(
        true
      );


      setBufferingState(
        false
      );


      setStatus("");

    }
  );


  audio.addEventListener(
    "pause",
    function () {

      setPlayButtonState(
        false
      );


      setBufferingState(
        false
      );

    }
  );


  audio.addEventListener(
    "waiting",
    function () {

      setBufferingState(
        true
      );

    }
  );


  audio.addEventListener(
    "canplay",
    function () {

      setBufferingState(
        false
      );

    }
  );


  audio.addEventListener(
    "loadedmetadata",
    function () {

      updateProgressUI(
        audio.currentTime,
        audio.duration
      );

    }
  );


  audio.addEventListener(
    "durationchange",
    function () {

      updateProgressUI(
        audio.currentTime,
        audio.duration
      );

    }
  );


  audio.addEventListener(
    "timeupdate",
    function () {

      updateProgressUI(
        audio.currentTime,
        audio.duration
      );

    }
  );


  /* ==========================================================
     SONG ENDED

     Automatically play another RANDOM
     UNPLAYED song.

     When every song has played once:
     STOP.
  ========================================================== */

  audio.addEventListener(
    "ended",
    function () {

      setPlayButtonState(
        false
      );


      setBufferingState(
        false
      );


      updateProgressUI(
        audio.duration || 0,
        audio.duration || 0
      );


      /*
         This will either:

         1. Play another unplayed random song

         OR

         2. Stop if all songs are finished.
      */

      playNextSong();

    }
  );


  /* ==========================================================
     AUDIO ERROR
  ========================================================== */

  audio.addEventListener(
    "error",
    function () {

      setPlayButtonState(
        false
      );


      setBufferingState(
        false
      );


      setStatus(
        "Song unavailable. Try Next.",
        true
      );


      console.error(
        "[Horn OK Please] Audio error:",
        audio.error
      );

    }
  );


  /* ==========================================================
     UI CONTROLS
  ========================================================== */

  function wireControls() {


    /* ---------------- PLAY ---------------- */

    if (btnPlay) {

      btnPlay.addEventListener(
        "click",
        togglePlayPause
      );

    }


    /* ---------------- NEXT ---------------- */

    if (btnNext) {

      btnNext.addEventListener(
        "click",
        playNextSong
      );

    }


    /* ---------------- PREVIOUS ---------------- */

    if (btnPrev) {

      btnPrev.addEventListener(
        "click",
        playPreviousSong
      );

    }


    /* ---------------- SEEK ---------------- */

    if (progressTrackEl) {

      progressTrackEl.addEventListener(
        "click",
        function (event) {

          seekFromClientX(
            event.clientX
          );

        }
      );


      progressTrackEl.addEventListener(
        "touchend",
        function (event) {

          if (
            !event.changedTouches ||
            !event.changedTouches.length
          ) {

            return;

          }


          seekFromClientX(
            event.changedTouches[0].clientX
          );

        },
        {
          passive: true
        }
      );

    }

  }


  /* ==========================================================
     BOOT
  ========================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    function () {

      initClock();

      wireControls();


      /* ---------------- START WITH SONG 1 ---------------- */

      currentSongIndex = 0;

      playbackHistory = [];


      /*
         Create the initial unplayed pool.

         Song 1 is loaded first,
         so it is NOT added to the pool.
      */

      initializeShufflePool();


      loadSong(
        currentSongIndex,
        {
          autoplay: false,
          addToHistory: false
        }
      );

    }
  );


})();