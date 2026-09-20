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
let historialCompletoAbierto = false;
let anuncioHistorialMostrado = false;
let stageRequestsAnterior = new Map();
let stageQueueAnterior = new Map();
let stagePrimeraCarga = true;
let stagePlayingId = null;
let stageHistorialDesbloqueado = false;
let stageEventoActivo = false;
let stageEventosPendientes = [];
let stageGoalEventKey = null;
let stageGoalInicializado = false;
let stageCarouselInicializado = false;
let stageAvancesGratis = 0;
let stageAvanceBloqueado = false;
let stageCargaRequestsActiva = false;
let stageCargaLikesActiva = false;
let historialCargaActiva = false;
let stageLiveActivo = false;
let stageRequestsFirma = "";
let stageUltimosDatos = { played: [], playing: null, queue: [] };

// ============ SKINS DURO ============

function aplicarSkin(skin) {

    document.body.classList.remove(
        "skin-duro",
        "skin-ice"
    );

    document.body.classList.add(`skin-${skin}`);

    localStorage.setItem("duro_skin", skin);

    const btnDuro = document.getElementById("skin-duro-btn");
    const btnIce = document.getElementById("skin-ice-btn");

    if (btnDuro && btnIce) {
        btnDuro.classList.toggle("active", skin === "duro");
        btnIce.classList.toggle("active", skin === "ice");
    }
}

function cargarSkinGuardada() {

    const skinGuardada =
        localStorage.getItem("duro_skin") || "duro";

    aplicarSkin(skinGuardada);
}

cargarSkinGuardada();

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

        const response = await fetch(
            `${statusURL}?t=${Date.now()}`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        const data = await response.json();

        const estaEnVivo = data.live === true;

        document.body.classList.toggle(
            "offline",
            !estaEnVivo
        );

        const liveStage = document.querySelector(".live-stage");
        const skipBanner = document.querySelector(".skip-banner");
        const offlineMode = document.getElementById("offline-mode");

        if (!estaEnVivo) {

            /*
             * =====================================================
             * MODO OFFLINE
             * =====================================================
             * Cuando el directo termina NO debemos conservar
             * visualmente ningún dato del directo anterior.
             */

            if (liveStage) {
                liveStage.style.display = "none";
            }

            if (skipBanner) {
                skipBanner.style.display = "none";
            }

            if (offlineMode) {
                offlineMode.style.display = "";
            }

            /*
             * Limpiar completamente el estado visual del LIVE.
             */

            const currentDisplay =
                document.getElementById("stage-current-display");

            const liveList =
                document.getElementById("stage-live-list");

            const liveListItems =
                document.getElementById("stage-live-list-items");

            if (currentDisplay) {
                currentDisplay.innerHTML = "";
            }

            if (liveListItems) {
                liveListItems.innerHTML = "";
            }

            if (liveList) {
                liveList.remove();
            }

            /*
             * Limpiar datos almacenados en memoria.
             */

            colaActual = [];
            posicionesAnteriores.clear();
            stageRequestsAnterior.clear();
            stageQueueAnterior.clear();

            stageUltimosDatos = {
                played: [],
                playing: null,
                queue: []
            };

            stagePlayingId = null;
            stageRequestsFirma = "";

            /*
             * No seguir procesando datos antiguos
             * mientras estamos offline.
             */

            return;

        }

        /*
         * =====================================================
         * MODO LIVE
         * =====================================================
         */

        if (liveStage) {
            liveStage.style.display = "";
        }

        if (skipBanner) {
            skipBanner.style.display = "";
        }

        if (offlineMode) {
            offlineMode.style.display = "none";
        }

    } catch (error) {

        console.error(
            "Error al comprobar estado LIVE:",
            error
        );
    }
}

