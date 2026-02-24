// video-flat.js

if (window.AFRAME && !AFRAME.components['yaw-clamp']) {
  AFRAME.registerComponent('yaw-clamp', {
    schema: {
      min: { type: 'number', default: -90 },
      max: { type: 'number', default: 90 },
      bias: { type: 'number', default: 0 }
    },
    init: function () {
      this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      this._baseYawDeg = null;
      this._lastRawYawDeg = null;
      this._accumulatedDeltaDeg = 0;

      this._desktopBaseYawDeg = null;
    },
    tick: function () {
      // Desktop: clamp the camera rotation directly to avoid fighting look-controls yawObject.
      if (this._isMobile) return;
      var obj = this.el.object3D;
      if (!obj) return;

      var yawDeg = THREE.MathUtils.radToDeg(obj.rotation.y);
      if (this._desktopBaseYawDeg === null) {
        this._desktopBaseYawDeg = yawDeg + this.data.bias;
      }

      var minYaw = this._desktopBaseYawDeg + this.data.min;
      var maxYaw = this._desktopBaseYawDeg + this.data.max;
      var clampedYaw = Math.min(maxYaw, Math.max(minYaw, yawDeg));
      if (clampedYaw !== yawDeg) {
        obj.rotation.y = THREE.MathUtils.degToRad(clampedYaw);
      }
    },
    tock: function () {
      // Mobile: clamp the raw gyro/mouse yaw source.
      if (!this._isMobile) return;
      var lookControls = this.el.components && this.el.components['look-controls'];
      if (!lookControls || !lookControls.yawObject) return;

      // Read RAW yaw from look-controls. This reflects gyro/mouse input before we clamp.
      var rawYawDeg = THREE.MathUtils.radToDeg(lookControls.yawObject.rotation.y);

      if (this._baseYawDeg === null) {
        // Establish the base yaw (center) once, applying bias immediately.
        this._baseYawDeg = rawYawDeg + this.data.bias;
        this._lastRawYawDeg = rawYawDeg;
        this._accumulatedDeltaDeg = 0;
        lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(this._baseYawDeg);
        return;
      }

      var stepDeg = rawYawDeg - this._lastRawYawDeg;
      if (stepDeg > 180) stepDeg -= 360;
      if (stepDeg < -180) stepDeg += 360;
      this._lastRawYawDeg = rawYawDeg;

      // Accumulate and clamp. Discard overshoot immediately to avoid edge jitter/stickiness.
      var nextAccumulated = this._accumulatedDeltaDeg + stepDeg;
      this._accumulatedDeltaDeg = Math.min(this.data.max, Math.max(this.data.min, nextAccumulated));

      // Always apply the clamped yaw every frame (prevents snapping/jumping when hitting edges).
      lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(this._baseYawDeg + this._accumulatedDeltaDeg);
    }
  });
}

