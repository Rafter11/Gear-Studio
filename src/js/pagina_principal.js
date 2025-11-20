const client = supabase.createClient('https://ohjqmljmvufluqffhdye.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oanFtbGptdnVmbHVxZmZoZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTcyMDIsImV4cCI6MjA3NTkzMzIwMn0.16Ii3f1iICoVlA6_ZGLfnVBQjj3MCFhK4os0Rpy_kX0');

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

// Variables globales
let juegoActualId = null;
let juegosMap = {};
let esAdmin = false;
let juegoEditando = null;

document.getElementById('busqueda-nombre').addEventListener('input', cargarJuegos);

// Gestión de perfil del usuario
document.getElementById('usuario-info').addEventListener('click', async function () {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return;
  const { data: perfil } = await client.from('usuario').select('nombre_usuario, email, contrasena, imagen_perfil').eq('id_usuario', user.id).single();
  if (perfil) {
    document.getElementById('nombre').value = perfil.nombre_usuario || "";
    document.getElementById('correo').value = perfil.email || "";
    document.getElementById('contrasena').value = perfil.contrasena || "";
  }
  document.getElementById('modal-perfil').style.display = 'block';
});

function cerrarModal() {
  document.getElementById('modal-perfil').style.display = 'none';
}

// Formulario de editar usuario
document.getElementById('form-editar').addEventListener('submit', async function (e) {
  e.preventDefault();
  const nombre = document.getElementById('nombre').value.trim();
  const correo = document.getElementById('correo').value.trim();
  const contrasena = document.getElementById('contrasena').value.trim();
  const archivo = document.getElementById('foto').files[0];
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

// Consulta al tabla categoria
async function cargarCategorias() {
  const { data, error } = await client.from('categoria').select('id_categoria, nombre_categoria');
  if (error) return;
  const select = document.getElementById('filtro-categoria');
  select.innerHTML = '<option value="">Todas las categorías</option>';
  data.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.nombre_categoria;
    option.textContent = cat.nombre_categoria;
    select.appendChild(option);
  });
}

// Consula la categoría para editar el juego
async function cargarCategoriasParaEditar(id_juego) {
  const { data: categorias, error } = await client.from('categoria').select('id_categoria, nombre_categoria');
  if (error) return;

  const select = document.getElementById('editar-categoria');
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  categorias.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id_categoria;
    option.textContent = cat.nombre_categoria;
    select.appendChild(option);
  });

  // Cargar la categoría actual del juego
  const { data: relaciones } = await client.from('juego_categoria').select('id_categoria').eq('id_juego', id_juego);
  if (relaciones && relaciones.length > 0) {
    select.value = relaciones[0].id_categoria;
  }
}

// Consula la categoría para añadir el juego
async function cargarCategoriasParaNuevoJuego() {
  const { data: categorias, error } = await client.from('categoria').select('id_categoria, nombre_categoria');
  if (error) return;

  const select = document.getElementById('nuevo-categoria');
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  categorias.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id_categoria;
    option.textContent = cat.nombre_categoria;
    select.appendChild(option);
  });
}

