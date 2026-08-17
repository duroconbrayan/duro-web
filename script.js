const statusURL = "https://playlist-api.bookingelbrayan.workers.dev/status";
const requestsURL = "https://playlist-api.bookingelbrayan.workers.dev/requests";
const liveLikesURL =
    "https://playlist-api.bookingelbrayan.workers.dev/live-likes";

let solicitudSeleccionadaId = null;
let colaActual = [];
let posicionesAnteriores = new Map();
let primeraCargaCola = true;
let playingAnteriorId = null;
let topLikesAbierto = false;

function escaparHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function obtenerVisitorId() {
    let visitorId = localStorage.getItem("duro_visitor_id");

    if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("duro_visitor_id", visitorId);
    }

    return visitorId;
}

const visitorId = obtenerVisitorId();

async function registrarVisitaSesion() {

    try {
        await fetch(
            "https://playlist-api.bookingelbrayan.workers.dev/session-visit",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    visitor_id: visitorId
                })
            }
        );
    } catch (error) {
        console.error("Error registrando visita:", error);
    }
}

registrarVisitaSesion();

async function procesarRegresoPayPal() {

    const params = new URLSearchParams(window.location.search);

    const paypalStatus = params.get("paypal");
    const orderId = params.get("token");

if (paypalStatus === "cancel") {
    alert("Pago cancelado. Tu canción mantiene su posición actual.");

    window.history.replaceState(
        {},
        "",
        window.location.pathname
    );

    return;
}

    if (paypalStatus !== "success" || !orderId) {
        return;
    }

    try {

        const response = await fetch(
            "https://playlist-api.bookingelbrayan.workers.dev/paypal/capture-order",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    order_id: orderId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "No se pudo confirmar el pago.");
            return;
        }

        if (data.paid) {
            alert("✅ Pago confirmado. Tu canción pasó automáticamente al puesto #1.");

            window.history.replaceState(
                {},
                "",
                window.location.pathname
            );
        }

    } catch (error) {
        alert("Error confirmando el pago con PayPal.");
    }
}

procesarRegresoPayPal();

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

const playingActualId = playing?.id ?? null;

const cambioCancionActual =
    playingAnteriorId !== null &&
    playingActualId !== playingAnteriorId;

const movimientos = new Map();

if (!primeraCargaCola && !cambioCancionActual) {
    queue.forEach((item, index) => {
        const posicionAnterior = posicionesAnteriores.get(item.id);

        if (posicionAnterior !== undefined && index < posicionAnterior) {
            movimientos.set(item.id, posicionAnterior - index);
        }
    });
}

posicionesAnteriores = new Map(
    queue.map((item, index) => [item.id, index])
);

primeraCargaCola = false;
playingAnteriorId = playingActualId;
    
colaActual = queue;

const currentSong = document.getElementById("current-song");
const currentNumber = document.getElementById("current-number");

if (currentSong && currentNumber && playing) {

    currentNumber.textContent =
        playing.play_number
            ? `#${playing.play_number}`
            : "#--";

    currentSong.textContent = playing.text;
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

const puestosSubidos = movimientos.get(item.id);

if (puestosSubidos) {
    const movimiento = document.createElement("span");
    movimiento.className = "song-movement";

    if (index === 0) {
        movimiento.textContent = `⚡ #1 · ↑ +${puestosSubidos}`;
        movimiento.classList.add("song-movement-first");
        card.classList.add("song-reached-first");
    } else {
        movimiento.textContent = `↑ +${puestosSubidos}`;
    }

    card.appendChild(movimiento);
    card.classList.add("song-moved-up");
}

table.appendChild(card);
    });
}

