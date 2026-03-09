// main.js
// Clean 360° video player for A-Frame

if (window.AFRAME && !AFRAME.components['pitch-clamp']) {
  AFRAME.registerComponent('pitch-clamp', {
    schema: {
      min: { type: 'number', default: -20 },
      max: { type: 'number', default: 20 }
    },
    tick: function () {
      var obj = this.el.object3D;
      if (!obj) return;

      var pitchDeg = THREE.MathUtils.radToDeg(obj.rotation.x);
      var clamped = Math.min(this.data.max, Math.max(this.data.min, pitchDeg));
      obj.rotation.x = THREE.MathUtils.degToRad(clamped);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {

  /* ------------------------------
     Video selection
  ------------------------------ */

  var allowedVideos = {
    'videos/studio.mp4': true,
    'videos/paddock.mp4': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedVid = params.get('vid');
  var selectedVid = (requestedVid && allowedVideos[requestedVid])
    ? requestedVid
    : 'videos/studio.mp4';

  if (!requestedVid || !allowedVideos[requestedVid]) {
    console.log('video.html fallback vid:', requestedVid);
  }

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  /* ------------------------------
     Elements
  ------------------------------ */

  var videoEl = document.getElementById('videoTexture');
  var sphereEl = document.getElementById('video-sphere');
  var cameraEl = document.getElementById('video-camera');

  var playBtn = document.getElementById('play-video');
  var toggleBtn = document.getElementById('toggle-play');
  var stopBtn = document.getElementById('stop-video');
  var enableMotionBtn = document.getElementById('enable-motion-btn');

  if (!videoEl || !sphereEl) return;

  /* ------------------------------
     Initial video setup
  ------------------------------ */

  videoEl.loop = true;
  videoEl.autoplay = false;
  videoEl.preload = 'auto';
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');

  videoEl.src = selectedVid;
  videoEl.load();

  sphereEl.setAttribute('src', '#videoTexture');
  sphereEl.setAttribute('material', 'opacity', 0);

  // Freeze frame render
  videoEl.addEventListener('loadeddata', function () {
    try {
      // Only force a freeze-frame when playback has NOT been user initiated.
      // Otherwise this handler can race with the first Play tap and cause a "needs two taps" issue.
      if (!userInitiatedPlay && !hasStartedPlayback) {
        videoEl.currentTime = 0.01;
        videoEl.pause();
        sphereEl.setAttribute('material', 'opacity', 1);
      }
    } catch (e) {}
  });

  /* ------------------------------
     Fade-in on first play
  ------------------------------ */

  var hasStartedPlayback = false;
  var userInitiatedPlay = false;

  function fadeInSphere() {
    sphereEl.setAttribute('material', 'opacity', 0);

    sphereEl.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: 0,
      to: 1,
      dur: 500,
      easing: 'easeOutQuad'
    });
  }

  /* ------------------------------
     Pseudo spatial audio
  ------------------------------ */

  var audioCtx = null;
  var sourceNode = null;
  var panner = null;
  var rafId = 0;

  function getYawRad() {
    if (!cameraEl) return 0;
    var lc = cameraEl.components['look-controls'];
    if (lc && lc.yawObject) return lc.yawObject.rotation.y || 0;
    return 0;
  }

  function startSpatialAudio() {
    if (!panner) return;

    function tick() {
      if (videoEl.paused) return;
      var yaw = getYawRad();
      var pan = Math.max(-0.65, Math.min(0.65, yaw / (Math.PI / 2)));
      panner.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.05);
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  }

  function stopSpatialAudio() {
    if (rafId) cancelAnimationFrame(rafId);
  }

  function ensureSpatialAudio() {
    if (audioCtx) return;

    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    audioCtx = new Ctx();
    sourceNode = audioCtx.createMediaElementSource(videoEl);
    panner = audioCtx.createStereoPanner();

    sourceNode.connect(panner);
    panner.connect(audioCtx.destination);
  }

  /* ------------------------------
     UI Logic
  ------------------------------ */

  function updateUI() {
    if (!playBtn || !toggleBtn) return;
    var playing = !videoEl.paused;
    playBtn.style.display = playing ? 'none' : 'block';
    toggleBtn.textContent = playing ? 'Pause' : 'Play';
  }

  if (playBtn) {
    playBtn.addEventListener('click', function () {
      userInitiatedPlay = true;
      ensureSpatialAudio();
      videoEl.play().then(function () {
        if (!hasStartedPlayback) {
          fadeInSphere();
          hasStartedPlayback = true;
        }
        startSpatialAudio();
        updateUI();
      });
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      if (videoEl.paused) {
        userInitiatedPlay = true;
        videoEl.play().then(function () {
          startSpatialAudio();
          updateUI();
        });
      } else {
        videoEl.pause();
        stopSpatialAudio();
        updateUI();
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', function () {
      videoEl.pause();
      stopSpatialAudio();
      userInitiatedPlay = false;
      videoEl.currentTime = 0.01;
      updateUI();
    });
  }

  videoEl.addEventListener('play', updateUI);
  videoEl.addEventListener('pause', updateUI);

  /* ------------------------------
     Mobile autoplay guard
  ------------------------------ */

  if (isMobile) {
    videoEl.addEventListener('play', function () {
      if (!userInitiatedPlay && !hasStartedPlayback) {
        videoEl.pause();
      }
    });
  }

  /* ------------------------------
     Motion Controls Button
  ------------------------------ */

  if (enableMotionBtn && isMobile && cameraEl) {
    enableMotionBtn.style.display = 'block';

    var verifyOrientationEvents = function () {
      return new Promise(function (resolve) {
        var gotEvent = false;
        var handler = function () {
          gotEvent = true;
        };
        window.addEventListener('deviceorientation', handler, { passive: true });
        window.setTimeout(function () {
          window.removeEventListener('deviceorientation', handler);
          resolve(gotEvent);
        }, 800);
      });
    };

    enableMotionBtn.addEventListener('click', function () {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {

        DeviceOrientationEvent.requestPermission()
          .then(function (state) {
            if (state === 'granted') {
              cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
              verifyOrientationEvents().then(function (gotEvent) {
                if (!gotEvent) {
                  window.alert('Gyro/motion seems blocked in this browser/context. On many Android browsers (including Samsung Internet) you may need to open the site over HTTPS (not http://LAN-IP) for device motion to work.');
                } else {
                  enableMotionBtn.style.display = 'none';
                }
              });
            }
          });
      } else {
        cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
        verifyOrientationEvents().then(function (gotEvent) {
          if (!gotEvent) {
            window.alert('Gyro/motion seems blocked in this browser/context. On many Android browsers (including Samsung Internet) you may need to open the site over HTTPS (not http://LAN-IP) for device motion to work.');
          } else {
            enableMotionBtn.style.display = 'none';
          }
        });
      }
    });
  }

});