// Aplica filtros, consulta la tabla juego y muestra las tarjetas de estos. Si eres admin podras crear y editar los juegos
async function cargarJuegos() {
  const nombre = document.getElementById('busqueda-nombre').value.trim();
  const categoria = document.getElementById('filtro-categoria').value;
  const precioMax = document.getElementById('filtro-precio').value;
  const desarrollador = document.getElementById('filtro-desarrollador').value.trim();

  let query = client
    .from('juego')
    .select('id_juego, nombre, descripcion, precio, imagen_url, desarrollador, fecha_publicacion')
    .order('nombre', { ascending: true });
  if (nombre) query = query.ilike('nombre', `%${nombre}%`);
  if (precioMax) query = query.lte('precio', parseFloat(precioMax));
  if (desarrollador) query = query.ilike('desarrollador', `%${desarrollador}%`);

  const { data: juegos, error } = await query;
  if (error) {
    console.error('Error al cargar juegos:', error.message);
    return;
  }

  let filtrados = juegos;

  if (categoria) {
    const { data: categorias, error: errorCat } = await client.from('categoria').select('id_categoria, nombre_categoria');
    if (errorCat) {
      console.error('Error al cargar categorías:', errorCat.message);
      return;
    }
    const categoriaObj = categorias.find(c => c.nombre_categoria === categoria);
    if (!categoriaObj) {
      filtrados = [];
    } else {
      const { data: relaciones, error: errorRel } = await client
        .from('juego_categoria')
        .select('id_juego, id_categoria')
        .eq('id_categoria', categoriaObj.id_categoria);
      if (errorRel) {
        console.error('Error al cargar relaciones:', errorRel.message);
        return;
      }
      const idsFiltrados = relaciones.map(r => r.id_juego);
      filtrados = juegos.filter(j => idsFiltrados.includes(j.id_juego));
    }
  }

  const contenedor = document.getElementById('contenedor-juegos');
  contenedor.innerHTML = '';
  juegosMap = {};

  // Bloque "+" solo para admin, como PRIMER elemento
  if (esAdmin) {
    const addDiv = document.createElement('div');
    addDiv.className = 'juego add-juego';
    addDiv.innerHTML = `<span class="plus">+</span>`;
    addDiv.onclick = () => abrirModalNuevoJuego();
    contenedor.appendChild(addDiv); // se añade primero
  }

  filtrados.forEach(juego => {
    juegosMap[juego.id_juego] = juego;
    const div = document.createElement('div');
    div.className = 'juego';
    div.innerHTML = `
      <div class="imagen-contenedor">
        <img src="${juego.imagen_url}" alt="${juego.nombre}" />
        ${esAdmin ? `<button class="btn-editar-pos" onclick="abrirModalEditar('${juego.id_juego}')">✏️</button>` : ''}
      </div>
      <div class="nombre">${juego.nombre}</div>
      <div class="precio">💰 ${juego.precio.toFixed(2)} €</div>
      <button class="btn-comprar" onclick="abrirModalCompra('${juego.id_juego}')">Comprar</button>
    `;
    contenedor.appendChild(div);
  });
}

// Obtiene el usuario desde su tabla, muestra el avatar y el nombre. Si el rol es admin, aplica la edición y creación de juegos
async function mostrarUsuario() {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return;

  const { data: perfil, error: errorPerfil } = await client
    .from('usuario')
    .select('nombre_usuario, imagen_perfil, rol')
    .eq('id_usuario', user.id)
    .single();

  if (errorPerfil || !perfil) return;

  document.getElementById('usuario-nombre').textContent = perfil.nombre_usuario || user.email;
  document.getElementById('usuario-avatar').src =
    perfil.imagen_perfil || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(perfil.nombre_usuario || user.email);

  esAdmin = perfil.rol === 'admin';
  cargarJuegos();
}

function cerrarModalCompra() {
  document.getElementById('modal-compra').style.display = 'none';
}

// Modal de compra, carga las reseñas de los juegos. Contiene el boton de confirmar compra que redirige a pagina_pago.html
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

  await cargarReseñas(id_juego);
  document.getElementById('modal-categoria').textContent = categoriaNombre;
  document.getElementById('modal-compra').style.display = 'block';
}

function confirmarCompra() {
  window.location.href = `pagina_pago.html?id_juego=${juegoActualId}`;
}

