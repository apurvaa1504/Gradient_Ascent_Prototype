window.addEventListener('error', function(e) {
  fetch('http://localhost:3000/log-error', {
    method: 'POST',
    body: e.message + '\n' + e.error.stack
  });
});
