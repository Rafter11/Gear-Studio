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

let juegoActualId = null;
let juegosMap = {};

async function cargarBiblioteca() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: biblioteca } = await client
    .from('biblioteca')
    .select('id_juego')
    .eq('id_usuario', user.id);

  const contenedor = document.getElementById('contenedor-juegos');
  contenedor.innerHTML = '';

  for (const entrada of biblioteca) {
    const { data: juego } = await client
      .from('juego')
      .select('*')
      .eq('id_juego', entrada.id_juego)
      .single();

    juegosMap[juego.id_juego] = juego;

    const tarjeta = document.createElement('div');
    tarjeta.className = 'juego-card';
    tarjeta.innerHTML = `
      <img src="${juego.imagen_url || 'src/img/default_game.jpg'}" alt="${juego.nombre}" />
      <h3>${juego.nombre}</h3>
      <p>${juego.desarrollador}</p>
      <p><strong>${juego.precio} €</strong></p>
      <button onclick="descargarJuego('${juego.nombre}')" class="boton-descargar">Descargar</button>
    `;
    contenedor.appendChild(tarjeta);
  }
}

async function mostrarUsuario() {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return;

  const correo = user.email;
  const { data: perfil, error: errorPerfil } = await client
    .from('usuario')
    .select('nombre_usuario, imagen_perfil, contrasena')
    .eq('email', correo)
    .single();

  if (errorPerfil || !perfil) return;

  document.getElementById('usuario-nombre').textContent = perfil.nombre_usuario || correo;
  document.getElementById('usuario-avatar').src =
    perfil.imagen_perfil || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(perfil.nombre_usuario || correo);

  document.getElementById('nombre').value = perfil.nombre_usuario || "";
  document.getElementById('correo').value = correo;
  document.getElementById('contrasena').value = perfil.contrasena || "";
  document.getElementById('titulo-biblioteca').textContent = `Biblioteca de ${perfil.nombre_usuario}`;
}

document.getElementById("usuario-info").onclick = () => {
  document.getElementById("modal-perfil").style.display = "flex";
};

function cerrarModal() {
  document.getElementById("modal-perfil").style.display = "none";
}

document.getElementById("form-editar").addEventListener("submit", async function (e) {
  e.preventDefault();
  const nombre = document.getElementById("nombre").value.trim();
  const correo = document.getElementById("correo").value.trim();
  const contrasena = document.getElementById("contrasena").value.trim();
  const archivo = document.getElementById("foto").files[0];

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return;

  let nuevaUrlFoto = null;
  if (archivo) {
    const nombreArchivo = `${user.id}_${Date.now()}.${archivo.name.split('.').pop()}`;
    const { error: uploadError } = await client.storage.from('fotos_perfil').upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: true });
    if (uploadError) return showAlert("Error al subir la foto: " + uploadError.message, 'error', 3000);
    const { data } = client.storage.from('fotos_perfil').getPublicUrl(nombreArchivo);
    nuevaUrlFoto = data.publicUrl;
  }

  await client.from('usuario').update({
    ...(nombre && { nombre_usuario: nombre }),
    ...(correo && { email: correo }),
    ...(nuevaUrlFoto && { imagen_perfil: nuevaUrlFoto }),
    ...(contrasena && { contrasena: contrasena })
  }).eq('id_usuario', user.id);

  if (correo || contrasena) {
    await client.auth.updateUser({
      ...(correo && { email: correo }),
      ...(contrasena && { password: contrasena })
    });
  }

  if (nuevaUrlFoto) document.getElementById('usuario-avatar').src = nuevaUrlFoto;
  if (nombre) document.getElementById('usuario-nombre').textContent = nombre;
  cerrarModal();
});

async function filtrarBiblioteca() {
  const nombre = document.getElementById('busqueda-nombre').value.trim();
  const categoria = document.getElementById('filtro-categoria').value;
  const precioMax = document.getElementById('filtro-precio').value;
  const desarrollador = document.getElementById('filtro-desarrollador').value.trim();

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: biblioteca } = await client
    .from('biblioteca')
    .select('id_juego')
    .eq('id_usuario', user.id);

  const ids = biblioteca.map(b => b.id_juego);

  let query = client.from('juego').select('*').in('id_juego', ids);
  if (nombre) query = query.ilike('nombre', `%${nombre}%`);
  if (precioMax) query = query.lte('precio', parseFloat(precioMax));
  if (desarrollador) query = query.ilike('desarrollador', `%${desarrollador}%`);

  const { data: juegos } = await query;

  let filtrados = juegos;

  if (categoria) {
    const { data: categorias } = await client.from('categoria').select('id_categoria, nombre_categoria');
    const categoriaObj = categorias.find(c => c.nombre_categoria === categoria);
    if (categoriaObj) {
      const { data: relaciones } = await client
        .from('juego_categoria')
        .select('id_juego')
        .eq('id_categoria', categoriaObj.id_categoria);
      const idsFiltrados = relaciones.map(r => r.id_juego);
      filtrados = juegos.filter(j => idsFiltrados.includes(j.id_juego));
    } else {
      filtrados = [];
    }
  }

  const contenedor = document.getElementById('contenedor-juegos');
  contenedor.innerHTML = '';

  filtrados.forEach(juego => {
    juegosMap[juego.id_juego] = juego;
    const tarjeta = document.createElement('div');
    tarjeta.className = 'juego-card';
    tarjeta.innerHTML = `
    <img src="${juego.imagen_url || 'src/img/default_game.jpg'}" alt="${juego.nombre}" />
    <h3>${juego.nombre}</h3>
    <p>${juego.desarrollador}</p>
    <p><strong>${juego.precio} €</strong></p>
  `;
    contenedor.appendChild(tarjeta);
  });
}