function moverCola(direccion) {
    const contenedor = document.getElementById("playlist-body");

    if (!contenedor) return;

    const tarjeta = contenedor.querySelector(".song-card");

    if (!tarjeta) return;

    const gap = 10;
    const distancia = tarjeta.offsetWidth + gap;

    contenedor.scrollBy({
        left: direccion * distancia,
        behavior: "smooth"
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
            <strong>${numero}${escaparHTML(item.text)}</strong>
        </div>
    `;
});

        contenedor.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar historial:", error);
    }
}

async function cargarLiveLikes() {

    try {
        const response = await fetch(liveLikesURL);
        const data = await response.json();

        if (!response.ok) return;

        const contenedor = document.getElementById("live-likes");
        const contador = document.getElementById("live-likes-count");
        const barra = document.getElementById("live-likes-progress");
        const mensaje = document.getElementById("live-likes-message");
const rankingList =
    document.getElementById("live-likes-ranking-list");

       if (
    !contenedor ||
    !contador ||
    !barra ||
    !mensaje ||
    !rankingList
) return;

        const goal = Number(data.goal) || 5000;
const progress = Number(data.progress) || 0;
const total = Number(data.total) || 0;
const base = Number(data.base) || 0;
const likesDelLive = Math.max(0, total - base);
const topUsers = Array.isArray(data.top_users)
    ? data.top_users
    : [];

        const porcentaje = Math.min(
            100,
            (progress / goal) * 100
        );

        contador.textContent =
    likesDelLive.toLocaleString("es-CO");

        barra.style.width = `${porcentaje}%`;

if (topUsers.length === 0) {

    rankingList.innerHTML = `
        <div class="live-likes-ranking-empty">
            Todavía no hay ranking.
        </div>
    `;

} else {

    rankingList.innerHTML = topUsers
        .slice(0, 5)
        .map((user, index) => {

            const medallas = ["🥇", "🥈", "🥉"];
            const posicion =
                medallas[index] || `${index + 1}.`;

            return `
                <div class="live-likes-ranking-item">

                    <span class="live-likes-ranking-position">
                        ${posicion}
                    </span>

                    <strong class="live-likes-ranking-user">
                        @${escaparHTML(user.username)}
                    </strong>

                    <span class="live-likes-ranking-count">
                        ${Number(user.likes || 0).toLocaleString("es-CO")} ❤️
                    </span>

                </div>
            `;
        })
        .join("");
}

        if (Number(data.completed_goals) > 0 && progress === 0) {

            contenedor.classList.add("goal-complete");
            barra.style.width = "100%";

            mensaje.textContent = "🔥 META COMPLETADA · CAMBIAMOS DE CANCIÓN";

        } else {

            contenedor.classList.remove("goal-complete");
            mensaje.textContent =
                "CADA 5.000 LIKES CAMBIAMOS DE CANCIÓN";
        }

    } catch (error) {
        console.error("Error cargando likes del LIVE:", error);
    }
}

function toggleTopLikes() {

    const ranking =
        document.getElementById("live-likes-ranking");

    if (!ranking) return;

    topLikesAbierto = !topLikesAbierto;

    ranking.classList.toggle(
        "abierto",
        topLikesAbierto
    );
}

comprobarEstadoLive();
cargarHistorial();
cargarLiveLikes();

setInterval(() => {
    comprobarEstadoLive();
    cargarHistorial();
}, 10000);

setInterval(() => {
    cargarLiveLikes();
}, 2000);

function seleccionarCancion(id, cancion) {

    solicitudSeleccionadaId = id;

    const menu = document.getElementById("song-menu");
    const overlay = document.getElementById("overlay");
    const titulo = document.getElementById("selected-song");
const subtitulo = document.getElementById("menu-subtitle");

titulo.textContent = cancion;
subtitulo.textContent = "¿Qué quieres hacer?";

mostrarOpcionesSubir();

overlay.style.display = "block";
menu.style.display = "block";

}

function cerrarMenu() {

    document.getElementById("overlay").style.display = "none";
    document.getElementById("song-menu").style.display = "none";

}

function abrirSelectorSaltar() {

    if (!colaActual.length) {
        alert("No hay canciones en la cola.");
        return;
    }

    const menu = document.getElementById("song-menu");
    const overlay = document.getElementById("overlay");
    const titulo = document.getElementById("selected-song");
    const subtitulo = document.getElementById("menu-subtitle");
    const contenido = document.getElementById("menu-contenido");

    titulo.textContent = "Saltar fila";
    subtitulo.textContent =
        "Elige qué canción quieres subir al puesto #1.";

    contenido.innerHTML = "";

    const label = document.createElement("div");
    label.className = "free-actions-label";
    label.textContent = "ELIGE UNA CANCIÓN";

    contenido.appendChild(label);

    colaActual.forEach((item, index) => {

        const card = document.createElement("div");
        card.className = "action-card";

        card.addEventListener("click", () => {
            seleccionarParaSaltar(item.id, item.text);
        });

        const left = document.createElement("div");
        left.className = "action-left";

        const icon = document.createElement("span");
        icon.className = "action-icon";
        icon.textContent = `#${index + 1}`;

        const textWrap = document.createElement("div");

        const title = document.createElement("div");
        title.className = "action-title";
        title.textContent = item.text;

        textWrap.appendChild(title);

        left.appendChild(icon);
        left.appendChild(textWrap);

        const right = document.createElement("div");
        right.className = "action-right";

        const price = document.createElement("span");
        price.className = "action-price";
        price.textContent = "$2";

        const arrow = document.createElement("span");
        arrow.className = "action-arrow";
        arrow.textContent = "›";

        right.appendChild(price);
        right.appendChild(arrow);

        card.appendChild(left);
        card.appendChild(right);

        contenido.appendChild(card);
    });

    const cerrar = document.createElement("button");
    cerrar.textContent = "✕ Cerrar";
    cerrar.addEventListener("click", cerrarMenu);

    contenido.appendChild(cerrar);

    overlay.style.display = "block";
    menu.style.display = "block";
}

