// video-flat.js

if (window.AFRAME && !AFRAME.components['yaw-clamp']) {
  AFRAME.registerComponent('yaw-clamp', {
    schema: {
      min: { type: 'number', default: -90 },
      max: { type: 'number', default: 90 },
      bias: { type: 'number', default: 0 },
      gyroScale: { type: 'number', default: 0.6 }
    },
    init: function () {
      this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      this._baseYawDeg = null;
      this._rawBaseYawDeg = null;
      this._lastRawYawDeg = null;
      this._accumulatedDeltaDeg = 0;

      this._desktopBaseYawDeg = null;

      this._onCanvasTouch = null;
    },
    play: function () {
      if (!this._isMobile) return;
      var self = this;

      var attach = function () {
        var sceneEl = self.el && self.el.sceneEl;
        var canvas = sceneEl && sceneEl.canvas;
        if (!canvas) return false;

        if (self._onCanvasTouch) return true;

        self._onCanvasTouch = function () {
          var lookControls = self.el.components && self.el.components['look-controls'];
          if (!lookControls || !lookControls.yawObject) return;
          var rawYawDeg = THREE.MathUtils.radToDeg(lookControls.yawObject.rotation.y);

          // Re-anchor the clamp base to the current yaw.
          // This prevents a "snap back" when look-controls applies touch smoothing/inertia.
          self._rawBaseYawDeg = rawYawDeg;
          self._baseYawDeg = rawYawDeg + self.data.bias;
          self._accumulatedDeltaDeg = 0;
        };

        canvas.addEventListener('touchstart', self._onCanvasTouch, { passive: true });
        canvas.addEventListener('touchend', self._onCanvasTouch, { passive: true });
        canvas.addEventListener('touchcancel', self._onCanvasTouch, { passive: true });
        return true;
      };

      // Canvas may not exist yet on first play; attach when available.
      if (!attach()) {
        var sceneEl = this.el && this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('render-target-loaded', function () {
            attach();
          });
        }
      }
    },
    remove: function () {
      if (!this._onCanvasTouch) return;
      var sceneEl = this.el && this.el.sceneEl;
      var canvas = sceneEl && sceneEl.canvas;
      if (!canvas) return;
      canvas.removeEventListener('touchstart', this._onCanvasTouch);
      canvas.removeEventListener('touchend', this._onCanvasTouch);
      canvas.removeEventListener('touchcancel', this._onCanvasTouch);
      this._onCanvasTouch = null;
    },
    tick: function () {
      // Desktop: clamp the camera rotation directly to avoid fighting look-controls yawObject.
      // Mobile: do not clamp here; let look-controls apply input first, then clamp in tock.
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
        this._rawBaseYawDeg = rawYawDeg;
        this._baseYawDeg = rawYawDeg + this.data.bias;
        this._lastRawYawDeg = rawYawDeg;
        this._accumulatedDeltaDeg = 0;
        lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(this._baseYawDeg);
        return;
      }

      // Clamp absolute yaw offset from the base yaw each frame.
      // This avoids "spring back" effects caused by integrating step deltas while look-controls applies
      // its own smoothing/inertia.
      var deltaDeg = rawYawDeg - this._rawBaseYawDeg;
      if (deltaDeg > 180) deltaDeg -= 360;
      if (deltaDeg < -180) deltaDeg += 360;

      // Reduce gyro sensitivity on mobile by scaling the delta.
      // (Clamp range stays the same; user just needs more device motion to reach it.)
      var gyroScale = Number(this.data.gyroScale);
      if (Number.isFinite(gyroScale)) {
        gyroScale = Math.max(0.05, Math.min(1, gyroScale));
        deltaDeg = deltaDeg * gyroScale;
      }

      this._accumulatedDeltaDeg = Math.min(this.data.max, Math.max(this.data.min, deltaDeg));
      lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(this._baseYawDeg + this._accumulatedDeltaDeg);

      this._lastRawYawDeg = rawYawDeg;
    }
  });
}