async function cargarHistorial() {
    if (historialCargaActiva) return;
    historialCargaActiva = true;

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

        if (played.length === 0) {
            contenedor.innerHTML = "";
            return;
        }

       let html = `
    <div
        class="played-history-label"
        onclick="toggleHistorialCompleto()"
        role="button"
        tabindex="0"
    >
        YA SONARON
        <span class="played-history-toggle">
            ${historialCompletoAbierto ? "VER MENOS ↑" : "VER TODAS ↓"}
        </span>
    </div>
`;

const historialVisible =
    historialCompletoAbierto
        ? played
        : played.slice(0, 5);

historialVisible.forEach(item => {

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

function toggleHistorialCompleto() {

    const estabaCerrado = !historialCompletoAbierto;

    historialCompletoAbierto = !historialCompletoAbierto;
    cargarHistorial();

    if (estabaCerrado && !anuncioHistorialMostrado) {
        anuncioHistorialMostrado = true;

        window.open(
            "https://omg10.com/4/11599214",
            "_blank",
            "noopener,noreferrer"
        );
    }
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

// ============ NIVELES VISUALES DEL LIVE ============

document.body.classList.remove(
    "likes-50k",
    "likes-100k",
    "likes-150k",
    "likes-200k"
);

if (likesDelLive >= 200000) {
    document.body.classList.add("likes-200k");
} else if (likesDelLive >= 150000) {
    document.body.classList.add("likes-150k");
} else if (likesDelLive >= 100000) {
    document.body.classList.add("likes-100k");
} else if (likesDelLive >= 50000) {
    document.body.classList.add("likes-50k");
}

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

// ============ POLLING OPTIMIZADO ============

let stageRequestsTimer = null;
let stageLikesTimer = null;
let stageStatusTimer = null;

const STAGE_REQUESTS_INTERVAL = 15000;
const STAGE_LIKES_INTERVAL = 10000;
const STAGE_STATUS_INTERVAL = 50000;

function detenerPollingStage() {

    if (stageRequestsTimer !== null) {
        clearInterval(stageRequestsTimer);
        stageRequestsTimer = null;
    }

    if (stageLikesTimer !== null) {
        clearInterval(stageLikesTimer);
        stageLikesTimer = null;
    }

    if (stageStatusTimer !== null) {
        clearInterval(stageStatusTimer);
        stageStatusTimer = null;
    }
}

function iniciarPollingStage() {

    detenerPollingStage();

    if (document.hidden) {
        return;
    }

    // Comprobar primero si el directo está activo.
    comprobarEstadoLive();

    stageRequestsTimer = setInterval(() => {

        if (document.hidden) return;

        cargarStageHistorial();

    }, STAGE_REQUESTS_INTERVAL);

    stageLikesTimer = setInterval(() => {

        if (document.hidden) return;

        cargarStageLiveLikes();

    }, STAGE_LIKES_INTERVAL);

    stageStatusTimer = setInterval(() => {

        if (document.hidden) return;

        comprobarEstadoLive();

    }, STAGE_STATUS_INTERVAL);

    document.addEventListener("visibilitychange", () => {

        if (document.hidden) {

            detenerPollingStage();

            return;
        }

        iniciarPollingStage();
    });
}

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
    "Elige cómo adelantar tu canción.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `

   <div class="action-card pay-action-card" onclick="mostrarOpcionesSaltar()">
    <div class="action-left">
        <span class="action-icon">⚡</span>

        <div>
            <div class="action-title">
                Adelantar al #1
                <span class="auto-badge">AUTOMÁTICO</span>
            </div>

            <div class="action-description">
                Pasa tu canción directamente al #1
            </div>
        </div>
    </div>

    <div class="action-right">
        <span class="action-price">$2</span>
        <span class="action-arrow">›</span>
    </div>
</div>

<div class="free-actions-label">
    O ADELANTA GRATIS
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
    'artista_destacado',
    'Completa la misión: suscríbete, dale Me gusta y comenta',
    '+15',
    'https://www.youtube.com/watch?v=O3jcOvUVdr8'
)">
    <div class="action-left">
        <span class="action-icon">🔥</span>

        <div>
            <div class="action-title">Misión del artista</div>
            <div class="action-description">
                Suscríbete, dale Me gusta y comenta. Luego envía una captura.
            </div>
        </div>
    </div>

    <div class="action-right">
        <span class="action-reward">+15</span>
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
                <strong>${recompensa} PUESTOS ADELANTE</strong>
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
              Cuando sea aprobada, tu canción se adelantará
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

async function comprimirPruebaImagen(file) {

    if (!file || !file.type.startsWith("image/")) {
        return file;
    }

    try {

        const bitmap = await createImageBitmap(file);

        const MAX_DIMENSION = 2200;

        let width = bitmap.width;
        let height = bitmap.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {

            const escala = Math.min(
                MAX_DIMENSION / width,
                MAX_DIMENSION / height
            );

            width = Math.round(width * escala);
            height = Math.round(height * escala);
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            bitmap.close();
            return file;
        }

        ctx.drawImage(
            bitmap,
            0,
            0,
            width,
            height
        );

        bitmap.close();

        const blob = await new Promise(resolve => {

            canvas.toBlob(
                resolve,
                "image/jpeg",
                0.88
            );

        });

        if (!blob) {
            return file;
        }

        return new File(
            [blob],
            "prueba.jpg",
            {
                type: "image/jpeg",
                lastModified: Date.now()
            }
        );

    } catch (error) {

        console.warn(
            "No se pudo comprimir la captura. Se enviará original:",
            error
        );

        return file;
    }
}


async function enviarPrueba(action) {

    const input = document.getElementById("proof-file");
    const fileOriginal = input?.files?.[0];

    if (!solicitudSeleccionadaId) {
        alert("No se encontró la canción seleccionada.");
        return;
    }

    if (!fileOriginal) {
        alert("Selecciona una captura primero.");
        return;
    }

    const submitBtn = document.getElementById("proof-submit-btn");

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "ENVIANDO...";
    }

    try {

        const file = await comprimirPruebaImagen(fileOriginal);

        const MAX_INTENTOS = 3;
        let ultimoError = null;

        for (let intento = 1; intento <= MAX_INTENTOS; intento++) {

            const formData = new FormData();

            formData.append(
                "request_id",
                solicitudSeleccionadaId
            );

            formData.append(
                "action",
                action
            );

            formData.append(
                "visitor_id",
                visitorId
            );

            formData.append(
                "proof",
                file
            );

            const controller = new AbortController();

            const timeout = setTimeout(
                () => controller.abort(),
                30000
            );

            try {

                const response = await fetch(
                    "https://playlist-api.bookingelbrayan.workers.dev/submit-proof",
                    {
                        method: "POST",
                        body: formData,
                        signal: controller.signal
                    }
                );

                clearTimeout(timeout);

                const textoRespuesta =
                    await response.text();

                let data = {};

                try {
                    data = JSON.parse(
                        textoRespuesta
                    );
                } catch {
                    data = {
                        error:
                            textoRespuesta ||
                            "Respuesta inválida del servidor."
                    };
                }

                /*
                 * Los errores HTTP son respuestas reales
                 * del servidor. NO debemos repetir el envío.
                 */
                if (!response.ok) {

                    console.error(
                        "ERROR HTTP ENVIANDO PRUEBA:",
                        response.status,
                        data
                    );

                    const detalle = data.detail
                        ? `\n\nDetalle: ${data.detail}`
                        : "";

                    alert(
                        `ERROR ${response.status}\n\n` +
                        (
                            data.error ||
                            "No se pudo enviar la prueba."
                        ) +
                        detalle
                    );

                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent =
                            "ENVIAR PRUEBA";
                    }

                    return;
                }

                /*
                 * ÉXITO
                 */
                const contenido =
                    document.getElementById(
                        "menu-contenido"
                    );

                contenido.innerHTML = `
                    <div class="proof-box">
                        <strong>✅ PRUEBA ENVIADA</strong>

                        <p class="proof-text">
                            Tu captura quedó pendiente de revisión.
                            Cuando sea aprobada, tu canción se
                            adelantará automáticamente.
                        </p>

                        <button
                            type="button"
                            onclick="cerrarMenu()"
                        >
                            LISTO
                        </button>
                    </div>
                `;

                return;

            } catch (error) {

                clearTimeout(timeout);

                ultimoError = error;

                console.warn(
                    `Intento ${intento}/${MAX_INTENTOS} falló:`,
                    error
                );

                /*
                 * Solo reintentamos errores reales de red
                 * o timeout.
                 */
                if (intento < MAX_INTENTOS) {

                    const espera =
                        intento === 1
                            ? 1000
                            : 2000;

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                espera
                            )
                    );

                    continue;
                }
            }
        }

        /*
         * Los 3 intentos fallaron.
         */
        console.error(
            "ERROR FINAL ENVIANDO PRUEBA:",
            ultimoError
        );

        alert(
            "No se pudo enviar la prueba después de varios intentos.\n\n" +
            "Revisa tu conexión a Internet e inténtalo nuevamente."
        );

    } catch (error) {

        console.error(
            "ERROR PREPARANDO LA PRUEBA:",
            error
        );

        alert(
            "No se pudo preparar la captura para enviarla.\n\n" +
            (error?.message || error)
        );

    } finally {

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
                "ENVIAR PRUEBA";
        }
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

