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