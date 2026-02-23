// video-flat.js

if (window.AFRAME && !AFRAME.components['yaw-clamp']) {
  AFRAME.registerComponent('yaw-clamp', {
    schema: {
      min: { type: 'number', default: -90 },
      max: { type: 'number', default: 90 }
    },
    init: function () {
      this._initialYawDeg = null;
      this._lastYawDeg = null;
      this._accumulatedDeltaDeg = 0;
    },
    tick: function () {
      var obj = this.el.object3D;
      if (!obj) return;

      var yawRad = obj.rotation.y;
      var yawDeg = THREE.MathUtils.radToDeg(yawRad);

      if (this._initialYawDeg === null) {
        this._initialYawDeg = yawDeg;
        this._lastYawDeg = yawDeg;
        this._accumulatedDeltaDeg = 0;
        return;
      }

      var stepDeg = yawDeg - this._lastYawDeg;
      if (stepDeg > 180) stepDeg -= 360;
      if (stepDeg < -180) stepDeg += 360;

      this._accumulatedDeltaDeg += stepDeg;
      this._lastYawDeg = yawDeg;

      var clampedDelta = Math.min(this.data.max, Math.max(this.data.min, this._accumulatedDeltaDeg));
      if (clampedDelta !== this._accumulatedDeltaDeg) {
        this._accumulatedDeltaDeg = clampedDelta;
        obj.rotation.y = THREE.MathUtils.degToRad(this._initialYawDeg + clampedDelta);
        this._lastYawDeg = THREE.MathUtils.radToDeg(obj.rotation.y);
      }
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
    videoEl.src = selectedVid;
    videoEl.loop = true;
  }

  var cameraEl = document.getElementById('flat-video-camera');
  if (cameraEl) {
    cameraEl.setAttribute('fov', desiredFov);
  }

  var playBtn = document.getElementById('play-flat-video');
  var toggleBtn = document.getElementById('toggle-flat-play');
  var stopBtn = document.getElementById('stop-flat-video');

  var setPlayUi = function () {
    if (playBtn) {
      playBtn.style.display = (videoEl && !videoEl.paused) ? 'none' : 'block';
    }
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

    enableMotionBtn.addEventListener('click', function () {
      // iOS permission flow
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (permissionState) {
          if (permissionState === 'granted') {
            enableMotionBtn.style.display = 'none';
            window.location.reload();
          }
        }).catch(function () {
          // ignore
        });
        return;
      }

      // Android / other browsers: no permission API, but events may still be blocked on insecure origins.
      enableAframeMotion();

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