// ============ ESCENARIO TV / PLAYLIST HORIZONTAL ============

function textoSolicitud(item) {
    return String(item?.raw_comment || item?.text || "Sin comentario").trim();
}

function usuarioSolicitud(item) {
    const username = String(item?.username || "").trim().replace(/^@+/, "");
    return username ? `@${username}` : "";
}

function claveEventoGoal(evento) {
    if (!evento?.occurred_at) return null;
    return `${evento.occurred_at}:${evento.completed_goals || 0}`;
}

function tarjetaStage(item, tipo, posicion) {
    const card = document.createElement("article");

    const presenceStatus =
        tipo === "queue"
            ? (item.presence_status || "inactive")
            : "active";

    card.className =
        `stage-song-card stage-${tipo}-card stage-presence-${presenceStatus}`;

    card.dataset.requestId = String(item.id);
    card.dataset.stageKey = `${tipo}:${item.id}`;
    card.dataset.presenceStatus = presenceStatus;

    const label = document.createElement("span");
    label.className = "stage-card-label";

    if (tipo === "current") {
        label.textContent = "⚡ AHORA SUENA ⚡";

    } else if (tipo === "played") {
        label.textContent = "✓ YA SONÓ";

    } else if (presenceStatus === "active") {
        label.textContent =
            posicion === 0
                ? "🟢 ACTIVA · SIGUIENTE"
                : `🟢 ACTIVA · #${posicion + 1}`;

    } else if (presenceStatus === "expiring") {
        label.textContent =
            posicion === 0
                ? "🟡 POR INACTIVARSE · SIGUIENTE"
                : `🟡 POR INACTIVARSE · #${posicion + 1}`;

    } else {
        label.textContent =
            posicion === 0
                ? "⚫ INACTIVA · SIGUIENTE"
                : `⚫ INACTIVA · #${posicion + 1}`;
    }

    const comment = document.createElement("strong");
    const texto = textoSolicitud(item);

    comment.textContent = texto;
    comment.className = "stage-comment";

    if (texto.length > 90) {
        comment.classList.add("stage-comment-long");
    }

    if (texto.length > 150) {
        comment.classList.add("stage-comment-xlong");
    }

    const user = document.createElement("span");
    user.className = "stage-requester";
    user.textContent = usuarioSolicitud(item);

    card.append(label, comment);

    if (user.textContent) {
        card.appendChild(user);
    }

    if (tipo === "queue") {

        const action = document.createElement("span");
        action.className = "stage-card-action";

        if (presenceStatus === "active") {
            action.textContent = "TAP TAPS ACTIVOS · MANTÉN TU CANCIÓN";

        } else if (presenceStatus === "expiring") {
            action.textContent = "⚠️ HAZ TAP TAPS PARA MANTENERLA";

        } else {
            action.textContent = "TAP TAPS PARA RECUPERAR EL TURNO";
        }

        card.appendChild(action);

        card.tabIndex = 0;
        card.setAttribute("role", "button");

        card.addEventListener(
            "click",
            () => seleccionarCancion(item.id, texto)
        );

        card.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    seleccionarCancion(item.id, texto);
                }
            }
        );
    }

    if (item.tap_exempt_reason === "gafas") {

        card.classList.add("stage-card-gift");

        const badge = document.createElement("span");
        badge.className = "stage-special-badge";
        badge.textContent = "😎 GAFAS";

        card.appendChild(badge);

    } else if (item.tap_exempt_reason === "paypal") {

        card.classList.add("stage-card-paypal");

        const badge = document.createElement("span");
        badge.className = "stage-special-badge";
        badge.textContent = "PAGO ✓";

        card.appendChild(badge);
    }

    return card;
}

