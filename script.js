console.log("script.js cargado");

const playlistURL = "https://playlist-api.bookingelbrayan.workers.dev/playlist";

function cargarPlaylist() {

    fetch(playlistURL)
        .then(response => response.json())
        .then(canciones => {

            const table = document.getElementById("playlist-body");

            table.innerHTML = "";

            canciones.forEach(cancion => {

                table.innerHTML += `
    <div class="song-card" onclick="seleccionarCancion('${cancion.cancion}')">
        <span class="song-number">#${cancion.puesto}</span>
        <span class="song-name">${cancion.cancion}</span>
    </div>
`;

            });

        })
        .catch(error => {
            console.error("Error al cargar la playlist:", error);
        });

}

cargarPlaylist();

setInterval(cargarPlaylist, 10000);

function seleccionarCancion(cancion) {

    const menu = document.getElementById("song-menu");
    const overlay = document.getElementById("overlay");
    const titulo = document.getElementById("selected-song");
const subtitulo = document.getElementById("menu-subtitle");

titulo.textContent = cancion;
subtitulo.textContent = "¿Qué quieres hacer?";

volverMenuPrincipal();

overlay.style.display = "block";
menu.style.display = "block";

}

function cerrarMenu() {

    document.getElementById("overlay").style.display = "none";
    document.getElementById("song-menu").style.display = "none";

}

function mostrarOpcionesSubir() {

    document.getElementById("menu-subtitle").textContent =
    "Elige una forma de subir tu canción.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `

<div class="action-card" onclick="window.open('https://instagram.com/brayan_trampa', '_blank')">
    <div class="action-left">
        <span class="action-icon">📸</span>

        <div>
            <div class="action-title">Seguir en Instagram</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+1 puesto</span>
    <span class="action-arrow">›</span>
</div>
</div>


<div class="action-card" onclick="window.open('https://www.facebook.com/duroconbrayan', '_blank')">
    <div class="action-left">
        <span class="action-icon">👍</span>

        <div>
            <div class="action-title">Seguir en Facebook</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+1 puesto</span>
    <span class="action-arrow">›</span>
</div>
</div>


<div class="action-card" onclick="window.open('https://www.instagram.com/p/DYXjV8YkTiA/', '_blank')">
    <div class="action-left">
        <span class="action-icon">❤️</span>

        <div>
            <div class="action-title">Dar like a la última publicación</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+2 puestos</span>
    <span class="action-arrow">›</span>
</div>
</div>


<div class="action-card" onclick="window.open('https://open.spotify.com/playlist/1vHnGiv1cbU77FhbQFtO3P', '_blank')">
    <div class="action-left">
        <span class="action-icon">🎵</span>

        <div>
            <div class="action-title">Guardar playlist de Spotify</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+5 puestos</span>
    <span class="action-arrow">›</span>
</div>
</div>


<div class="action-card" onclick="window.open('https://www.twitch.tv/duroconbrayan', '_blank')">
    <div class="action-left">
        <span class="action-icon">🟣</span>

        <div>
            <div class="action-title">Seguir en Twitch</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+10 puestos</span>
    <span class="action-arrow">›</span>
</div>
</div>


<p style="margin-top:20px;">
📩 Envía la prueba por mensaje interno a @duroconbrayan en TikTok para validar tu subida.
</p>


<button onclick="volverMenuPrincipal()">⬅️ Volver</button>

`;

}

function mostrarOpcionesSaltar() {

    document.getElementById("menu-subtitle").textContent =
    "Apoya el directo para pasar al siguiente turno.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <p>🚀 Tu canción sonará a continuación.</p>

        <p>Apoya el directo con <strong>$1 USD</strong> por PayPal.</p>

        <button onclick="window.open('https://www.paypal.com/paypalme/duroconbrayan/1', '_blank')">
    💵 Ir a PayPal
</button>

        <button onclick="volverMenuPrincipal()">⬅️ Volver</button>
    `;

}

function volverMenuPrincipal() {

    document.getElementById("menu-subtitle").textContent =
    "¿Qué quieres hacer?";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <button id="btn-subir" onclick="mostrarOpcionesSubir()">⬆️ Subir canción</button>

        <button id="btn-saltar" onclick="mostrarOpcionesSaltar()">⏭️ Saltar directo</button>

        <button onclick="cerrarMenu()">❌ Cancelar</button>
    `;

}