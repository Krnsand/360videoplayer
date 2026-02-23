// image-viewer.js
// Handle motion controls for 360 image viewer

document.addEventListener('DOMContentLoaded', function () {
  var allowedImages = {
    'forest.jpg': true,
    'studio.jpg': true
  };

  var params = new URLSearchParams(window.location.search);
  var requestedImg = params.get('img');
  var selectedImg = (requestedImg && allowedImages[requestedImg]) ? requestedImg : 'forest.jpg';

  var sky = document.querySelector('a-sky');
  if (sky) {
    sky.setAttribute('src', selectedImg);
  }

  var enableMotionBtn = document.getElementById('enable-motion-btn');
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    enableMotionBtn.style.display = 'block';
    enableMotionBtn.addEventListener('click', function() {
      DeviceOrientationEvent.requestPermission().then(function(permissionState) {
        if (permissionState === 'granted') {
          enableMotionBtn.style.display = 'none';
          // A-Frame will automatically use device orientation once permission is granted
          window.location.reload();
        }
      }).catch(console.error);
    });
  } else {
    enableMotionBtn.style.display = 'none';
  }
});