function tarjetaBloqueoHistorial(cantidad) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "stage-song-card stage-history-gate";
    card.dataset.stageKey = "history-gate";
    card.innerHTML = `<span class="stage-card-label">← MÁS ANTERIORES</span><strong>DESBLOQUEAR HISTORIAL</strong><span class="stage-requester">${cantidad} canciones · abre un anuncio</span><span class="stage-card-action">VER AHORA</span>`;
    card.addEventListener("click", desbloquearHistorialStage);
    return card;
}

function elementoCentradoStage() {
    const carousel = document.getElementById("stage-carousel");
    if (!carousel) return null;
    const centro = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
    let mejor = null;
    let distancia = Infinity;
    carousel.querySelectorAll("[data-stage-key]").forEach((card) => {
        const rect = card.getBoundingClientRect();
        const actual = Math.abs(rect.left + rect.width / 2 - centro);
        if (actual < distancia) {
            distancia = actual;
            mejor = card.dataset.stageKey;
        }
    });
    return mejor;
}

function centrarStage(key, behavior = "auto") {
    const carousel = document.getElementById("stage-carousel");
    const track = document.getElementById("stage-carousel-track");

    if (!carousel || !track) return;

    const card = Array.from(track.children).find(
        (item) => item.dataset.stageKey === key
    );

    if (!card) return;

    const carouselRect = carousel.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const desplazamiento =
        (cardRect.left + cardRect.width / 2) -
        (carouselRect.left + carouselRect.width / 2);

    const objetivo =
        carousel.scrollLeft + desplazamiento;

    carousel.scrollTo({
        left: Math.max(0, objetivo),
        behavior
    });
}