function seleccionarParaSaltar(id, cancion) {

    solicitudSeleccionadaId = id;

    document.getElementById("selected-song").textContent = cancion;

    mostrarOpcionesSaltar();
}

function mostrarOpcionesSubir() {

    document.getElementById("menu-subtitle").textContent =
    "Elige una forma de subir tu canción.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `

   <div class="action-card pay-action-card" onclick="mostrarOpcionesSaltar()">
    <div class="action-left">
        <span class="action-icon">⚡</span>

        <div>
            <div class="action-title">
                Saltar directo
                <span class="auto-badge">AUTOMÁTICO</span>
            </div>

            <div class="action-description">
                Sube tu canción al puesto #1 de la fila
            </div>
        </div>
    </div>

    <div class="action-right">
        <span class="action-price">$2</span>
        <span class="action-arrow">›</span>
    </div>
</div>

<div class="free-actions-label">
    O SUBE GRATIS
</div>

<div class="action-card" onclick="mostrarPrueba(
    'twitch_follow',
    'Seguir en Twitch',
    '+10',
    'https://www.twitch.tv/duroconbrayan'
)">
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

<div class="action-card" onclick="mostrarPrueba(
    'uraba',
    'Guardar playlist URABÁ',
    '+5',
    'https://open.spotify.com/playlist/5iT5vBLVdo4AOzwEHbmYl0'
)">

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

<div class="action-card" onclick="mostrarPrueba(
    'gafas_club',
    'Guardar playlist GAFAS CLUB',
    '+5',
    'https://open.spotify.com/playlist/1vHnGiv1cbU77FhbQFtO3P'
)">
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

<div class="action-card" onclick="mostrarPrueba(
    'instagram_like',
    'Dar like a la última publicación',
    '+2',
    'https://www.instagram.com/p/DYXjV8YkTiA/'
)">
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


<div class="action-card" onclick="mostrarPrueba(
    'facebook_follow',
    'Seguir en Facebook',
    '+1',
    'https://www.facebook.com/duroconbrayan'
)">
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

<button onclick="cerrarMenu()">✕ Cerrar</button>

