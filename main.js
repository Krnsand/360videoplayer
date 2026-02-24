// main.js
// Initialize the A-Frame 360 video viewer

if (window.AFRAME && !AFRAME.components['pitch-clamp']) {
  AFRAME.registerComponent('pitch-clamp', {
    schema: {
      min: { type: 'number', default: -20 },
      max: { type: 'number', default: 20 }
    },
    init: function () {
      this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      this._desktopBasePitchDeg = null;
      this._basePitchDeg = null;
      this._lastRawPitchDeg = null;
      this._accumulatedDeltaDeg = 0;
    },
    tick: function () {
      if (this._isMobile) return;
      var obj = this.el.object3D;
      if (!obj) return;

      var pitchDeg = THREE.MathUtils.radToDeg(obj.rotation.x);
      if (this._desktopBasePitchDeg === null) {
        this._desktopBasePitchDeg = pitchDeg;
      }

      var minPitch = this._desktopBasePitchDeg + this.data.min;
      var maxPitch = this._desktopBasePitchDeg + this.data.max;
      var clampedPitch = Math.min(maxPitch, Math.max(minPitch, pitchDeg));
      if (clampedPitch !== pitchDeg) {
        obj.rotation.x = THREE.MathUtils.degToRad(clampedPitch);
      }
    },
    tock: function () {
      if (!this._isMobile) return;
      var lookControls = this.el.components && this.el.components['look-controls'];
      if (!lookControls || !lookControls.pitchObject) return;

      var rawPitchDeg = THREE.MathUtils.radToDeg(lookControls.pitchObject.rotation.x);

      if (this._basePitchDeg === null) {
        this._basePitchDeg = rawPitchDeg;
        this._lastRawPitchDeg = rawPitchDeg;
        this._accumulatedDeltaDeg = 0;
        lookControls.pitchObject.rotation.x = THREE.MathUtils.degToRad(this._basePitchDeg);
        return;
      }

      var stepDeg = rawPitchDeg - this._lastRawPitchDeg;
      if (stepDeg > 180) stepDeg -= 360;
      if (stepDeg < -180) stepDeg += 360;
      this._lastRawPitchDeg = rawPitchDeg;

      var nextAccumulated = this._accumulatedDeltaDeg + stepDeg;
      this._accumulatedDeltaDeg = Math.min(this.data.max, Math.max(this.data.min, nextAccumulated));

      lookControls.pitchObject.rotation.x = THREE.MathUtils.degToRad(this._basePitchDeg + this._accumulatedDeltaDeg);
    }
  });
}

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
    // Defer assigning src until user interaction to avoid mobile browsers auto-starting.
    videoEl.loop = true;
    videoEl.autoplay = false;
    videoEl.preload = 'metadata';
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');

    // Force a paused initial state (mobile browsers may attempt to autoplay on src assignment).
    try {
      videoEl.pause();
    } catch (e) {
      // ignore
    }
    try {
      videoEl.currentTime = 0;
    } catch (e) {
      // ignore
    }
    try {
      videoEl.load();
    } catch (e) {
      // ignore
    }
  }

  var posterEl = document.getElementById('video-poster');
  var posterImgEl = document.getElementById('videoPosterTexture');
  var sphereElForPoster = document.getElementById('video-sphere');
  var hasStartedPlayback = false;

  var posterFallbackByVideo = {
    'studio.mp4': '',
    'paddock.mp4': ''
  };

  if (posterEl) {
    posterEl.style.display = 'block';
    var fallbackPoster = posterFallbackByVideo[selectedVid];
    if (fallbackPoster) {
      posterEl.style.backgroundImage = 'url(' + fallbackPoster + ')';
    }
  }

  if (sphereElForPoster && posterImgEl) {
    sphereElForPoster.setAttribute('src', '#videoPosterTexture');
    var fallbackPosterForImg = posterFallbackByVideo[selectedVid];
    if (fallbackPosterForImg) {
      posterImgEl.src = fallbackPosterForImg;
      if (posterEl) {
        // Keep CSS poster visible until the A-Frame poster texture has actually loaded.
        var hideOverlayIfReady = function () {
          if (posterImgEl.complete && posterImgEl.naturalWidth > 0) {
            posterEl.style.display = 'none';
          }
        };

        posterImgEl.addEventListener('load', hideOverlayIfReady);
        hideOverlayIfReady();
      }
    }
  }

  var renderPosterFrame = function (src) {
    if ((!posterEl && !posterImgEl) || !src) return;
    if (posterEl && posterEl.dataset && posterEl.dataset.ready === '1') return;

    var tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.setAttribute('crossorigin', 'anonymous');
    tempVideo.muted = true;
    tempVideo.volume = 0;
    tempVideo.playsInline = true;
    tempVideo.setAttribute('playsinline', '');
    tempVideo.preload = 'metadata';
    tempVideo.src = src;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    var cleanup = function () {
      tempVideo.removeAttribute('src');
      try {
        tempVideo.load();
      } catch (e) {
        // ignore
      }
    };

    tempVideo.addEventListener('loadedmetadata', function () {
      var w = tempVideo.videoWidth || 0;
      var h = tempVideo.videoHeight || 0;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      try {
        tempVideo.currentTime = Math.min(0.1, Math.max(0, (tempVideo.duration || 0) * 0.01));
      } catch (e) {
        // ignore
      }
    });

    tempVideo.addEventListener('loadeddata', function () {
      if (!canvas.width || !canvas.height) return;
      try {
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (posterImgEl) posterImgEl.src = dataUrl;
      } catch (e) {
        // ignore
      }
    });

    tempVideo.addEventListener('seeked', function () {
      if (!ctx || !canvas.width || !canvas.height) return;
      try {
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (posterImgEl) {
          posterImgEl.src = dataUrl;
        }
        if (posterEl) {
          posterEl.style.backgroundImage = 'url(' + dataUrl + ')';
          if (posterEl.dataset) posterEl.dataset.ready = '1';
        }
      } catch (e) {
        // ignore
      } finally {
        cleanup();
      }
    });
  };

  renderPosterFrame(selectedVid);

  var sourceSet = false;
  var ensureVideoSourceSet = function () {
    if (!videoEl || sourceSet) return;
    sourceSet = true;
    videoEl.src = selectedVid;
    try {
      videoEl.load();
    } catch (e) {
      // ignore
    }

    var sphereEl = document.getElementById('video-sphere');
    if (sphereEl) {
      sphereEl.setAttribute('src', '#videoTexture');
    }
  };

  var userInitiatedPlay = false;

  var playBtn = document.getElementById('play-video');
  var toggleBtn = document.getElementById('toggle-play');
  var stopBtn = document.getElementById('stop-video');
  var setPlayUi = function () {
    if (!playBtn) return;
    playBtn.style.display = (videoEl && !videoEl.paused) ? 'none' : 'block';

    if (posterEl) {
      posterEl.style.display = (!hasStartedPlayback && videoEl && videoEl.paused) ? 'block' : 'none';
    }

    if (toggleBtn) {
      toggleBtn.textContent = (videoEl && !videoEl.paused) ? 'Pause' : 'Play';
    }
  };

  if (playBtn && videoEl) {
    playBtn.addEventListener('click', function () {
      userInitiatedPlay = true;
      ensureVideoSourceSet();
      videoEl.play().then(function () {
        hasStartedPlayback = true;
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
        userInitiatedPlay = true;
        ensureVideoSourceSet();
        videoEl.play().then(function () {
          hasStartedPlayback = true;
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

  // Guard against mobile autoplay (some browsers may start playback automatically).
  if (videoEl && isMobile) {
    var forcePausedState = function () {
      try {
        videoEl.pause();
      } catch (e) {
        // ignore
      }
      try {
        videoEl.currentTime = 0;
      } catch (e) {
        // ignore
      }
      setPlayUi();
    };

    // Some browsers fire 'play' before 'playing'. Guard both.
    videoEl.addEventListener('play', function () {
      if (!userInitiatedPlay) forcePausedState();
    });

    videoEl.addEventListener('playing', function () {
      if (!userInitiatedPlay) forcePausedState();
    });

    // If the browser starts loading/decoding and tries to begin, re-assert paused state.
    videoEl.addEventListener('loadeddata', function () {
      if (!userInitiatedPlay && !videoEl.paused) forcePausedState();
    });
  }

  var cameraEl = document.getElementById('video-camera');
  if (cameraEl) {
    cameraEl.setAttribute('fov', desiredFov);

    // Disable gyro on mobile by default. It can be enabled explicitly via button.
    if (isMobile) {
      var gyroEnabled = false;
      try {
        gyroEnabled = window.sessionStorage && window.sessionStorage.getItem('gyroEnabled') === '1';
      } catch (e) {
        // ignore
      }
      cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', gyroEnabled);
    }
  }

  var sceneEl = document.querySelector('a-scene');
  if (sceneEl && videoEl) {
    sceneEl.addEventListener('loaded', function () {
      setPlayUi();
    });
  }

  // Enable Motion Controls button (Android + iOS)
  var enableMotionBtn = document.getElementById('enable-motion-btn');
  if (enableMotionBtn && isMobile) {
    enableMotionBtn.style.display = 'block';

    // If gyro was enabled previously, keep it enabled and hide the button.
    try {
      if (window.sessionStorage && window.sessionStorage.getItem('gyroEnabled') === '1') {
        enableMotionBtn.style.display = 'none';
      }
    } catch (e) {
      // ignore
    }

    enableMotionBtn.addEventListener('click', function () {
      var enableGyro = function () {
        if (cameraEl) {
          cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
        }
        try {
          if (window.sessionStorage) window.sessionStorage.setItem('gyroEnabled', '1');
        } catch (e) {
          // ignore
        }
        enableMotionBtn.style.display = 'none';
      };

      // iOS permission flow
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (permissionState) {
          if (permissionState === 'granted') {
            enableGyro();
          }
        }).catch(function () {
          // ignore
        });
        return;
      }

      // Android / other browsers
      enableGyro();
    });
  } else if (enableMotionBtn) {
    enableMotionBtn.style.display = 'none';
  }
});