function renderizarCarruselStage(played, playing, queue) {
    const currentDisplay = document.getElementById("stage-current-display");

    if (!currentDisplay) {
        return;
    }

    const playedOrdenado = [...played].sort(
        (a, b) =>
            new Date(a.played_at || a.created_at) -
            new Date(b.played_at || b.created_at)
    );

    /*
     * AHORA SUENA
     * Se renderiza exclusivamente en su bloque superior.
     */
    currentDisplay.innerHTML = "";

    if (playing) {
        currentDisplay.appendChild(
            tarjetaStage(
                playing,
                "current",
                0
            )
        );
    } else {
        const empty = document.createElement("div");

        empty.className =
            "stage-current-empty";

        empty.innerHTML = `
            <span class="stage-card-label">
                AHORA SUENA
            </span>

            <strong>
                Esperando la primera canción...
            </strong>
        `;

        currentDisplay.appendChild(empty);
    }

    /*
     * LISTA EN VIVO
     * Se crea dinámicamente debajo de TAP TAPS.
     * Así no dependemos del antiguo carrusel.
     */
    let lista = document.getElementById("stage-live-list");

    if (!lista) {
        lista = document.createElement("section");

        lista.id = "stage-live-list";
        lista.className = "stage-live-list";

        lista.innerHTML = `
            <div class="stage-live-list-header">
                <div>
                    <span class="stage-section-label">
                        LISTA EN VIVO
                    </span>

                    <h2>
                        Canciones en espera
                    </h2>
                </div>

                <span
                    id="stage-live-list-count"
                    class="stage-live-list-count"
                >
                    0
                </span>
            </div>

            <div
                id="stage-live-list-items"
                class="stage-live-list-items"
            ></div>
        `;

        const tapPlayer =
            document.querySelector(".tap-player");

        if (tapPlayer) {
            tapPlayer.insertAdjacentElement(
                "afterend",
                lista
            );
        } else {
            currentDisplay
                .closest(".stage-v2")
                ?.appendChild(lista);
        }
    }

    const listaItems =
        document.getElementById(
            "stage-live-list-items"
        );

    const listaCount =
        document.getElementById(
            "stage-live-list-count"
        );

    if (!listaItems) {
        return;
    }

    listaItems.innerHTML = "";

    /*
     * Primero mostramos TODA la cola,
     * en orden vertical.
     */
    queue.forEach((item, index) => {
        listaItems.appendChild(
            tarjetaStage(
                item,
                "queue",
                index
            )
        );
    });

    /*
     * Si no hay canciones esperando,
     * mostramos un estado limpio.
     */
    if (queue.length === 0) {
        const empty = document.createElement("div");

        empty.className =
            "stage-live-list-empty";

        empty.innerHTML = `
            <span>🎵</span>
            <strong>
                La lista está esperando canciones
            </strong>
            <small>
                Agrega una canción desde el directo.
            </small>
        `;

        listaItems.appendChild(empty);
    }

    if (listaCount) {
        listaCount.textContent =
            queue.length.toLocaleString("es-CO");
    }

    /*
     * Guardamos los datos actuales
     * para las demás funciones del sistema.
     */
    colaActual = queue;

    stageUltimosDatos = {
        played,
        playing,
        queue
    };

    stagePlayingId =
        playing?.id || null;
}