`;

}

function mostrarPrueba(action, titulo, recompensa, urlDestino) {

    const contenido = document.getElementById("menu-contenido");

    document.getElementById("menu-subtitle").textContent =
        "Completa el paso y envía tu prueba.";

    contenido.innerHTML = `
        <div class="proof-flow">

            <div class="proof-reward">
                <span class="proof-reward-label">RECOMPENSA</span>
                <strong>${recompensa} PUESTOS</strong>
            </div>

            <div class="proof-step">
                <div class="proof-step-number">1</div>

                <div class="proof-step-content">
                    <strong>Haz el paso</strong>
                    <span>${titulo}</span>
                </div>
            </div>

            <button
                class="proof-action-btn"
                type="button"
                onclick="window.open('${urlDestino}', '_blank')"
            >
                ABRIR Y HACER EL PASO ↗
            </button>


            <div class="proof-step proof-step-upload">
                <div class="proof-step-number">2</div>

                <div class="proof-step-content">
                    <strong>Sube una captura</strong>
                    <span>Necesitamos comprobar que completaste el paso.</span>
                </div>
            </div>

            <label class="proof-dropzone" for="proof-file">
                <div class="proof-camera">📸</div>

                <strong>Seleccionar captura</strong>

                <span id="proof-file-name">
                    JPG, PNG, WEBP y otros formatos
                </span>
            </label>

            <input
                class="proof-file-input"
                type="file"
                id="proof-file"
                accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.heic,.heif,.bmp,.tif,.tiff"
                onchange="mostrarNombrePrueba(this)"
            >


            <div class="proof-step proof-step-send">
                <div class="proof-step-number">3</div>

                <div class="proof-step-content">
                    <strong>Envía la prueba</strong>
                    <span>La revisaremos antes de aplicar la recompensa.</span>
                </div>
            </div>

            <button
    id="proof-submit-btn"
    class="proof-submit-btn"
    type="button"
    onclick="enviarPrueba('${action}')"
>
    ENVIAR PRUEBA
</button>

            <div class="proof-review-note">
                <span>✓</span>
                Cuando sea aprobada, tu canción subirá
                <strong>${recompensa} puestos automáticamente.</strong>
            </div>

            <button
                class="proof-back-btn"
                type="button"
                onclick="mostrarOpcionesSubir()"
            >
                ← Volver a las opciones
            </button>

        </div>
    `;
}

function mostrarNombrePrueba(input) {

    const nombre = document.getElementById("proof-file-name");

    if (!nombre) return;

    if (input.files && input.files[0]) {
        nombre.textContent = "✓ " + input.files[0].name;
        nombre.classList.add("file-selected");
    } else {
        nombre.textContent = "JPG, PNG, WEBP y otros formatos";
        nombre.classList.remove("file-selected");
    }
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

    const submitBtn = document.getElementById("proof-submit-btn");

if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "ENVIANDO...";
}

    const formData = new FormData();

    formData.append("request_id", solicitudSeleccionadaId);
    formData.append("action", action);
    formData.append("visitor_id", visitorId);
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
            if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "ENVIAR PRUEBA";
}
            return;
        }

        const contenido = document.getElementById("menu-contenido");

        contenido.innerHTML = `
            <div class="proof-box">
                <strong>✅ PRUEBA ENVIADA</strong>

                <p class="proof-text">
    Tu captura quedó pendiente de revisión.
    Cuando sea aprobada, tu canción subirá automáticamente.
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

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "ENVIAR PRUEBA";
    }

    alert("Error de conexión al enviar la prueba.");
}
}

function mostrarOpcionesSaltar() {

    document.getElementById("menu-subtitle").textContent =
    "Pasa tu canción automáticamente al puesto #1.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        <p>⚡ Tu canción subirá <strong>automáticamente al puesto #1</strong>.</p>

        <p>Apoya el directo con <strong>$2 USD</strong> por PayPal.</p>

        <button class="pay-btn" onclick="crearOrdenPayPal()">
    💵 PAGAR $2 CON PAYPAL
</button>

        <button onclick="mostrarOpcionesSubir()">⬅️ Volver</button>
    `;

}

async function crearOrdenPayPal() {

    if (!solicitudSeleccionadaId) {
        alert("No se encontró la canción seleccionada.");
        return;
    }

    const boton = document.querySelector(".pay-btn");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "CREANDO PAGO...";
    }

    try {

        const response = await fetch(
            "https://playlist-api.bookingelbrayan.workers.dev/paypal/create-order",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    request_id: solicitudSeleccionadaId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "No se pudo crear el pago.");
            
            if (boton) {
                boton.disabled = false;
                boton.textContent = "💵 PAGAR $2 CON PAYPAL";
            }

            return;
        }

        if (!data.approve_url) {
            alert("PayPal no devolvió el enlace de pago.");

            if (boton) {
                boton.disabled = false;
                boton.textContent = "💵 PAGAR $2 CON PAYPAL";
            }

            return;
        }

        window.location.href = data.approve_url;

    } catch (error) {

        alert("Error de conexión con PayPal.");

        if (boton) {
            boton.disabled = false;
            boton.textContent = "💵 PAGAR $2 CON PAYPAL";
        }
    }
}