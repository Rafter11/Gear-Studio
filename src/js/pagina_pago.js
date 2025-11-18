const client = supabase.createClient(
  'https://ohjqmljmvufluqffhdye.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oanFtbGptdnVmbHVxZmZoZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTcyMDIsImV4cCI6MjA3NTkzMzIwMn0.16Ii3f1iICoVlA6_ZGLfnVBQjj3MCFhK4os0Rpy_kX0'
);

// Función para mostrar alertas personalizadas
function showAlert(message, type = 'info', duration = 4000) {
  let container = document.getElementById('alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'alert-container';
    document.body.appendChild(container);
  }

  const alert = document.createElement('div');
  alert.className = `alert ${type}`;
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.flex = '1';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-alert';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => {
    alert.style.animation = 'fadeOutAlert 0.4s ease-in forwards';
    setTimeout(() => alert.remove(), 400);
  };
  
  alert.appendChild(messageSpan);
  alert.appendChild(closeBtn);
  container.appendChild(alert);

  setTimeout(() => {
    if (alert.parentElement) {
      alert.style.animation = 'fadeOutAlert 0.4s ease-in forwards';
      setTimeout(() => {
        if (alert.parentElement) alert.remove();
      }, 400);
    }
  }, duration);
}

const params = new URLSearchParams(window.location.search);
const id_juego = params.get('id_juego');

async function cargarDatos() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: juego } = await client.from('juego').select('*').eq('id_juego', id_juego).single();

  let categoriaNombre = 'Sin categoría';
  const { data: relaciones } = await client
    .from('juego_categoria')
    .select('id_categoria')
    .eq('id_juego', id_juego);

  if (relaciones && relaciones.length > 0) {
    const idCat = relaciones[0].id_categoria;
    const { data: categoria } = await client
      .from('categoria')
      .select('nombre_categoria')
      .eq('id_categoria', idCat)
      .single();
    if (categoria) categoriaNombre = categoria.nombre_categoria;
  }

  document.getElementById('info-juego').innerHTML = `
        <strong>${juego.nombre}</strong><br>
        Precio: ${juego.precio} €<br>
        Desarrollador: ${juego.desarrollador}<br>
        Categoría: ${categoriaNombre}
      `;

  const imagen = document.getElementById('imagen-juego');
  imagen.src = juego.imagen_url || 'src/img/default_game.jpg';

  const { data: metodos } = await client.from('metodopago').select('*').eq('id_usuario', user.id);
  const select = document.getElementById('metodo-pago');
  if (metodos && metodos.length > 0) {
    metodos.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id_metodo;
      option.textContent = `${m.tipo} — ${m.detalles}`;
      select.appendChild(option);
    });
  } else {
    select.innerHTML = '<option disabled>No tienes métodos de pago registrados</option>';
  }
}

async function finalizarCompra() {
  const { data: { user } } = await client.auth.getUser();
  const id_metodo = document.getElementById('metodo-pago').value;
  const { data: juego } = await client.from('juego').select('*').eq('id_juego', id_juego).single();

  const fecha = new Date().toISOString();

  await client.from('compra').insert([{
    id_usuario: user.id,
    id_juego: id_juego,
    fecha_compra: fecha,
    precio_pagado: juego.precio
  }]);

  await client.from('biblioteca').insert([{
    id_usuario: user.id,
    id_juego: id_juego,
    fecha_adquisicion: fecha
  }]);

  showAlert("¡Compra realizada y juego añadido a tu biblioteca!", 'success', 3000);
  setTimeout(() => {
    window.location.href = "pagina_biblioteca.html";
  }, 3000);
}

document.getElementById('form-metodo').addEventListener('submit', async (e) => {
  e.preventDefault();

  const tipo = document.getElementById('tipo').value.trim();
  const detalles = document.getElementById('detalles').value.trim();
  if (!tipo || !detalles) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    showAlert("Debes iniciar sesión para añadir métodos de pago.", 'warning', 3000);
    return;
  }

  const { error } = await client.from('metodopago').insert([{
    id_usuario: user.id,
    tipo: tipo,
    detalles: detalles
  }]);

  if (error) {
    console.error("Error al guardar método:", error.message);
    showAlert("Hubo un error al guardar el método de pago.", 'error', 3000);
    return;
  }

  showAlert("Método de pago guardado correctamente.", 'success', 2000);
  document.getElementById('form-metodo').reset();
  cargarDatos();
});

cargarDatos();
