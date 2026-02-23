// main.js
// Initialize the A-Frame 360 video viewer

document.addEventListener('DOMContentLoaded', function () {
  var allowedVideos = {
    'studio.mp4': true,
    'paddock.mp4': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedVid = params.get('vid');
  var selectedVid = (requestedVid && allowedVideos[requestedVid]) ? requestedVid : 'studio.mp4';

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  var fovParam = params.get('fov');
  var desiredFov;
  if (fovParam) {
    desiredFov = Number(fovParam);
  } else {
    if (isMobile) {
      desiredFov = (selectedVid === 'studio.mp4') ? 120 : 90;
    } else {
      desiredFov = 45;
    }
  }
  if (!Number.isFinite(desiredFov)) desiredFov = (isMobile ? 90 : 45);
  desiredFov = Math.max(30, Math.min(120, desiredFov));

  var videoEl = document.getElementById('videoTexture');
  if (videoEl) {
    videoEl.src = selectedVid;
    videoEl.loop = true;
  }

  var playBtn = document.getElementById('play-video');
  var toggleBtn = document.getElementById('toggle-play');
  var stopBtn = document.getElementById('stop-video');
  var setPlayUi = function () {
    if (!playBtn) return;
    playBtn.style.display = (videoEl && !videoEl.paused) ? 'none' : 'block';

    if (toggleBtn) {
      toggleBtn.textContent = (videoEl && !videoEl.paused) ? 'Pause' : 'Play';
    }
  };

  if (playBtn && videoEl) {
    playBtn.addEventListener('click', function () {
      videoEl.play().then(function () {
        setPlayUi();
      }).catch(function () {
        setPlayUi();
      });
    });

    videoEl.addEventListener('play', setPlayUi);
    videoEl.addEventListener('pause', setPlayUi);
    videoEl.addEventListener('ended', setPlayUi);
  }

  if (toggleBtn && videoEl) {
    toggleBtn.addEventListener('click', function () {
      if (videoEl.paused) {
        videoEl.play().then(function () {
          setPlayUi();
        }).catch(function () {
          setPlayUi();
        });
      } else {
        videoEl.pause();
        setPlayUi();
      }
    });
  }

  if (stopBtn && videoEl) {
    stopBtn.addEventListener('click', function () {
      videoEl.pause();
      try {
        videoEl.currentTime = 0;
      } catch (e) {
        // ignore
      }
      setPlayUi();
    });
  }

  var cameraEl = document.getElementById('video-camera');
  if (cameraEl) {
    cameraEl.setAttribute('fov', desiredFov);
  }

  var sceneEl = document.querySelector('a-scene');
  if (sceneEl && videoEl) {
    sceneEl.addEventListener('loaded', function () {
      videoEl.play().then(function () {
        setPlayUi();
      }).catch(function () {
        setPlayUi();
      });
    });
  }

  // Show Enable Motion Controls button on iOS if needed
  var enableMotionBtn = document.getElementById('enable-motion-btn');
  if (enableMotionBtn && isMobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    enableMotionBtn.style.display = 'block';
    enableMotionBtn.addEventListener('click', function() {
      DeviceOrientationEvent.requestPermission().then(function(permissionState) {
        if (permissionState === 'granted') {
          enableMotionBtn.style.display = 'none';
          window.location.reload();
        }
      }).catch(console.error);
    });
  } else if (enableMotionBtn) {
    enableMotionBtn.style.display = 'none';
  }
});