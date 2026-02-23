// main.js
// Initialize the Video.js player with VR plugin

console.log('main.js loaded');

window.addEventListener('error', function (event) {
  console.log('Window error:', event && (event.error || event.message || event));
});

document.addEventListener('DOMContentLoaded', function () {
  console.log('DOMContentLoaded');

  if (typeof videojs === 'undefined') {
    console.log('videojs is undefined - video.min.js likely did not load');
    return;
  }

  var allowedVideos = {
    'studio.mp4': true,
    'paddock.mp4': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedVid = params.get('vid');
  var selectedVid = (requestedVid && allowedVideos[requestedVid]) ? requestedVid : 'studio.mp4';

  var player = videojs('my-360video');

  try {
    player.src({ src: selectedVid, type: 'video/mp4' });
  } catch (e) {
    // Ignore if player isn't ready yet; Video.js will still pick up the default source.
  }

  player.ready(function () {
    console.log('Video.js ready');

    try {
      console.log('videojs-vr instance:', player.vr && player.vr());
    } catch (e) {
      console.log('videojs-vr instance: error reading player.vr()', e);
    }

    var fovParam = params.get('fov');
    var desiredFov = fovParam ? Number(fovParam) : 75;
    if (!Number.isFinite(desiredFov)) desiredFov = 75;
    desiredFov = Math.max(30, Math.min(120, desiredFov));

    try {
      var vrInstance = player.vr && player.vr();
      var camera = vrInstance && (vrInstance.camera || vrInstance.camera_ || vrInstance.vrCamera || vrInstance.vrCamera_);

      var findCamera = function (root) {
        if (!root || typeof root !== 'object') return null;
        var seen = new Set();
        var queue = [root];
        while (queue.length) {
          var current = queue.shift();
          if (!current || typeof current !== 'object') continue;
          if (seen.has(current)) continue;
          seen.add(current);

          try {
            if (typeof current.fov === 'number' && typeof current.updateProjectionMatrix === 'function') {
              return current;
            }
          } catch (e) {
            // ignore
          }

          var keys;
          try {
            keys = Object.keys(current);
          } catch (e) {
            keys = [];
          }

          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k === 'player') continue;
            var v;
            try {
              v = current[k];
            } catch (e) {
              continue;
            }
            if (v && typeof v === 'object') queue.push(v);
          }
        }
        return null;
      };

      if (vrInstance && typeof vrInstance.setFov === 'function') {
        vrInstance.setFov(desiredFov);
        console.log('Applied FOV via vrInstance.setFov:', desiredFov);
      } else {
        if (!camera) camera = findCamera(vrInstance);
        if (camera && typeof camera === 'object') {
          camera.fov = desiredFov;
          if (typeof camera.updateProjectionMatrix === 'function') {
            camera.updateProjectionMatrix();
          }
          console.log('Applied FOV via discovered camera.fov:', desiredFov);
        } else {
          console.log('FOV control not available on this videojs-vr build');
        }
      }
    } catch (e) {
      console.log('Error while trying to apply FOV:', e);
    }
  });

  player.on('error', function () {
    console.error('Video.js error:', player.error());
  });

  player.vr({
    projection: '360',
    debug: false,
    forceCardboard: false,
    motionControls: true // Enable device orientation controls on mobile
  });

  // Show Enable Motion Controls button on mobile if needed
  var enableMotionBtn = document.getElementById('enable-motion-btn');
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    enableMotionBtn.style.display = 'block';
    enableMotionBtn.addEventListener('click', function() {
      DeviceOrientationEvent.requestPermission().then(function(permissionState) {
        if (permissionState === 'granted') {
          // Reload plugin to ensure motion controls are active
          player.vr({
            projection: '360',
            debug: false,
            forceCardboard: false,
            motionControls: true
          });
          enableMotionBtn.style.display = 'none';
        }
      }).catch(console.error);
    });
  } else {
    // On desktop or Android (where permission is not required), hide button
    enableMotionBtn.style.display = 'none';
  }

  // Debug: Log device orientation events
  var orientationDebug = document.getElementById('orientation-debug');
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', function(event) {
      // Log to console
      console.log('DeviceOrientationEvent:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });
      // Show on screen
      if (orientationDebug) {
        orientationDebug.style.display = 'block';
        orientationDebug.innerHTML =
          '<b>Orientation</b><br>' +
          'α (alpha): ' + (event.alpha !== null ? event.alpha.toFixed(1) : 'n/a') + '<br>' +
          'β (beta): ' + (event.beta !== null ? event.beta.toFixed(1) : 'n/a') + '<br>' +
          'γ (gamma): ' + (event.gamma !== null ? event.gamma.toFixed(1) : 'n/a');
      }
    });
  } else {
    if (orientationDebug) {
      orientationDebug.style.display = 'block';
      orientationDebug.innerHTML = 'DeviceOrientationEvent not supported';
    }
    console.log('DeviceOrientationEvent not supported');
  }
});