async function cargarCategorias() {
  const { data } = await client.from('categoria').select('nombre_categoria');
  const select = document.getElementById('filtro-categoria');
  data.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.nombre_categoria;
    option.textContent = cat.nombre_categoria;
    select.appendChild(option);
  });
}

async function juegoAleatorio() {
  const { data: juegos, error } = await client
    .from('juego')
    .select('*');

  if (error || !juegos || juegos.length === 0) {
    showAlert("No se pudo obtener juegos.", 'error', 3000);
    return;
  }

  const aleatorio = juegos[Math.floor(Math.random() * juegos.length)];
  juegosMap[aleatorio.id_juego] = aleatorio;
  abrirModalCompra(aleatorio.id_juego);
}

async function abrirModalCompra(id_juego) {
  const juego = juegosMap[id_juego];
  if (!juego) return;

  juegoActualId = juego.id_juego;
  document.getElementById('modal-nombre').textContent = juego.nombre;
  document.getElementById('modal-imagen').src = juego.imagen_url;
  document.getElementById('modal-descripcion').textContent = juego.descripcion;
  document.getElementById('modal-precio').textContent = juego.precio;
  document.getElementById('modal-desarrollador').textContent = juego.desarrollador;

  const { data: relaciones } = await client
    .from('juego_categoria')
    .select('id_categoria')
    .eq('id_juego', juego.id_juego);

  let categoriaNombre = 'Sin categoría';
  if (relaciones && relaciones.length > 0) {
    const idCat = relaciones[0].id_categoria;
    const { data: categoria } = await client
      .from('categoria')
      .select('nombre_categoria')
      .eq('id_categoria', idCat)
      .single();
    if (categoria) categoriaNombre = categoria.nombre_categoria;
  }

  document.getElementById('modal-categoria').textContent = categoriaNombre;
  document.getElementById('modal-compra').style.display = 'flex';
}

function cerrarModalCompra() {
  document.getElementById('modal-compra').style.display = 'none';
}

function toggleNotificaciones(event) {
  event.stopPropagation();
  const lista = document.getElementById('notificaciones-lista');
  const visible = lista.style.display === 'block';
  lista.style.display = visible ? 'none' : 'block';

  if (!visible) {
    cargarNotificacionesUsuario();
    marcarNotificacionesComoLeidas();
  }
}

document.addEventListener('click', () => {
  const lista = document.getElementById('notificaciones-lista');
  if (lista) lista.style.display = 'none';
});

async function cargarNotificacionesUsuario() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: notificaciones, error } = await client
    .from('notificacion')
    .select('tipo, mensaje, fecha, leida')
    .eq('id_usuario', user.id)
    .order('fecha', { ascending: false });

  const lista = document.getElementById('notificaciones-lista');
  lista.innerHTML = '';

  if (error || !notificaciones || notificaciones.length === 0) {
    lista.innerHTML = '<div class="notificacion-item">No tienes notificaciones</div>';
    return;
  }

  notificaciones.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notificacion-item';
    item.innerHTML = `
      <strong>${n.tipo}</strong><br>
      ${n.mensaje}<br>
      <small>${new Date(n.fecha).toLocaleString()}</small>
    `;
    item.onclick = (e) => {
      e.stopPropagation();
    };
    if (!n.leida) item.style.fontWeight = 'bold';
    lista.appendChild(item);
  });

  const noLeidas = notificaciones.filter(n => !n.leida).length;
  document.getElementById('notificaciones-icono').textContent = `🔔 (${noLeidas})`;
}

async function marcarNotificacionesComoLeidas() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  await client
    .from('notificacion')
    .update({ leida: true })
    .eq('id_usuario', user.id)
    .eq('leida', false);
}

function confirmarCompra() {
  if (juegoActualId) {
    window.location.href = `pagina_pago.html?id_juego=${juegoActualId}`;
  }
}

function descargarJuego(nombreJuego) {
  showAlert(`🔽 Descargando "${nombreJuego}"...`, 'info', 3000);
}

cargarCategorias();
mostrarUsuario();
cargarBiblioteca();
