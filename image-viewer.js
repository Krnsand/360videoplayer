// image-viewer.js
// Handle motion controls for 360 image viewer

document.addEventListener('DOMContentLoaded', function () {
  var allowedImages = {
    'forest.jpg': true,
    'studio.jpg': true
  };

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  var params = new URLSearchParams(window.location.search);
  var fovParam = params.get('fov');
  var desiredFov = fovParam ? Number(fovParam) : (isMobile ? 95 : null);
  if (!Number.isFinite(desiredFov)) desiredFov = (isMobile ? 95 : null);

  var requestedImg = params.get('img');
  var selectedImg = (requestedImg && allowedImages[requestedImg]) ? requestedImg : 'forest.jpg';

  var sky = document.querySelector('a-sky');
  if (sky) {
    sky.setAttribute('src', selectedImg);
  }

  if (desiredFov) {
    var camera = document.querySelector('a-camera');
    if (camera) {
      camera.setAttribute('fov', desiredFov);
    }
  }

  var enableMotionBtn = document.getElementById('enable-motion-btn');
  
  if (isMobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    enableMotionBtn.style.display = 'block';
    enableMotionBtn.addEventListener('click', function() {
      DeviceOrientationEvent.requestPermission().then(function(permissionState) {
        if (permissionState === 'granted') {
          enableMotionBtn.style.display = 'none';
          window.location.reload();
        }
      }).catch(console.error);
    });
  } else {
    enableMotionBtn.style.display = 'none';
  }
});