function detectarEventosRequests(requests, playing, queue) {
    if (stagePrimeraCarga) return;

    requests.forEach((item) => {
        const anterior = stageRequestsAnterior.get(item.id);
        if (!anterior) {
            if (item.source === "tiktok_gift") {
                encolarEventoStage("gift", "😎", item.status === "playing" ? "ENTRÓ A SONAR" : "ENTRÓ DE SIGUIENTE", textoSolicitud(item), usuarioSolicitud(item));
            } else if (
    item.status === "queue" &&
    item.source === "tiktok_comment"
) {
    encolarEventoStage(
        "added",
        "＋",
        "NUEVO EN LA LISTA",
        textoSolicitud(item),
        usuarioSolicitud(item)
    );
}
        }
    });

    queue.forEach((item, index) => {
        const posicionAnterior = stageQueueAnterior.get(item.id);
        if (posicionAnterior !== undefined && index < posicionAnterior && stagePlayingId === playing?.id) {
            const salto = posicionAnterior - index;
            if (item.tap_exempt_reason === "paypal" && index === 0) {
                encolarEventoStage("paypal", "✓", "PAGO CONFIRMADO · SALTÓ AL #1", textoSolicitud(item), usuarioSolicitud(item));
            } else {
                encolarEventoStage("move", "↑", `ADELANTÓ ${salto} ${salto === 1 ? "PUESTO" : "PUESTOS"}`, textoSolicitud(item), usuarioSolicitud(item));
            }
        }
    });
}

async function cargarStageHistorial() {

    if (!stageLiveActivo) {
        return;
    }

    if (stageCargaRequestsActiva) {
        return;
    }

    stageCargaRequestsActiva = true;
    try {
        const response = await fetch(requestsURL);
        if (!response.ok) return;
        const requests = await response.json();

        if (!stageLiveActivo) {
    return;
}

        const played = requests.filter((item) => item.status === "played");
        const playing = requests.find((item) => item.status === "playing") || null;
        const queue = requests.filter((item) => item.status === "queue").sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        const firma = JSON.stringify(requests.map((item) => [
    item.id,
    item.status,
    item.sort_order,
    item.text,
    item.raw_comment,
    item.username,
    item.tap_exempt_reason,
    item.presence_status,
    item.presence_remaining_seconds
]));

        detectarEventosRequests(requests, playing, queue);
        stageUltimosDatos = { played, playing, queue };
        if (firma !== stageRequestsFirma) {
            renderizarCarruselStage(played, playing, queue);
            stageRequestsFirma = firma;
        }
        stageRequestsAnterior = new Map(requests.map((item) => [item.id, { ...item }]));
        stageQueueAnterior = new Map(queue.map((item, index) => [item.id, index]));
        stagePrimeraCarga = false;
    } catch (error) {
        console.error("Error al cargar la playlist:", error);
    } finally {
        stageCargaRequestsActiva = false;
    }
}