// Reseñas. Inserta en la tabla sereña la fecha, el usuario y el texto escrito.
document.getElementById('form-reseña').addEventListener('submit', async function (e) {
  e.preventDefault();

  const puntuacion = parseInt(document.getElementById('reseña-puntuacion').value);
  const comentario = document.getElementById('reseña-comentario').value.trim();

  if (!juegoActualId || !puntuacion || !comentario) {
    showAlert("Faltan datos para enviar la reseña", 'warning', 3000);
    return;
  }

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    showAlert("No se pudo obtener el usuario actual", 'error', 3000);
    return;
  }

  const { error: insertError } = await client
    .from('reseña')
    .insert([{
      id_usuario: user.id,
      id_juego: juegoActualId,
      puntuacion: puntuacion,
      comentario: comentario,
      fecha: new Date().toISOString()
    }]);

  if (insertError) {
    showAlert("Error al guardar la reseña: " + insertError.message, 'error', 3000);
    return;
  }

  showAlert("¡Reseña enviada con éxito!", 'success', 3000);
  document.getElementById('form-reseña').reset();
});

// Da formato a la fecha (DD-MM-YYYY), ya que de normal está al reves (YYYY-MM-DD)
function formatearFecha(fechaISO) {
  const opciones = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(fechaISO).toLocaleDateString('es-ES', opciones);
}

// Carga las reseñas existentes
async function cargarReseñas(id_juego) {
  const contenedor = document.getElementById('lista-reseñas');
  contenedor.innerHTML = '<p>Cargando reseñas...</p>';

  const { data: reseñas, error } = await client
    .from('reseña')
    .select('puntuacion, comentario, fecha, usuario(nombre_usuario)')
    .eq('id_juego', id_juego)
    .order('fecha', { ascending: false });

  if (error) {
    contenedor.innerHTML = '<p>Error al cargar reseñas.</p>';
    console.error('Error reseñas:', error.message);
    return;
  }

  if (!reseñas || reseñas.length === 0) {
    contenedor.innerHTML = '<p>No hay reseñas aún.</p>';
    return;
  }

  contenedor.innerHTML = '';
  reseñas.forEach(r => {
    const div = document.createElement('div');
    div.style.marginBottom = '15px';
    div.style.padding = '10px';
    div.style.background = 'rgba(255,255,255,0.1)';
    div.style.borderRadius = '6px';
    div.style.border = '1px solid #786F5D';

    div.innerHTML = `
  <strong>${r.usuario?.nombre_usuario || 'Usuario anónimo'}</strong> — ⭐ ${r.puntuacion}/5<br>
  <em>${r.comentario}</em><br>
  <small style="color:#ccc;">${formatearFecha(r.fecha)}</small>
`;
    contenedor.appendChild(div);
  });
}

// Notificaciones. Abre y cierra la lista
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

// Carga notificaciones de su tabla
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

// Marca notificaciones como leidas
async function marcarNotificacionesComoLeidas() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  await client
    .from('notificacion')
    .update({ leida: true })
    .eq('id_usuario', user.id)
    .eq('leida', false);
}

// Función de admin. Editar le juego, cambiando sus datos
function abrirModalEditar(id_juego) {
  const juego = juegosMap[id_juego];
  if (!juego) return;

  juegoEditando = id_juego;
  document.getElementById('editar-nombre').value = juego.nombre;
  document.getElementById('editar-descripcion').value = juego.descripcion;
  document.getElementById('editar-precio').value = juego.precio;
  document.getElementById('editar-desarrollador').value = juego.desarrollador;

  // Cargar fecha de publicación
  if (juego.fecha_publicacion) {
    document.getElementById('editar-fecha-publicacion').value = juego.fecha_publicacion;
  }

  // Cargar categorías y seleccionar la actual
  cargarCategoriasParaEditar(id_juego);

  document.getElementById('modal-editar').style.display = 'block';
}

function cerrarModalEditar() {
  document.getElementById('modal-editar').style.display = 'none';
  juegoEditando = null;
}

