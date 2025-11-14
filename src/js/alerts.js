/**
 * Sistema de Alertas Personalizadas para Gear Studio
 * Reemplaza los alerts() tradicionales por alertas estilizadas
 */

function showAlert(message, type = 'info', duration = 4000) {
  // Buscar o crear el contenedor de alertas
  let container = document.getElementById('alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'alert-container';
    document.body.insertBefore(container, document.body.firstChild);
  }

  // Crear elemento de alerta
  const alert = document.createElement('div');
  alert.className = `alert ${type}`;
  alert.textContent = message;

  // Agregar a contenedor
  container.appendChild(alert);

  // Auto-remover después del tiempo especificado
  /*setTimeout(() => {
    alert.style.animation = 'fadeOutAlert 0.5s ease-in forwards';
    setTimeout(() => {
      alert.remove();
    }, 500);
  }, duration);*/

  return alert;
}

// Alias para diferentes tipos
window.showError = (msg, duration) => showAlert(msg, 'error', duration);
window.showSuccess = (msg, duration) => showAlert(msg, 'success', duration);
window.showWarning = (msg, duration) => showAlert(msg, 'warning', duration);
window.showInfo = (msg, duration) => showAlert(msg, 'info', duration);

// Reemplazar alert() global con nuestra versión
window.alert = function(message) {
  showAlert(message, 'info', 5000);
};
