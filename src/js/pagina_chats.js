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

// Variables globales
let usuarioActual = null;
let chatActivo = null;
let nombreChatActivo = '';
let avatarChatActivo = '';

// Abrir modal
function abrirModalPerfil() {
  document.getElementById("modal-perfil").style.display = "flex";
}

// Cerrar modal
function cerrarModal() {
  document.getElementById("modal-perfil").style.display = "none";
}

// Formulario de editar perfil
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

// Notificaciones
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

// Obtiene los usuarios, muestra el nombre, su foto y llama a cargarChats()
async function mostrarUsuario() {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;
  usuarioActual = user;

  const { data: perfil } = await client
    .from('usuario')
    .select('nombre_usuario, imagen_perfil')
    .eq('id_usuario', user.id)
    .single();

  document.getElementById('usuario-nombre').textContent = perfil?.nombre_usuario || user.email;
  document.getElementById('usuario-avatar').src =
    perfil?.imagen_perfil || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(perfil?.nombre_usuario || user.email));

  cargarChats();
}

// Obtiene los IDs de amigos, consulta la tabla usuario para mostrar su nombre y clci en amigo, abre el chat
async function cargarChats() {
  const amigosGuardados = localStorage.getItem("misAmigos");
  const ul = document.getElementById('lista-chats');
  ul.innerHTML = '';

  if (!amigosGuardados) {
    ul.innerHTML = '<li>No tienes amigos todavía</li>';
    return;
  }

  const amigosIds = JSON.parse(amigosGuardados);
  if (!Array.isArray(amigosIds) || amigosIds.length === 0) {
    ul.innerHTML = '<li>No tienes amigos todavía</li>';
    return;
  }

  for (const id of amigosIds) {
    const { data: perfil } = await client
      .from('usuario')
      .select('nombre_usuario, imagen_perfil')
      .eq('id_usuario', id)
      .single();

    if (perfil) {
      const li = document.createElement('li');
      li.textContent = perfil.nombre_usuario;
      li.onclick = () => abrirChat(id, perfil.nombre_usuario, perfil.imagen_perfil);
      ul.appendChild(li);
    }
  }
}

// Abre el chat
function abrirChat(idAmigo, nombreAmigo, avatarAmigo) {
  chatActivo = idAmigo;
  nombreChatActivo = nombreAmigo;
  avatarChatActivo = avatarAmigo || '';
  document.getElementById('chat-titulo').textContent = `Chat con ${nombreAmigo}`;
  document.getElementById('modal-chat').style.display = 'flex';
  cargarMensajes(idAmigo, nombreAmigo, avatarAmigo);
}

// Cierra el chat
function cerrarModalChat() {
  document.getElementById('modal-chat').style.display = 'none';
  chatActivo = null;
  nombreChatActivo = '';
  avatarChatActivo = '';
}

// Consulta la tabla mensaje, ordena los mensajes por fecha de los dos usuarios y los muestra
async function cargarMensajes(idAmigo, nombreAmigo, avatarAmigo) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: mensajes, error } = await client
    .from('mensaje')
    .select('contenido, id_emisor, fecha_envio')
    .or(`and(id_emisor.eq.${user.id},id_receptor.eq.${idAmigo}),and(id_emisor.eq.${idAmigo},id_receptor.eq.${user.id})`)
    .order('fecha_envio', { ascending: true });

  if (error) {
    console.error("Error al cargar mensajes:", error.message);
    return;
  }

  const contenedor = document.getElementById('chat-mensajes');
  contenedor.innerHTML = '';
  (mensajes || []).forEach(m => {
    const div = document.createElement('div');
    div.className = `mensaje ${m.id_emisor === user.id ? 'tuyo' : 'amigo'}`;
    const avatarUrl = m.id_emisor === user.id
      ? (document.getElementById('usuario-avatar').src || 'https://ui-avatars.com/api/?name=Tú')
      : (avatarAmigo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nombreAmigo));
    div.innerHTML = `
          <img class="avatar-msg" src="${avatarUrl}" alt="avatar" />
          <div class="contenido">
            <strong>${m.id_emisor === user.id ? 'Tú' : nombreAmigo}:</strong>
            ${m.contenido}
            <br><small>${new Date(m.fecha_envio).toLocaleString()}</small>
          </div>
        `;
    contenedor.appendChild(div);
  });
}

// Inserta un nuevo mensaje
async function enviarMensaje() {
  const contenido = document.getElementById('mensaje-input').value.trim();
  if (!contenido || !chatActivo) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  await client.from('mensaje').insert({
    id_emisor: user.id,
    id_receptor: chatActivo,
    contenido,
    fecha_envio: new Date().toISOString()
  });

  document.getElementById('mensaje-input').value = '';

  cargarMensajes(chatActivo, nombreChatActivo, avatarChatActivo);  // Reusar el nombre y avatar para pintar bien
}

// Muestra un modal con los usuarios con los que puedes iniciar una conversacion
function abrirModalNuevoChat() {
  const amigosGuardados = localStorage.getItem("misAmigos");
  const lista = document.getElementById("lista-amigos-chat");
  lista.innerHTML = '';

  if (!amigosGuardados) {
    lista.innerHTML = '<li>Debes tener al menos 1 amigo para iniciar una conversación.</li>';
  } else {
    const amigosIds = JSON.parse(amigosGuardados);
    if (!Array.isArray(amigosIds) || amigosIds.length === 0) {
      lista.innerHTML = '<li>Debes tener al menos 1 amigo para iniciar una conversación.</li>';
    } else {
      amigosIds.forEach(async id => {
        const { data: perfil } = await client
          .from('usuario')
          .select('nombre_usuario, imagen_perfil')
          .eq('id_usuario', id)
          .single();

        if (perfil) {
          const li = document.createElement('li');
          li.innerHTML = `
                <img src="${perfil.imagen_perfil || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(perfil.nombre_usuario)}"
                     style="width:24px;height:24px;border-radius:50%;margin-right:8px;vertical-align:middle;" />
                ${perfil.nombre_usuario}
                <button onclick="abrirChat('${id}', '${perfil.nombre_usuario.replace(/'/g, "\\'")}', '${(perfil.imagen_perfil || '').replace(/'/g, "\\'")}')">Iniciar chat</button>
              `;
          lista.appendChild(li);
        }
      });
    }
  }

  document.getElementById("modal-nuevo-chat").style.display = "flex";
}

// Cierra el modal
function cerrarModalNuevoChat() {
  document.getElementById("modal-nuevo-chat").style.display = "none";
}

// Carga las notificaciones del usuario actual
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
    if (!n.leida) item.style.fontWeight = 'bold';
    lista.appendChild(item);
  });

  // Actualiza el contador en la campana
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

// Iniciación
mostrarUsuario();
cargarNotificacionesUsuario();