// Función de admin, Borra el juego y todas sus relaciones
async function eliminarJuego() {
  if (!juegoEditando) return;

  const nombreJuego = document.getElementById('editar-nombre').value;
  const confirmar = confirm(`¿Estás seguro de que deseas eliminar el juego "${nombreJuego}"? Esta acción no se puede deshacer.`);

  if (!confirmar) return;

  try {
    // Eliminar relaciones en juego_categoria
    await client.from('juego_categoria').delete().eq('id_juego', juegoEditando);

    // Eliminar reseñas del juego
    await client.from('reseña').delete().eq('id_juego', juegoEditando);

    // Eliminar compras del juego
    await client.from('compra').delete().eq('id_juego', juegoEditando);

    // Eliminar de la biblioteca
    await client.from('biblioteca').delete().eq('id_juego', juegoEditando);

    // Finalmente, eliminar el juego
    const { error } = await client.from('juego').delete().eq('id_juego', juegoEditando);

    if (error) {
      showAlert("Error al eliminar juego: " + error.message, 'error', 3000);
    } else {
      showAlert("Juego eliminado correctamente.", 'success', 2000);
      cerrarModalEditar();
      cargarJuegos();
    }
  } catch (err) {
    showAlert("Error inesperado al eliminar: " + err.message, 'error', 3000);
  }
}

// Formulario de edicion de juego
document.getElementById('form-editar-juego').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!juegoEditando) return;

  let nuevaImagenUrl = null;
  const archivo = document.getElementById('editar-imagen').files[0];
  if (archivo) {
    const nombreArchivo = `juego_${juegoEditando}_${Date.now()}.${archivo.name.split('.').pop()}`;
    const { error: uploadError } = await client.storage
      .from('juegos')
      .upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: true });
    if (uploadError) {
      showAlert("Error al subir la imagen: " + uploadError.message, 'error', 3000);
      return;
    }
    const { data } = client.storage.from('juegos').getPublicUrl(nombreArchivo);
    nuevaImagenUrl = data.publicUrl;
  }

  const fechaPublicacion = document.getElementById('editar-fecha-publicacion').value;
  const categoriaSelect = document.getElementById('editar-categoria').value;
  const nuevaCategoria = document.getElementById('editar-nueva-categoria').value.trim();

  // Si el usuario quiere crear una nueva categoría
  let idCategoria = categoriaSelect;
  if (!categoriaSelect && nuevaCategoria) {
    const { data: categoriaInsertada, error: errorInsert } = await client.from('categoria').insert([{
      nombre_categoria: nuevaCategoria
    }]).select();

    if (errorInsert) {
      showAlert("Error al crear categoría: " + errorInsert.message, 'error', 3000);
      return;
    }

    if (!categoriaInsertada || categoriaInsertada.length === 0) {
      showAlert("Error: No se pudo crear la categoría correctamente", 'error', 3000);
      return;
    }

    idCategoria = categoriaInsertada[0].id_categoria;
    showAlert("Nueva categoría creada: " + nuevaCategoria, 'success', 2000);
  } else if (!categoriaSelect && !nuevaCategoria) {
    showAlert("Debes seleccionar una categoría o crear una nueva", 'warning', 3000);
    return;
  }

  const { error } = await client
    .from('juego')
    .update({
      nombre: document.getElementById('editar-nombre').value.trim(),
      descripcion: document.getElementById('editar-descripcion').value.trim(),
      precio: parseFloat(document.getElementById('editar-precio').value),
      desarrollador: document.getElementById('editar-desarrollador').value.trim(),
      fecha_publicacion: fechaPublicacion,
      ...(nuevaImagenUrl && { imagen_url: nuevaImagenUrl })
    })
    .eq('id_juego', juegoEditando);

  if (error) {
    showAlert("Error al actualizar: " + error.message, 'error', 3000);
  } else {
    // Actualizar la relación de categoría
    if (idCategoria) {
      // Eliminar categoría anterior
      await client.from('juego_categoria').delete().eq('id_juego', juegoEditando);
      // Insertar nueva categoría
      await client.from('juego_categoria').insert([{
        id_juego: juegoEditando,
        id_categoria: idCategoria
      }]);
    }

    showAlert("Juego actualizado correctamente.", 'success', 2000);
    cerrarModalEditar();
    cargarJuegos();
  }
});