if (window.AFRAME && !AFRAME.components['pitch-clamp']) {
  AFRAME.registerComponent('pitch-clamp', {
    schema: {
      min: { type: 'number', default: -30 },
      max: { type: 'number', default: 30 },
      gyroScale: { type: 'number', default: 0.35 }
    },
    init: function () {
      this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      this._desktopBasePitchDeg = null;
      this._basePitchDeg = null;
      this._rawBasePitchDeg = null;
      this._lastRawPitchDeg = null;
      this._accumulatedDeltaDeg = 0;

      this._onCanvasTouch = null;
      this._isTouching = false;
    },
    play: function () {
      if (!this._isMobile) return;
      var self = this;

      var attach = function () {
        var sceneEl = self.el && self.el.sceneEl;
        var canvas = sceneEl && sceneEl.canvas;
        if (!canvas) return false;

        if (self._onCanvasTouch) return true;

        self._onCanvasTouch = function (evt) {
          if (evt && evt.type === 'touchstart') self._isTouching = true;
          if (evt && (evt.type === 'touchend' || evt.type === 'touchcancel')) self._isTouching = false;

          var lookControls = self.el.components && self.el.components['look-controls'];
          if (!lookControls) return;
          var obj = self.el && self.el.object3D;
          if (!obj) return;
          var euler = new THREE.Euler();
          euler.setFromQuaternion(obj.quaternion, 'YXZ');
          var rawPitchDeg = THREE.MathUtils.radToDeg(euler.x);

          // Re-anchor the clamp base to the current pitch to avoid post-drag smoothing/inertia.
          self._rawBasePitchDeg = rawPitchDeg;
          self._basePitchDeg = rawPitchDeg;
          self._accumulatedDeltaDeg = 0;
        };

        canvas.addEventListener('touchstart', self._onCanvasTouch, { passive: true });
        canvas.addEventListener('touchend', self._onCanvasTouch, { passive: true });
        canvas.addEventListener('touchcancel', self._onCanvasTouch, { passive: true });
        return true;
      };

      if (!attach()) {
        var sceneEl = this.el && this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('render-target-loaded', function () {
            attach();
          });
        }
      }
    },
    remove: function () {
      if (!this._onCanvasTouch) return;
      var sceneEl = this.el && this.el.sceneEl;
      var canvas = sceneEl && sceneEl.canvas;
      if (!canvas) return;
      canvas.removeEventListener('touchstart', this._onCanvasTouch);
      canvas.removeEventListener('touchend', this._onCanvasTouch);
      canvas.removeEventListener('touchcancel', this._onCanvasTouch);
      this._onCanvasTouch = null;
    },
    tick: function () {
      var obj = this.el.object3D;
      if (!obj) return;

      var pitchDeg = THREE.MathUtils.radToDeg(obj.rotation.x);
      var clampedPitch = Math.min(this.data.max, Math.max(this.data.min, pitchDeg));
      obj.rotation.x = THREE.MathUtils.degToRad(clampedPitch);
      obj.rotation.z = 0;
    },
    tock: function () {
      // No-op: pitch is clamped directly in tick() to match the 360 player behavior.
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var allowedVideos = {
    'videos/paddock_square.mp4': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedVid = params.get('vid');
  var selectedVid = (requestedVid && allowedVideos[requestedVid]) ? requestedVid : 'videos/paddock_square.mp4';

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

  var sphereEl = document.getElementById('flat-video-sphere');

  // Set src immediately so we can render a reliable first-frame "freeze" preview.
  // Mobile autoplay is still blocked by our userInitiatedPlay guards below.
  var sourceSet = false;
  if (videoEl) {
    sourceSet = true;
    videoEl.src = selectedVid;
    try {
      videoEl.load();
    } catch (e) {
      // ignore
    }
  }

  if (sphereEl) {
    sphereEl.setAttribute('src', '#flatVideoTexture');
    sphereEl.setAttribute('material', 'opacity', 0);
  }

  // Freeze frame render (show first frame without letting playback run).
  if (videoEl && sphereEl) {
    videoEl.addEventListener('loadeddata', function () {
      try {
        videoEl.currentTime = 0.01;
        videoEl.pause();
      } catch (e) {
        // ignore
      }

      try {
        sphereEl.setAttribute('material', 'opacity', 1);
      } catch (e) {
        // ignore
      }

      if (posterEl) {
        posterEl.style.display = 'none';
      }
    });
  }

  var ensureVideoSourceSet = function () {
    if (!videoEl || sourceSet) return;
    sourceSet = true;
    videoEl.src = selectedVid;
    try {
      videoEl.load();
    } catch (e) {
      // ignore
    }

    if (sphereEl) {
      sphereEl.setAttribute('src', '#flatVideoTexture');
    }
  };

  var posterEl = document.getElementById('flat-video-poster');
  var posterImgEl = document.getElementById('flatVideoPosterTexture');
  var sphereElForPoster = document.getElementById('flat-video-sphere');
  var hasStartedPlayback = false;

  var posterFallbackByVideo = {
    'videos/paddock_square.mp4': ''
  };

  if (posterEl) {
    posterEl.style.display = 'block';
    var fallbackPoster = posterFallbackByVideo[selectedVid];
    if (fallbackPoster) {
      posterEl.style.backgroundImage = 'url(' + fallbackPoster + ')';
    }
  }

  if (sphereElForPoster && posterImgEl) {
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

  // Freeze-frame preview uses the video texture directly, so we don't need to capture a frame
  // and we must not override the videosphere src with the poster texture.
  // renderPosterFrame(selectedVid);

  var userInitiatedPlay = false;

  var pseudoSpatialAudio = {
    ctx: null,
    source: null,
    panner: null,
    rafId: 0,
    enabled: false
  };

  var getYawRad = function () {
    var cam = document.getElementById('flat-video-camera');
    if (!cam) return 0;
    var lc = cam.components && cam.components['look-controls'];
    if (lc && lc.yawObject) return lc.yawObject.rotation.y || 0;
    if (cam.object3D) return cam.object3D.rotation.y || 0;
    return 0;
  };

  var stopPseudoSpatialAudio = function () {
    if (pseudoSpatialAudio.rafId) {
      try {
        cancelAnimationFrame(pseudoSpatialAudio.rafId);
      } catch (e) {
        // ignore
      }
      pseudoSpatialAudio.rafId = 0;
    }
  };

  var startPseudoSpatialAudio = function () {
    if (!pseudoSpatialAudio.enabled || !pseudoSpatialAudio.panner) return;
    if (pseudoSpatialAudio.rafId) return;

    var tick = function () {
      pseudoSpatialAudio.rafId = 0;

      if (!videoEl || videoEl.paused) {
        stopPseudoSpatialAudio();
        return;
      }

      var yawRad = getYawRad();
      var yawNorm = yawRad;
      while (yawNorm > Math.PI) yawNorm -= Math.PI * 2;
      while (yawNorm < -Math.PI) yawNorm += Math.PI * 2;
      var pan = Math.max(-1, Math.min(1, yawNorm / (Math.PI / 2)));
      pan = Math.max(-0.65, Math.min(0.65, pan));
      try {
        pseudoSpatialAudio.panner.pan.setTargetAtTime(pan, pseudoSpatialAudio.ctx.currentTime, 0.05);
      } catch (e) {
        // ignore
      }

      pseudoSpatialAudio.rafId = requestAnimationFrame(tick);
    };

    pseudoSpatialAudio.rafId = requestAnimationFrame(tick);
  };

  var ensurePseudoSpatialAudio = function () {
    if (!videoEl) return;
    if (pseudoSpatialAudio.enabled) {
      if (pseudoSpatialAudio.ctx && pseudoSpatialAudio.ctx.state === 'suspended') {
        try {
          pseudoSpatialAudio.ctx.resume();
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      pseudoSpatialAudio.ctx = new AudioContextCtor();
      pseudoSpatialAudio.source = pseudoSpatialAudio.ctx.createMediaElementSource(videoEl);
      pseudoSpatialAudio.panner = pseudoSpatialAudio.ctx.createStereoPanner();
      pseudoSpatialAudio.source.connect(pseudoSpatialAudio.panner);
      pseudoSpatialAudio.panner.connect(pseudoSpatialAudio.ctx.destination);
      pseudoSpatialAudio.enabled = true;
    } catch (e) {
      pseudoSpatialAudio.ctx = null;
      pseudoSpatialAudio.source = null;
      pseudoSpatialAudio.panner = null;
      pseudoSpatialAudio.enabled = false;
    }
  };

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
      ensurePseudoSpatialAudio();
      videoEl.play().then(function () {
        hasStartedPlayback = true;
        startPseudoSpatialAudio();
        setPlayUi();
      }).catch(function () {
        setPlayUi();
      });
    });

    videoEl.addEventListener('play', function () {
      setPlayUi();
      startPseudoSpatialAudio();
    });
    videoEl.addEventListener('pause', function () {
      stopPseudoSpatialAudio();
      setPlayUi();
    });
    videoEl.addEventListener('ended', function () {
      stopPseudoSpatialAudio();
      setPlayUi();
    });
  }

  if (toggleBtn && videoEl) {
    toggleBtn.addEventListener('click', function () {
      if (videoEl.paused) {
        userInitiatedPlay = true;
        ensureVideoSourceSet();
        ensurePseudoSpatialAudio();
        videoEl.play().then(function () {
          hasStartedPlayback = true;
          startPseudoSpatialAudio();
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
      stopPseudoSpatialAudio();
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