function moverColaStage(direccion) {
    const carousel = document.getElementById("stage-carousel");

    if (!carousel) return;

    if (stageAvanceBloqueado) return;

    if (direccion > 0) {
        if (stageAvancesGratis >= 5) {
            stageAvanceBloqueado = true;

            const anuncio = window.open(
                "https://omg10.com/4/11599214",
                "_blank",
                "noopener,noreferrer"
            );

            if (!anuncio) {
                console.info("El navegador bloqueó la pestaña del anuncio.");
                alert("Activa las ventanas emergentes para continuar.");
                stageAvanceBloqueado = false;
                return;
            }

            stageAvancesGratis = 0;

            setTimeout(() => {
                stageAvanceBloqueado = false;
            }, 1000);

            return;
        }

        stageAvancesGratis++;
    }

    carousel.scrollBy({
        top: direccion * Math.min(
            carousel.clientHeight * 0.78,
            carousel.scrollHeight
        ),
        behavior: "smooth"
    });
}

function desbloquearHistorialStage() {
    if (stageHistorialDesbloqueado) return;
    const anuncio = window.open(
    "https://omg10.com/4/11599214",
    "_blank",
    "noopener,noreferrer"
);

if (!anuncio) {
    console.info("El navegador bloqueó la pestaña del anuncio.");
    alert("Activa las ventanas emergentes para desbloquear el historial.");
    return;
}

stageHistorialDesbloqueado = true;
    renderizarCarruselStage(
        stageUltimosDatos.played,
        stageUltimosDatos.playing,
        stageUltimosDatos.queue
    );
    if (!anuncio) console.info("El navegador bloqueó la pestaña del anuncio.");
}

function encolarEventoStage(tipo, icono, kicker, titulo, usuario = "") {
    stageEventosPendientes.push({ tipo, icono, kicker, titulo, usuario });
    mostrarSiguienteEventoStage();
}

// ============ SONIDOS DE ALERTAS ============

const stageSonidos = {
    added: new Audio("sounds/added.mp3"),
    gift: new Audio("sounds/gafas.mp3"),
    paypal: new Audio("sounds/paypal.mp3"),
    move: new Audio("sounds/move.mp3"),
    goal: new Audio("sounds/goal.mp3")
};

Object.values(stageSonidos).forEach((audio) => {
    audio.preload = "auto";
    audio.volume = 1;
});

function reproducirSonidoStage(tipo) {
    const audio = stageSonidos[tipo];

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    audio.play().catch((error) => {
        console.warn("No se pudo reproducir sonido:", tipo, error);
    });
}

// ============ VOZ ANOTADO ============

function hablarAnotadoStage(comentario) {
    if (!("speechSynthesis" in window)) return;

    const voces = speechSynthesis.getVoices();

    const voz =
        voces.find(v => v.name.includes("Paulina")) ||
        voces.find(v => v.lang === "es-MX") ||
        voces.find(v => v.lang.startsWith("es"));

    const mensaje = new SpeechSynthesisUtterance(
        `${comentario}. Anotado en la lista.`
    );

    if (voz) mensaje.voice = voz;

    mensaje.lang = voz?.lang || "es-MX";
    mensaje.rate = 1.10;
    mensaje.pitch = 0.95;
    mensaje.volume = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(mensaje);
}

function mostrarSiguienteEventoStage() {
    if (stageEventoActivo || stageEventosPendientes.length === 0) return;
    const evento = stageEventosPendientes.shift();
    const overlay = document.getElementById("stage-event");
    if (!overlay) return;
    stageEventoActivo = true;
    overlay.className = `stage-event stage-event-${evento.tipo}`;
    document.getElementById("stage-event-icon").textContent = evento.icono;
    document.getElementById("stage-event-kicker").textContent = evento.kicker;
    document.getElementById("stage-event-title").textContent = evento.titulo;
    document.getElementById("stage-event-user").textContent = evento.usuario;

reproducirSonidoStage(evento.tipo);

if (evento.tipo === "added") {
    setTimeout(() => {
        hablarAnotadoStage(evento.titulo);
    }, 900);
}

requestAnimationFrame(() => overlay.classList.add("show"));
    setTimeout(() => {
        overlay.classList.remove("show");
        setTimeout(() => {
            stageEventoActivo = false;
            mostrarSiguienteEventoStage();
        }, 450);
    }, evento.tipo === "goal" ? 5200 : 3800);
}

