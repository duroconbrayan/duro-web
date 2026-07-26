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

    titulo.textContent = cancion;

    overlay.style.display = "block";
    menu.style.display = "block";

}

function cerrarMenu() {

    document.getElementById("overlay").style.display = "none";
    document.getElementById("song-menu").style.display = "none";

}

function mostrarOpcionesSubir() {

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <button>📸 Seguir en Instagram (+5 puestos)</button>

        <button>❤️ Like a la última publicación (+10 puestos)</button>

        <button>📲 Compartir una publicación (+20 puestos)</button>

        <button onclick="volverMenuPrincipal()">⬅️ Volver</button>
    `;

}