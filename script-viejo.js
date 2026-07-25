const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSnbA9MiMIgK9oYyRkIKSA71oHmoNd9OoS3-7g2Yk70oR1vVLzFkbLLmVxg73gkNjLti-5Xdiyxs7TO/pub?output=csv";

function cargarPlaylist() {

    fetch(sheetURL)
        .then(response => response.text())
        .then(data => {

            const rows = data.split("\n").slice(1);

            const table = document.getElementById("playlist-body");

            table.innerHTML = "";

            rows.forEach((row, index) => {

                if (row.trim() === "") return;

                const columns = row.split(",");

                if (!columns[0]) return;

                table.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${columns[0]}</td>
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