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
                    <tr>
                        <td>${cancion.puesto}</td>
                        <td>${cancion.cancion}</td>
                    </tr>
                `;

            });

        })
        .catch(error => {
            console.error("Error al cargar la playlist:", error);
        });

}

cargarPlaylist();

setInterval(cargarPlaylist, 10000);