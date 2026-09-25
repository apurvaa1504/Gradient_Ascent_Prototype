export function setupErrorLogger() {
  window.addEventListener('error', (event) => {
    fetch('http://localhost:3000/log-error', {
      method: 'POST',
      body: JSON.stringify({ message: event.message, stack: event.error?.stack })
    }).catch(e => console.log(e));
  });
}