if (window.AFRAME && !AFRAME.components['pitch-clamp']) {
  AFRAME.registerComponent('pitch-clamp', {
    schema: {
      min: { type: 'number', default: -30 },
      max: { type: 'number', default: 30 }
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
    'paddock_square.mp4': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedVid = params.get('vid');
  var selectedVid = (requestedVid && allowedVideos[requestedVid]) ? requestedVid : 'paddock_square.mp4';

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  var fovParam = params.get('fov');
  var desiredFov = fovParam ? Number(fovParam) : (isMobile ? 110 : 35);
  if (!Number.isFinite(desiredFov)) desiredFov = (isMobile ? 110 : 35);
  desiredFov = Math.max(30, Math.min(120, desiredFov));

  var videoEl = document.getElementById('flatVideoTexture');
  if (videoEl) {
    videoEl.loop = true;
    videoEl.autoplay = false;
    videoEl.preload = 'metadata';
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');

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

    var sphereEl = document.getElementById('flat-video-sphere');
    if (sphereEl) {
      sphereEl.setAttribute('src', '#flatVideoTexture');
    }
  };

  var posterEl = document.getElementById('flat-video-poster');
  var posterImgEl = document.getElementById('flatVideoPosterTexture');
  var sphereElForPoster = document.getElementById('flat-video-sphere');
  var hasStartedPlayback = false;

  var posterFallbackByVideo = {
    'paddock_square.mp4': ''
  };

  if (posterEl) {
    posterEl.style.display = 'block';
    var fallbackPoster = posterFallbackByVideo[selectedVid];
    if (fallbackPoster) {
      posterEl.style.backgroundImage = 'url(' + fallbackPoster + ')';
    }
  }

  if (sphereElForPoster && posterImgEl) {
    sphereElForPoster.setAttribute('src', '#flatVideoPosterTexture');
    // Keep CSS poster visible (neutral black) until the A-Frame poster texture has actually loaded.
    if (posterEl) {
      var hideOverlayIfReady = function () {
        if (posterImgEl.complete && posterImgEl.naturalWidth > 0) {
          posterEl.style.display = 'none';
        }
      };

      posterImgEl.addEventListener('load', hideOverlayIfReady);
      hideOverlayIfReady();
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

  var userInitiatedPlay = false;

  var cameraEl = document.getElementById('flat-video-camera');
  if (cameraEl) {
    cameraEl.setAttribute('fov', desiredFov);
    if (isMobile) {
      var gyroEnabled = false;
      try {
        gyroEnabled = window.sessionStorage && window.sessionStorage.getItem('flatGyroEnabled') === '1';
      } catch (e) {
        // ignore
      }
      cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', gyroEnabled);
    } else {
      cameraEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', false);

      var disableMagicWindow = function () {
        var lc = cameraEl.components && cameraEl.components['look-controls'];
        if (!lc) return;

        if (lc.data) {
          lc.data.magicWindowTrackingEnabled = false;
        }

        if (lc.magicWindowControls) {
          lc.magicWindowControls.enabled = false;
        }
      };

      if (cameraEl.components && cameraEl.components['look-controls']) {
        disableMagicWindow();
      } else {
        cameraEl.addEventListener('componentinitialized', function (evt) {
          if (evt && evt.detail && evt.detail.name === 'look-controls') {
            disableMagicWindow();
          }
        });
      }
    }
  }

  var playBtn = document.getElementById('play-flat-video');
  var toggleBtn = document.getElementById('toggle-flat-play');
  var stopBtn = document.getElementById('stop-flat-video');

  var setPlayUi = function () {
    if (playBtn) {
      playBtn.style.display = (videoEl && !videoEl.paused) ? 'none' : 'block';
    }
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

    videoEl.addEventListener('play', function () {
      setPlayUi();
    });
    videoEl.addEventListener('pause', function () {
      setPlayUi();
    });
    videoEl.addEventListener('ended', function () {
      setPlayUi();
    });
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

    videoEl.addEventListener('play', function () {
      if (!userInitiatedPlay) forcePausedState();
    });

    videoEl.addEventListener('playing', function () {
      if (!userInitiatedPlay) forcePausedState();
    });

    videoEl.addEventListener('loadeddata', function () {
      if (!userInitiatedPlay && !videoEl.paused) forcePausedState();
    });
  }

  // Show Enable Motion Controls button on iOS if needed
  var enableMotionBtn = document.getElementById('enable-motion-btn');
  var cameraElForMotion = document.getElementById('flat-video-camera');
  var lookControls = cameraElForMotion && cameraElForMotion.components && cameraElForMotion.components['look-controls'];

  var enableAframeMotion = function () {
    if (!cameraElForMotion) return;
    cameraElForMotion.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);

    var lc = cameraElForMotion.components && cameraElForMotion.components['look-controls'];
    if (lc) {
      lc.data.magicWindowTrackingEnabled = true;
    }
  };

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

  if (enableMotionBtn && isMobile) {
    enableMotionBtn.style.display = 'block';

    try {
      if (window.sessionStorage && window.sessionStorage.getItem('flatGyroEnabled') === '1') {
        enableMotionBtn.style.display = 'none';
      }
    } catch (e) {
      // ignore
    }

    enableMotionBtn.addEventListener('click', function () {
      var persistGyroEnabled = function () {
        try {
          if (window.sessionStorage) window.sessionStorage.setItem('flatGyroEnabled', '1');
        } catch (e) {
          // ignore
        }
      };

      // iOS permission flow
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (permissionState) {
          if (permissionState === 'granted') {
            enableAframeMotion();
            persistGyroEnabled();
            enableMotionBtn.style.display = 'none';
          }
        }).catch(function () {
          // ignore
        });
        return;
      }

      // Android / other browsers: no permission API, but events may still be blocked on insecure origins.
      enableAframeMotion();
      persistGyroEnabled();

      verifyOrientationEvents().then(function (gotEvent) {
        if (!gotEvent) {
          window.alert('Gyro/motion seems blocked in this browser/context. On many Android browsers (including Samsung Internet) you may need to open the site over HTTPS (not http://LAN-IP) for device motion to work.');
        } else {
          enableMotionBtn.style.display = 'none';
        }
      });
    });
  } else if (enableMotionBtn) {
    enableMotionBtn.style.display = 'none';
  }

  setPlayUi();
});
