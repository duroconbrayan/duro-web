console.log("script.js NUEVO CARGADO");

const statusURL = "https://playlist-api.bookingelbrayan.workers.dev/status";
const requestsURL = "https://playlist-api.bookingelbrayan.workers.dev/requests";

let ultimaPlaylist = "";
let ultimaCancion = "";
let solicitudSeleccionadaId = null;

async function comprobarEstadoLive() {
    try {
        const response = await fetch(statusURL);
        const data = await response.json();

        if (data.live) {
            document.body.classList.remove("offline");
        } else {
            document.body.classList.add("offline");
        }

    } catch (error) {
        console.error("Error al comprobar estado LIVE:", error);
    }
}

async function cargarHistorial() {

    const contenedor = document.getElementById("played-history");

    if (!contenedor) return;

    try {

        const response = await fetch(requestsURL);
        const requests = await response.json();

        const played = requests
            .filter(item => item.status === "played")
            .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));

            const playing = requests.find(item => item.status === "playing");

            const queue = requests
    .filter(item => item.status === "queue")
    .sort((a, b) => a.sort_order - b.sort_order);

            const currentSong = document.getElementById("current-song");

if (currentSong && playing) {

    if (playing.play_number) {
        currentSong.textContent =
            `#${playing.play_number} — ${playing.text}`;
    } else {
        currentSong.textContent = playing.text;
    }
}

const table = document.getElementById("playlist-body");

if (table) {

    table.innerHTML = "";

    queue.forEach((item, index) => {

        let clase = "";
        let badge = "";

        if (index === 0) {
            clase = "gold-song";
            badge = "Próxima";
        } else if (index === 1) {
            clase = "silver-song";
            badge = "Después";
        } else if (index === 2) {
            clase = "bronze-song";
            badge = "En cola";
        }

        const card = document.createElement("div");
        card.className = `song-card ${clase}`;

        card.addEventListener("click", () => {
    seleccionarCancion(item.id, item.text);
});

        if (badge) {
            const badgeEl = document.createElement("div");
            badgeEl.className = "song-badge";
            badgeEl.textContent = badge;
            card.appendChild(badgeEl);
        }

        const numeroActual = playing?.play_number || played.length;

const number = document.createElement("span");
number.className = "song-number";
number.textContent = `#${numeroActual + index + 1}`;

        const name = document.createElement("span");
        name.className = "song-name";
        name.textContent = item.text;

        card.appendChild(number);
        card.appendChild(name);

        table.appendChild(card);
    });
}

        if (played.length === 0) {
            contenedor.innerHTML = "";
            return;
        }

        let html = `
            <div class="played-history-label">
                YA SONARON
            </div>
        `;

        played.slice(0, 5).forEach(item => {

    const numero = item.play_number
        ? `#${item.play_number} — `
        : "";

    html += `
        <div class="played-history-item">
            <span>✓</span>
            <strong>${numero}${item.text}</strong>
        </div>
    `;
});

        contenedor.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

comprobarEstadoLive();
cargarHistorial();

setInterval(() => {
    comprobarEstadoLive();
    cargarHistorial();
}, 10000);

function seleccionarCancion(id, cancion) {

    solicitudSeleccionadaId = id;

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

<div class="important-box">
    <h4>📩 ÚLTIMO PASO</h4>

    <p>
        Haz la acción y envía la prueba a
    </p>

    <div class="important-user">
        @duroconbrayan
    </div>

    <span>
        Tu canción se subirá cuando recibamos la prueba.
    </span>
</div>

<div class="action-card" onclick="mostrarPrueba(
    'instagram_follow',
    'Seguir en Instagram',
    '+1',
    'https://instagram.com/brayan_trampa'
)">
    <div class="action-left">
        <span class="action-icon">📸</span>

        <div>
            <div class="action-title">Seguir en Instagram</div>
        </div>
    </div>

    <div class="action-right">
        <span class="action-reward">+1</span>
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
    <span class="action-reward">+1</span>
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
    <span class="action-reward">+2</span>
    <span class="action-arrow">›</span>
</div>
</div>


<div class="action-card" onclick="window.open('https://open.spotify.com/playlist/1vHnGiv1cbU77FhbQFtO3P', '_blank')">
    <div class="action-left">
        <span class="action-icon">🎵</span>

        <div>
            <div class="action-title">Guardar playlist GAFAS CLUB</div>
        </div>
    </div>

    <div class="action-right">
    <span class="action-reward">+5</span>
    <span class="action-arrow">›</span>
</div>
</div>

<div class="action-card" onclick="window.open('https://open.spotify.com/playlist/5iT5vBLVdo4AOzwEHbmYl0', '_blank')">

    <div class="action-left">

        <span class="action-icon">🌴</span>

        <div>

            <div class="action-title">Guardar playlist URABÁ</div>

        </div>

    </div>

    <div class="action-right">

    <span class="action-reward">+5</span>

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
    <span class="action-reward">+10</span>
    <span class="action-arrow">›</span>
</div>
</div>

<button onclick="volverMenuPrincipal()">⬅️ Volver</button>

`;

}

function mostrarPrueba(action, titulo, recompensa, urlDestino) {

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <div class="proof-box">

            <div class="proof-header">
                <strong>${titulo}</strong>
                <span>${recompensa}</span>
            </div>

            <p class="proof-text">
                Haz el paso, vuelve aquí y sube una captura como prueba.
            </p>

            <button
                type="button"
                onclick="window.open('${urlDestino}', '_blank')"
            >
                ABRIR ${titulo.toUpperCase()}
            </button>

            <div class="proof-upload">
                <label for="proof-file">
                    📸 Seleccionar captura
                </label>

                <input
                    type="file"
                    id="proof-file"
                    accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.heic,.heif,.bmp,.tif,.tiff"
                >
            </div>

            <button
                type="button"
                onclick="enviarPrueba('${action}')"
            >
                ENVIAR PRUEBA
            </button>

            <button
                type="button"
                onclick="mostrarOpcionesSubir()"
            >
                ⬅️ Volver a los pasos
            </button>

        </div>
    `;
}

async function enviarPrueba(action) {

    const input = document.getElementById("proof-file");
    const file = input?.files?.[0];

    if (!solicitudSeleccionadaId) {
        alert("No se encontró la canción seleccionada.");
        return;
    }

    if (!file) {
        alert("Selecciona una captura primero.");
        return;
    }

    const formData = new FormData();

    formData.append("request_id", solicitudSeleccionadaId);
    formData.append("action", action);
    formData.append("proof", file);

    try {

        const response = await fetch(
            "https://playlist-api.bookingelbrayan.workers.dev/submit-proof",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "No se pudo enviar la prueba.");
            return;
        }

        const contenido = document.getElementById("menu-contenido");

        contenido.innerHTML = `
            <div class="proof-box">
                <strong>✅ PRUEBA ENVIADA</strong>

                <p class="proof-text">
                    Tu captura quedó pendiente de revisión.
                </p>

                <button
                    type="button"
                    onclick="cerrarMenu()"
                >
                    LISTO
                </button>
            </div>
        `;

    } catch (error) {
        alert("Error de conexión al enviar la prueba.");
    }
}

function mostrarOpcionesSaltar() {

    document.getElementById("menu-subtitle").textContent =
    "Apoya el directo para pasar al siguiente turno.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <p>🚀 Tu canción sonará a continuación.</p>

        <p>Apoya el directo con <strong>$2 USD</strong> por PayPal.</p>

        <button class="pay-btn" onclick="window.open('https://www.paypal.com/paypalme/duroconbrayan/2', '_blank')">
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