function actualizarRankingStage(topUsers) {
    const rankingList = document.getElementById("live-likes-ranking-list");
    if (!rankingList) return;
    if (!topUsers.length) {
        rankingList.innerHTML = '<div class="live-likes-ranking-empty">Todavía no hay ranking.</div>';
        return;
    }
    rankingList.innerHTML = topUsers.slice(0, 5).map((user, index) => `
        <div class="live-likes-ranking-item">
            <span class="live-likes-ranking-position">${["🥇", "🥈", "🥉"][index] || `${index + 1}.`}</span>
            <strong class="live-likes-ranking-user">@${escaparHTML(String(user.username || "").replace(/^@+/, ""))}</strong>
            <span class="live-likes-ranking-count">${Number(user.likes || 0).toLocaleString("es-CO")} ❤️</span>
        </div>`).join("");
}

async function cargarStageLiveLikes() {

    if (!stageLiveActivo) {
        return;
    }

    if (stageCargaLikesActiva) {
        return;
    }

    stageCargaLikesActiva = true;
    try {
        const response = await fetch(liveLikesURL);
        if (!response.ok) return;
        const data = await response.json();

if (!stageLiveActivo) {
    return;
}

        const goal = Number(data.goal) || 5000;
        const progress = Number(data.progress) || 0;
        const total = Number(data.total) || 0;
        const base = Number(data.base) || 0;
        const likesDelLive = Math.max(0, total - base);
        const porcentaje = Math.min(100, progress / goal * 100);

        document.getElementById("live-likes-count").textContent = progress.toLocaleString("es-CO");
        document.getElementById("live-likes-goal").textContent = goal.toLocaleString("es-CO");
        document.getElementById("live-likes-total").textContent = likesDelLive.toLocaleString("es-CO");
        document.getElementById("live-likes-progress").style.width = `${porcentaje}%`;
        document.getElementById("live-likes-message").textContent = `${Math.max(0, goal - progress).toLocaleString("es-CO")} TAP TAPS PARA LA SIGUIENTE`;
        actualizarRankingStage(Array.isArray(data.top_users) ? data.top_users : []);

        document.body.classList.remove("likes-50k", "likes-100k", "likes-150k", "likes-200k");
        if (likesDelLive >= 200000) document.body.classList.add("likes-200k");
        else if (likesDelLive >= 150000) document.body.classList.add("likes-150k");
        else if (likesDelLive >= 100000) document.body.classList.add("likes-100k");
        else if (likesDelLive >= 50000) document.body.classList.add("likes-50k");

        const eventKey = claveEventoGoal(data.last_goal_event);
        if (!stageGoalInicializado) {
            stageGoalEventKey = eventKey;
            stageGoalInicializado = true;
        } else if (eventKey && eventKey !== stageGoalEventKey) {
            const evento = data.last_goal_event;
            if (evento.song_changed) {
                encolarEventoStage("goal", "❤️", "META DE TAP TAPS COMPLETADA", "¡SIGUIENTE CANCIÓN!", "EL LIVE LA DESBLOQUEÓ");
            } else {
                const proteccion = evento.exempt_reason === "gafas" ? "PROTEGIDA POR GAFAS 😎" : "PROTEGIDA POR PAYPAL ✓";
                encolarEventoStage("goal", "🛡️", "META DE TAP TAPS COMPLETADA", "LA CANCIÓN CONTINÚA", proteccion);
            }
            stageGoalEventKey = eventKey;
        }
    } catch (error) {
        console.error("Error cargando Tap Taps:", error);
    } finally {
        stageCargaLikesActiva = false;
    }
}