// Abrir, cerrar y guardar el nuevo juego
function abrirModalNuevoJuego() {
  cargarCategoriasParaNuevoJuego();
  document.getElementById('modal-nuevo-juego').style.display = 'block';
}
function cerrarModalNuevoJuego() {
  document.getElementById('modal-nuevo-juego').style.display = 'none';
}

// Formulario del juego nuevo
document.getElementById('form-nuevo-juego').addEventListener('submit', async function (e) {
  e.preventDefault();

  const archivo = document.getElementById('nuevo-imagen').files[0];
  let nuevaImagenUrl = null;
  if (archivo) {
    const nombreArchivo = `juego_${Date.now()}.${archivo.name.split('.').pop()}`;
    const { error: uploadError } = await client.storage
      .from('juegos')
      .upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: true });
    if (uploadError) {
      showAlert("Error al subir la imagen: " + uploadError.message, 'error', 3000);
      return;
    }
    const { data } = client.storage.from('juegos').getPublicUrl(nombreArchivo);
    nuevaImagenUrl = data.publicUrl;
  }

  const fechaPublicacion = document.getElementById('nuevo-fecha-publicacion').value;
  const categoriaSelect = document.getElementById('nuevo-categoria').value;
  const nuevaCategoria = document.getElementById('nueva-categoria').value.trim();

  // Si el usuario quiere crear una nueva categoría
  let idCategoria = categoriaSelect;
  if (!categoriaSelect && nuevaCategoria) {
    const { data: categoriaInsertada, error: errorInsert } = await client.from('categoria').insert([{
      nombre_categoria: nuevaCategoria
    }]).select();

    if (errorInsert) {
      showAlert("Error al crear categoría: " + errorInsert.message, 'error', 3000);
      return;
    }

    if (!categoriaInsertada || categoriaInsertada.length === 0) {
      showAlert("Error: No se pudo crear la categoría correctamente", 'error', 3000);
      return;
    }

    idCategoria = categoriaInsertada[0].id_categoria;
    showAlert("Nueva categoría creada: " + nuevaCategoria, 'success', 2000);
  } else if (!categoriaSelect && !nuevaCategoria) {
    showAlert("Debes seleccionar una categoría o crear una nueva", 'warning', 3000);
    return;
  }

  const { data: nuevoJuego, error } = await client.from('juego').insert([{
    nombre: document.getElementById('nuevo-nombre').value.trim(),
    descripcion: document.getElementById('nuevo-descripcion').value.trim(),
    precio: parseFloat(document.getElementById('nuevo-precio').value),
    desarrollador: document.getElementById('nuevo-desarrollador').value.trim(),
    fecha_publicacion: fechaPublicacion,
    imagen_url: nuevaImagenUrl
  }]).select();

  if (error) {
    showAlert("Error al añadir juego: " + error.message, 'error', 3000);
    return;
  }

  // Insertar la relación de categoría
  if (idCategoria && nuevoJuego && nuevoJuego.length > 0) {
    await client.from('juego_categoria').insert([{
      id_juego: nuevoJuego[0].id_juego,
      id_categoria: idCategoria
    }]);
  }

  showAlert("Juego añadido correctamente.", 'success', 2000);
  cerrarModalNuevoJuego();
  cargarJuegos();
});

// Inicialización
cargarCategorias();
mostrarUsuario();
cargarNotificacionesUsuario();

// Mostrar juego aleatorio
async function juegoAleatorio() {
  const { data: juegos, error } = await client
    .from('juego')
    .select('id_juego, nombre, descripcion, precio, imagen_url, desarrollador');

  if (error || !juegos || juegos.length === 0) {
    showAlert("No hay juegos disponibles", 'warning', 3000);
    return;
  }

  const juegoRandom = juegos[Math.floor(Math.random() * juegos.length)];
  abrirModalCompra(juegoRandom.id_juego);
}
