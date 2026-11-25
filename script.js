const statusURL = "https://playlist-api.bookingelbrayan.workers.dev/status";
const requestsURL = "https://playlist-api.bookingelbrayan.workers.dev/requests";
const requestsLiveURL =
    "https://playlist-api.bookingelbrayan.workers.dev/requests?live";
const liveLikesURL =
    "https://playlist-api.bookingelbrayan.workers.dev/live-likes";

// =====================================================
// MODO LIVE PRIVADO — ACTUALIZACIÓN RÁPIDA PARA BRAYAN
// =====================================================

const modoLivePrivado =
    new URLSearchParams(window.location.search)
        .has("live");

const liveEventURL =
    "https://playlist-api.bookingelbrayan.workers.dev/admin/live-event";

const LIVE_EVENT_INTERVAL = 1000;

let liveEventTimer = null;
let liveEventAnteriorId = 0;
let liveEventConsultaActiva = false;
let liveEventInicializado = false;
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
let stageLiveEventIds = new Set();
let stagePendingRequestAlerts = new Map();
let stageGoalEventKey = null;
let stageGoalInicializado = false;
let stageCarouselInicializado = false;
let stageAvancesGratis = 0;
let stageAvanceBloqueado = false;
let stageCargaRequestsActiva = false;
let stageCargaLikesActiva = false;
let historialCargaActiva = false;
let stageLiveActivo = false;
let duroOpening = null;
let duroOpeningPhase = null;
let stageRequestsFirma = "";
let stageFiltro = "all";
let stageBusqueda = "";
let stageSessionEpoch = 0;
let stageUltimosDatos = { played: [], playing: null, queue: [] };

// Storage may be blocked by embedded or private browsers. Keep playback UI usable.
function duroStorageGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
function duroStorageSet(key,value) { try { localStorage.setItem(key,value); } catch (_) {} }
// ============ SKINS DURO ============

function aplicarSkin(skin) {

    document.body.classList.remove(
        "skin-duro",
        "skin-ice"
    );

    document.body.classList.add(`skin-${skin}`);

    duroStorageSet("duro_skin", skin);

    const btnDuro = document.getElementById("skin-duro-btn");
    const btnIce = document.getElementById("skin-ice-btn");

    if (btnDuro && btnIce) {
        btnDuro.classList.toggle("active", skin === "duro");
        btnIce.classList.toggle("active", skin === "ice");
    }
}

function cargarSkinGuardada() {

    const skinGuardada =
        duroStorageGet("duro_skin") || "duro";

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
    let visitorId = duroStorageGet("duro_visitor_id");

    if (!visitorId) {
        visitorId = globalThis.crypto?.randomUUID?.() || `duro-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        duroStorageSet("duro_visitor_id", visitorId);
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
            if (data.refunded) {
                alert(data.message || "El pago fue reembolsado. No se aplicó otra prioridad.");
            } else if (data.pending_processing) {
                alert(data.message || "Pago registrado, pendiente de revisión. No vuelvas a pagar.");
                return; // keep token available to check status again
            } else if (data.priority_applied === true || data.moved_to_next === true) {
                alert("✅ Pago confirmado. Tu canción pasó al puesto #1.");
            } else if (data.already_processed) {
                alert("Este pago ya fue registrado. Consulta la posición actual de tu canción; no vuelvas a pagar.");
            } else {
                alert("Pago registrado. Comprueba la posición de tu canción antes de volver a pagar.");
                return;
            }
            const cleanUrl = new URL(window.location.href);
            for (const key of ["paypal","token","PayerID"]) cleanUrl.searchParams.delete(key);
            window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        }

    } catch (error) {
        alert("Error confirmando el pago con PayPal.");
    }
}

procesarRegresoPayPal();

function actualizarAperturaStage(opening) {
    opening = opening || null;
    if (opening && duroOpening?.session_id === opening.session_id && opening.phase < duroOpening.phase) return;
    const mismaSesion = opening && duroOpening?.session_id === opening.session_id;
    if (mismaSesion && duroOpening.phase === 0 && opening.phase >= 1) {
        encolarEventoStage('goal','🔓','LISTA ABIERTA','¡PIDE TU CANCIÓN!','2.000 TAP TAPS');
    }
    if (mismaSesion && duroOpening.phase < 2 && opening.phase === 2) {
        encolarEventoStage('goal','▶','COMIENZAN LAS REACCIONES','¡META ALCANZADA!','5.000 TAP TAPS');
    }
    const cambio = JSON.stringify(duroOpening) !== JSON.stringify(opening);
    duroOpening = opening;
    duroOpeningPhase = opening?.phase ?? null;
    document.body.classList.toggle('duro-opening-closed',opening?.phase === 0);
    if(cambio) {
        stageRequestsFirma='';
        if(stageLiveActivo && opening) cargarStageHistorial();
    }
}

async function comprobarEstadoLive() {
    try {

        const response = await fetch(
            `${statusURL}?t=${Date.now()}`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) throw new Error(`Estado LIVE HTTP ${response.status}`);
        const data = await response.json();
        if (typeof data.live !== "boolean") throw new Error("Estado LIVE inválido");

        const estaEnVivo = data.live === true;
        const cambioSesion = stageLiveActivo && estaEnVivo && duroOpening?.session_id != null && data.opening?.session_id != null && duroOpening.session_id !== data.opening.session_id;
        if (cambioSesion) {
            stageSessionEpoch++;
            colaActual=[]; stageRequestsAnterior.clear(); stageQueueAnterior.clear();
            stageUltimosDatos={played:[],playing:null,queue:[]}; stagePlayingId=null;
            stagePrimeraCarga=true; stageRequestsFirma=''; stageGoalInicializado=false; stageGoalEventKey=null;
            resetStageAlerts(); cerrarMenu();
        }
        actualizarAperturaStage(estaEnVivo ? data.opening : null);

        if (stageLiveActivo !== estaEnVivo) stageSessionEpoch++;
        stageLiveActivo = estaEnVivo;

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
                offlineMode.style.display = "grid";
            }

            detenerPollingDatosStage();

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
            stageFiltro = "all";
            stageBusqueda = "";
            stageHistorialDesbloqueado = false;
            stagePrimeraCarga = true;
            stageAvatarCache.clear();
            stageGoalInicializado = false;
            stageGoalEventKey = null;
            resetStageAlerts();

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

        // =================================================
        // DURO LIVE ACTIVO
        // =================================================
        // La sesión ya está activa aunque TikTok todavía
        // no haya conectado.
        //
        // Por eso la playlist comienza inmediatamente.
        // =================================================

        if (
            stageRequestsTimer === null &&
            stageLikesTimer === null
        ) {
            iniciarPollingDatosStage();
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

    try {

        const contenedor = document.getElementById("played-history");

        if (!contenedor) {
            return;
        }

        const response = await fetch(
    modoLivePrivado
        ? `${requestsLiveURL}&t=${Date.now()}`
        : requestsURL,
    {
        cache: "no-store"
    }
);
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

const freeHint = document.createElement("span");
freeHint.className = "song-free-hint";
freeHint.textContent = "Toca para adelantarla gratis";
card.appendChild(freeHint);

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
    } finally {
        historialCargaActiva = false;
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

const STAGE_REQUESTS_INTERVAL_PUBLIC = 30000;
const STAGE_REQUESTS_INTERVAL_LIVE = 5000;
const STAGE_LIKES_INTERVAL = 20000;
const STAGE_STATUS_INTERVAL = modoLivePrivado ? 5000 : 10000;


// =====================================================
// DETENER SOLO LOS DATOS DEL LIVE
// NO DETIENE LA COMPROBACIÓN DEL ESTADO DEL LIVE
// =====================================================

function detenerPollingDatosStage() {

    if (stageRequestsTimer !== null) {
        clearInterval(stageRequestsTimer);
        stageRequestsTimer = null;
    }

    if (stageLikesTimer !== null) {
        clearInterval(stageLikesTimer);
        stageLikesTimer = null;
    }

    detenerLiveEventPolling();
}


// =====================================================
// DETENER TODO EL SISTEMA LIVE
// =====================================================

function detenerPollingStage() {

    detenerPollingDatosStage();

    if (stageStatusTimer !== null) {
        clearInterval(stageStatusTimer);
        stageStatusTimer = null;
    }
}


// =====================================================
// INICIAR DATOS DE LA PLAYLIST
// =====================================================

async function iniciarPollingDatosStage() {

    if (document.hidden) {
        return;
    }

    if (!stageLiveActivo) {
        return;
    }

    // Evitar duplicar los timers.
    if (
        stageRequestsTimer !== null ||
        stageLikesTimer !== null
    ) {
        return;
    }

    // Cargar inmediatamente.
    await cargarStageHistorial();
    await cargarStageLiveLikes();

    // =================================================
    // MODO LIVE PRIVADO
    // =================================================

    if (modoLivePrivado) {

        await inicializarLiveEvent();

        iniciarLiveEventPolling();
    }

    // =================================================
    // POLLING DE SOLICITUDES
    // =================================================

    const requestsInterval = modoLivePrivado
        ? STAGE_REQUESTS_INTERVAL_LIVE
        : STAGE_REQUESTS_INTERVAL_PUBLIC;

    stageRequestsTimer = setInterval(() => {

        if (document.hidden) return;
        if (!stageLiveActivo) return;

        cargarStageHistorial();

    }, requestsInterval);


    // =================================================
    // POLLING DE TAP TAPS
    // =================================================

stageLikesTimer = setInterval(() => {

    if (document.hidden) return;

    cargarStageLiveLikes();

}, STAGE_LIKES_INTERVAL);
}


// =====================================================
// INICIAR SISTEMA LIVE
// =====================================================

async function iniciarPollingStage() {

    detenerPollingStage();

    if (document.hidden) {
        return;
    }

    // =================================================
    // COMPROBACIÓN INICIAL
    // =================================================

    await comprobarEstadoLive();

    // =================================================
    // IMPORTANTE:
    //
    // SEGUIR COMPROBANDO EL ESTADO AUNQUE ESTÉ OFFLINE.
    //
    // Cuando DURO cambie live=false → true,
    // comprobaremos nuevamente y activaremos la playlist.
    // =================================================

    stageStatusTimer = setInterval(() => {

        if (document.hidden) {
            return;
        }

        comprobarEstadoLive();

    }, STAGE_STATUS_INTERVAL);

    // Si ya estaba activo al cargar la página,
    // iniciar inmediatamente los datos.
    if (stageLiveActivo) {

        await iniciarPollingDatosStage();

    }
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
    if(brebTimer!==null){clearInterval(brebTimer);brebTimer=null;}
    brebVerifiedAt=0;brebReaderReady=false;

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
        icon.textContent = `#${String(Math.max(0, Number(stageUltimosDatos.playing?.play_number)||0, ...stageUltimosDatos.played.map(x=>Number(x.play_number)||0)) + index + 1).padStart(3,"0")}`;

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
        price.textContent = "Elegir pago";

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

let estadosMisiones = {};
let cargaEstadosMisionesActiva = false;

const MISIONES_GRATUITAS_REQUERIDAS = [
    "twitch_follow",
    "uraba",
    "artista_angelito",
    "artista_jlopez",
    "gafas_club",
    "instagram_like",
    "instagram_follow",
    "facebook_follow"
];

function contarMisionesCompletadas() {
    return MISIONES_GRATUITAS_REQUERIDAS.filter(
        action => estadosMisiones[action] === "completed"
    ).length;
}

function construirIndicadorProgreso() {
    const completadas = contarMisionesCompletadas();
    const total = MISIONES_GRATUITAS_REQUERIDAS.length;
    return `
        <div class="mission-progress">
            <div class="mission-progress-top">
                <span>🚀 PASOS GRATIS</span>
                <strong>${completadas}/${total}</strong>
            </div>
            <div class="mission-progress-track">
                <span style="width:${Math.round((completadas / total) * 100)}%"></span>
            </div>
            <div class="mission-progress-message">
                ${completadas === 0
                    ? "Completa los pasos y adelanta tu canción gratis."
                    : `Te faltan ${total - completadas} pasos gratis.`}
            </div>
        </div>
    `;
}

async function cargarEstadosMisiones() {

    if (cargaEstadosMisionesActiva) return;

    cargaEstadosMisionesActiva = true;

    try {

        const response = await fetch(
            `https://playlist-api.bookingelbrayan.workers.dev/mission-status?visitor_id=${encodeURIComponent(visitorId)}`,
            { method: "GET" }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        estadosMisiones = data.missions || {};

        document
            .querySelectorAll("[data-mission-action]")
            .forEach(card => {

                const action = card.dataset.missionAction;
                const estado = estadosMisiones[action] || "available";
                const reward = card.querySelector(".action-reward");
                const arrow = card.querySelector(".action-arrow");

                card.classList.remove(
                    "mission-pending",
                    "mission-completed"
                );

                card.style.pointerEvents = "";

                if (estado === "completed") {

                    card.classList.add("mission-completed");
                    card.style.pointerEvents = "none";

                    if (reward) reward.textContent = "✓ COMPLETADO";
                    if (arrow) arrow.textContent = "✓";

                } else if (estado === "pending") {

                    card.classList.add("mission-pending");
                    card.style.pointerEvents = "none";

                    if (reward) reward.textContent = "EN REVISIÓN";
                    if (arrow) arrow.textContent = "…";

                }
            });

    } catch (error) {

        console.warn(
            "No se pudieron cargar los estados de las misiones:",
            error
        );

    } finally {
        cargaEstadosMisionesActiva = false;
    }
}

function mostrarOpcionesSubir() {

    const completadas = contarMisionesCompletadas();
    const total = MISIONES_GRATUITAS_REQUERIDAS.length;
    document.getElementById("menu-subtitle").textContent =
        completadas === total
            ? "Ya completaste los pasos gratis. Puedes seguir usando las acciones disponibles."
            : "Toca los pasos gratis para adelantar tu canción.";

    const contenido = document.getElementById("menu-contenido");

    contenido.innerHTML = `
        ${construirIndicadorProgreso()}

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
                <span class="action-price">Ver opciones</span>
                <span class="action-arrow">›</span>
            </div>
        </div>

        <div class="free-actions-label">
            ${completadas === total ? "PASOS GRATIS COMPLETADOS" : "ADELANTA GRATIS"}
        </div>

        <div class="action-card" data-mission-action="twitch_follow" onclick="mostrarPrueba('twitch_follow','Seguir en Twitch','+10','https://www.twitch.tv/duroconbrayan')">
            <div class="action-left"><span class="action-icon">🟣</span><div><div class="action-title">Seguir en Twitch</div></div></div>
            <div class="action-right"><span class="action-reward">+10</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="uraba" onclick="mostrarPrueba('uraba','Guardar playlist URABÁ','+5','https://open.spotify.com/playlist/5iT5vBLVdo4AOzwEHbmYl0')">
            <div class="action-left"><span class="action-icon">🌴</span><div><div class="action-title">Guardar playlist URABÁ</div></div></div>
            <div class="action-right"><span class="action-reward">+5</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="artista_angelito" onclick="mostrarPrueba('artista_angelito','Suscríbete, dale Me gusta y comenta en el video de Angelito','+15','https://www.youtube.com/watch?v=O3jcOvUVdr8')">
            <div class="action-left"><span class="action-icon">🔥</span><div><div class="action-title">Misión del artista — Angelito</div><div class="action-description">Suscríbete, dale Me gusta y comenta. Luego envía una captura.</div></div></div>
            <div class="action-right"><span class="action-reward">+15</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="artista_jlopez" onclick="mostrarPrueba('artista_jlopez','Suscríbete, dale Me gusta y comenta en el video de J López','+15','https://www.youtube.com/watch?v=Hmuqjha1uUk')">
            <div class="action-left"><span class="action-icon">🎤</span><div><div class="action-title">Misión del artista — J López</div><div class="action-description">Mira el video, suscríbete, dale Me gusta y comenta. Luego envía una captura.</div></div></div>
            <div class="action-right"><span class="action-reward">+15</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="gafas_club" onclick="mostrarPrueba('gafas_club','Guardar playlist GAFAS CLUB','+5','https://open.spotify.com/playlist/1vHnGiv1cbU77FhbQFtO3P')">
            <div class="action-left"><span class="action-icon">🎵</span><div><div class="action-title">Guardar playlist GAFAS CLUB</div></div></div>
            <div class="action-right"><span class="action-reward">+5</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="instagram_like" onclick="mostrarPrueba('instagram_like','Dar like a la última publicación','+2','https://www.instagram.com/p/DYXjV8YkTiA/')">
            <div class="action-left"><span class="action-icon">❤️</span><div><div class="action-title">Dar like a la última publicación</div></div></div>
            <div class="action-right"><span class="action-reward">+2</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="instagram_follow" onclick="mostrarPrueba('instagram_follow','Seguir en Instagram','+1','https://instagram.com/brayan_trampa')">
            <div class="action-left"><span class="action-icon">📸</span><div><div class="action-title">Seguir en Instagram</div></div></div>
            <div class="action-right"><span class="action-reward">+1</span><span class="action-arrow">›</span></div>
        </div>

        <div class="action-card" data-mission-action="facebook_follow" onclick="mostrarPrueba('facebook_follow','Seguir en Facebook','+1','https://www.facebook.com/duroconbrayan')">
            <div class="action-left"><span class="action-icon">👍</span><div><div class="action-title">Seguir en Facebook</div></div></div>
            <div class="action-right"><span class="action-reward">+1</span><span class="action-arrow">›</span></div>
        </div>

        <button onclick="cerrarMenu()">✕ Cerrar</button>
    `;

    cargarEstadosMisiones();
}

function mostrarPrueba(action, titulo, recompensa, urlDestino) {

    if (estadosMisiones[action] === "completed") {
        alert("✓ Ya completaste esta misión.");
        return;
    }

    if (estadosMisiones[action] === "pending") {
        alert("Tu prueba de esta misión ya está en revisión.");
        return;
    }

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

// DURO PAY: public checkout; the Worker is the sole payment authority.
const brebBase = new URL(requestsURL).origin;
let brebOrder = null, brebBusy = false, brebTimer = null, brebChecking = false;
let brebAvailable = false;
let brebVerifiedOrderId = null, brebVerifiedAt = 0, brebReaderReady = false;
try { const saved = JSON.parse(sessionStorage.getItem('duro_breb_order') || 'null'); if(saved && typeof saved.order_id === 'string' && Number.isFinite(saved.expires_at)) brebOrder=saved; } catch (_) {}
function brebSave(order) { if (brebOrder?.order_id !== order?.order_id) { brebVerifiedOrderId=null; brebVerifiedAt=0; brebReaderReady=false; } brebOrder=order; try { if(order) sessionStorage.setItem('duro_breb_order',JSON.stringify(order)); else sessionStorage.removeItem('duro_breb_order'); } catch (_) {} }
async function brebAvailability() {
    try { const r=await fetch(brebBase+'/breb/availability',{cache:'no-store'}); const d=await r.json(); brebAvailable=r.ok && d.available===true; } catch (_) {brebAvailable=false;}
    const btn=document.getElementById('breb-choice');
    if(btn){btn.disabled=!brebAvailable||brebBusy;btn.textContent=brebAvailable?'Bre-B · $8.000 COP':'Bre-B · no disponible ahora';}
    return brebAvailable;
}
function mostrarOpcionesSaltar() {
    const target=colaActual.find(x=>Number(x.id)===Number(solicitudSeleccionadaId));
    if (target?.tap_exempt_reason) {
        document.getElementById('menu-subtitle').textContent='Tu canción ya tiene prioridad. No necesitas volver a pagar.';
        document.getElementById('menu-contenido').innerHTML=`<div class="duro-payment-options"><button id="breb-resume" hidden onclick="brebShowOrder()">Consultar mi orden Bre-B</button><button onclick="mostrarOpcionesSubir()">← Volver</button></div>`;
        document.getElementById('breb-resume').hidden=!brebOrder;
        return;
    }
    document.getElementById('menu-subtitle').textContent='Elige cómo subir tu canción al primer puesto pendiente.';
    const contenido=document.getElementById('menu-contenido');
    contenido.innerHTML=`<div class="duro-payment-options">
        <button class="pay-btn" onclick="crearOrdenPayPal()">PAGAR $2 USD CON PAYPAL</button>
        <button id="breb-choice" disabled onclick="brebForm()">Bre-B · comprobando disponibilidad…</button>
        <button id="breb-resume" hidden onclick="brebShowOrder()">Consultar mi orden Bre-B</button>
        <button onclick="mostrarOpcionesSubir()">← Volver</button></div>`;
    document.getElementById('breb-resume').hidden=!brebOrder;
    brebAvailability();
}
function brebForm(){
    if(brebOrder && ['pending','expired'].includes(brebOrder.state) && (brebOrder.expires_at>=Date.now()/1000 || brebOrder.state==='pending')) {brebShowOrder();return;}
    const target=colaActual.find(x=>Number(x.id)===Number(solicitudSeleccionadaId));
    if(!target){alert('La canción ya no está pendiente.');return;}
    const content=document.getElementById('menu-contenido');
    content.innerHTML=`<form id="breb-form" class="breb-checkout"><label for="breb-name">Nombre del titular de la cuenta que enviará el dinero</label><input id="breb-name" maxlength="200" minlength="3" required autocomplete="name" placeholder="Nombre y apellido"><p>Importe exacto: <strong>$8.000 COP</strong>. Usa el nombre de quien hará la transferencia.</p><button type="submit" class="breb-primary">GENERAR ORDEN Y MOSTRAR QR</button><p id="breb-error" role="status"></p><button type="button" onclick="mostrarOpcionesSaltar()">← Volver</button></form>`;
    document.getElementById('breb-form').addEventListener('submit',e=>{e.preventDefault();brebCreate(target,e.currentTarget);});
}
async function brebPost(path,body){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(brebBase+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Servicio no disponible');return d;}finally{clearTimeout(timer);}}
async function brebCreate(target,form){
    if(brebBusy)return; const name=form.querySelector('input').value.trim(); if(!name)return;
    brebBusy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
    try {const d=await brebPost('/breb/create-order',{request_id:Number(target.id),sender_name:name});
        if(!d.order_id||d.amount_minor!==800000||!Number.isFinite(Number(d.expires_at)))throw Error('Respuesta de pago inesperada');
        brebSave({order_id:d.order_id,expires_at:Number(d.expires_at),state:'pending',song:textoSolicitud(target),request_id:Number(target.id)});
        if(document.getElementById('breb-form')===form)brebShowOrder();else alert('Orden Bre-B creada. Vuelve al menú de pagos para consultarla.');
    }catch(e){const msg=form.querySelector('#breb-error');if(msg)msg.textContent=e.message+'; si no recibiste el QR, no transfieras dinero.';}
    finally{brebBusy=false;button.disabled=false;}
}
function brebShowOrder(){
    if(!brebOrder)return;brebVerifiedAt=0;brebReaderReady=false;const content=document.getElementById('menu-contenido');
    document.getElementById('selected-song').textContent=brebOrder.song||'Tu canción';
    document.getElementById('menu-subtitle').textContent='Orden Bre-B · $8.000 COP';
    content.innerHTML=`<section class="breb-checkout"><div id="breb-status" role="status" aria-live="polite">Consultando orden…</div><div id="breb-payment" hidden><strong id="breb-clock" class="breb-clock"></strong><p>Escanea el QR desde tu banco o copia la llave.</p><img src="breb-nu.png" class="breb-qr" alt="QR original de Nu para pago Bre-B"><a href="breb-nu.png" download="QR-DURO-BreB.png">Guardar QR</a><button type="button" id="breb-copy" onclick="brebCopy()">Copiar llave @WOJ271</button><p>Envía exactamente $8.000 COP. Si ya pagaste, no vuelvas a transferir.</p></div><button onclick="brebPoll()">Consultar estado</button><button id="breb-new" hidden onclick="brebSave(null);mostrarOpcionesSaltar()">Volver a métodos de pago</button><button onclick="cerrarMenu()">Cerrar</button></section>`;
    brebPaint();brebPoll();if(brebTimer===null)brebTimer=setInterval(()=>{brebPaint();if(++brebTicks%5===0)brebPoll();},1000);
}
let brebTicks=0;
function brebPaint(){
    if(!brebOrder)return;const el=document.getElementById('breb-status');if(!el)return;
    const left=Math.max(0,Math.floor(brebOrder.expires_at-Date.now()/1000));const pay=document.getElementById('breb-payment');const clock=document.getElementById('breb-clock');const next=document.getElementById('breb-new');
    const eligible=brebOrder.state==='pending'&&left>0&&stageLiveActivo&&!brebOrder.song_playing;
    const verified=brebVerifiedOrderId===brebOrder.order_id&&Date.now()-brebVerifiedAt<10000&&brebReaderReady;
    const active=eligible&&verified;
    pay.hidden=!active;clock.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    next.hidden=!['matched','cancelled','expired'].includes(brebOrder.state);
    el.textContent=brebOrder.state==='matched'?'Pago confirmado. Tu canción tiene prioridad o protección si ya está sonando.':brebOrder.state==='cancelled'?'Orden cancelada. Si pagaste, contacta al anfitrión.':brebOrder.gift_conflict?'Tu canción recibió Gafas. No transfieras. Si ya pagaste, contacta al anfitrión para revisar el pago.':brebOrder.state==='pending'&&brebOrder.song_playing?'Tu canción ya está sonando. No transfieras ahora; si ya pagaste, espera la confirmación.':eligible&&!verified?'Lector desconectado o estado sin verificar. No transfieras. Si ya pagaste, espera confirmación.':!active?'Orden vencida o directo cerrado. Si ya pagaste, no repitas el pago; consulta al anfitrión.':'Esperando confirmación de Nu. Si el nombre no coincide, el anfitrión podrá revisar el pago.';
}
async function brebPoll(){
    if(!brebOrder||brebChecking||!document.getElementById('breb-status'))return;brebChecking=true;const id=brebOrder.order_id;const checkedAt=Date.now();
    try{const d=await brebPost('/breb/order-status',{order_id:id});if(brebOrder?.order_id!==id)return;if(['pending','matched','expired','cancelled'].includes(d.state)){const previous=brebOrder.state;brebSave({...brebOrder,state:d.state,song_playing:d.song_playing===true,gift_conflict:d.gift_conflict===true});brebVerifiedOrderId=id;brebVerifiedAt=checkedAt;brebReaderReady=d.payment_allowed===true;brebPaint();if(d.state==='matched'&&previous!=='matched')cargarStageHistorial();}}
    catch(_){if(brebOrder?.order_id===id){brebVerifiedAt=0;brebReaderReady=false;brebPaint();}}
    finally{brebChecking=false;}
}
async function brebCopy(){if(!brebOrder||brebVerifiedOrderId!==brebOrder.order_id||Date.now()-brebVerifiedAt>=10000||!brebReaderReady||!stageLiveActivo||brebOrder.state!=='pending'||brebOrder.expires_at<=Date.now()/1000||brebOrder.song_playing)return;const btn=document.getElementById('breb-copy');try{await navigator.clipboard.writeText('@WOJ271');if(btn)btn.textContent='Llave copiada';}catch(_){if(btn)btn.textContent='Copia manualmente: @WOJ271';}}

async function crearOrdenPayPal() {

    if (!solicitudSeleccionadaId) {
        alert("No se encontró la canción seleccionada.");
        return;
    }

    const pagoId=solicitudSeleccionadaId;
    const pagoEpoch=stageSessionEpoch;
    if (!stageLiveActivo || colaActual.find(x=>Number(x.id)===Number(pagoId))?.tap_exempt_reason) {
        alert("Esta canción ya tiene prioridad o el directo terminó. No vuelvas a pagar.");
        return;
    }
    const boton = document.querySelector(".pay-btn");
    if (boton?.disabled) return;

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
                    request_id: pagoId
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

        if (!stageLiveActivo || pagoEpoch!==stageSessionEpoch || pagoId!==solicitudSeleccionadaId || !boton?.isConnected) return;
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

const stageAvatarCache = new Map();
function stageAvatar(item) {
    const username = String(item.username || "").trim().replace(/^@+/, "");
    const wrap = document.createElement("span");
    wrap.className = "stage-user-avatar";
    wrap.textContent = username.slice(0, 2).toUpperCase() || "?";
    const url = item.avatar_url || stageAvatarCache.get(username.toLowerCase());
    if (typeof url === "string" && /^https:\/\//i.test(url)) {
        const img = document.createElement("img");
        img.src = url; img.alt = ""; img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => img.remove());
        wrap.appendChild(img);
    }
    return wrap;
}
function tarjetaStage(item, tipo, posicion, turno, esSiguiente = false) {
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
        label.textContent = item.play_number ? `CANCIÓN #${String(item.play_number).padStart(3, "0")}` : "CANCIÓN EN CURSO";

    } else if (tipo === "played") {
        label.textContent = "✓ ESCUCHADA";
    } else if (presenceStatus === "active") {
        label.textContent = esSiguiente ? "ACTIVA · SIGUIENTE" : "ACTIVA";
    } else if (presenceStatus === "expiring") {
        label.textContent = esSiguiente ? "POR INACTIVARSE · SIGUIENTE" : "POR INACTIVARSE";
    } else {
        label.textContent = "INACTIVA";
    }

    if (tipo !== "current") {
        const positionBadge = document.createElement("span");
        positionBadge.className = "stage-position-badge";
        positionBadge.textContent = Number.isInteger(turno) && turno > 0 ? `#${String(turno).padStart(3, "0")}` : "—";
        positionBadge.title = tipo === "queue" ? "Turno provisional" : "Turno escuchado";
        card.appendChild(positionBadge);
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
        if (tipo === "current") {
            const profile = document.createElement("div");
            profile.className = "stage-current-profile";
            profile.append(stageAvatar(item), user);
            card.appendChild(profile);
        } else card.appendChild(user);
    }

    if (tipo === "queue") {

        const action = document.createElement("span");
        action.className = "stage-card-action";

        const remaining = Number(item.presence_remaining_seconds || 0);
        const minutos = Math.floor(remaining / 60);
        const segundos = String(Math.max(0, remaining % 60)).padStart(2, "0");

        if (presenceStatus === "active") {
            action.textContent = "● ACTIVA · TAP TAPS MANTIENEN TU TURNO";

        } else if (presenceStatus === "expiring") {
            action.textContent = `⚠ POR INACTIVARSE · ${minutos}:${segundos} RESTANTES`;

        } else {
            action.textContent = "○ INACTIVA · DA TAP TAPS PARA REACTIVAR";
        }

        const freeHint = document.createElement("span");
        freeHint.className = "stage-free-hint";
        freeHint.textContent = "TOCA PARA VER CÓMO SUBIRLA";

        action.appendChild(document.createElement("br"));
        action.appendChild(freeHint);
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

    if (tipo === "played" && item.rating !== null && item.rating !== undefined && Number.isFinite(Number(item.rating)) && Number(item.rating) >= 1 && Number(item.rating) <= 10) {
        const nota = document.createElement("span");
        const valor = Number(item.rating);
        nota.className = "stage-final-rating " + (valor >= 8 ? "rating-high" : valor >= 5 ? "rating-mid" : "rating-low");
        nota.textContent = `${valor.toFixed(1)}/10`;
        nota.setAttribute("aria-label", `Calificación final ${valor.toFixed(1)} de 10`);
        card.appendChild(nota);
    }

    if (item.tap_exempt_reason === "gafas") {

        card.classList.add("stage-card-gift");

        const badge = document.createElement("span");
        badge.className = "stage-special-badge";
        badge.textContent = "😎 GAFAS · PROTEGIDA";

        card.appendChild(badge);

    } else if (["paypal", "breb"].includes(item.tap_exempt_reason)) {

        card.classList.add("stage-card-paypal");

        const badge = document.createElement("span");
        badge.className = "stage-special-badge";
        badge.textContent = item.tap_exempt_reason === "breb" ? "BRE-B · PROTEGIDA" : "PAYPAL · PROTEGIDA";

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

    if (duroOpening && duroOpening.phase < 2) {
        const card=document.createElement('div');card.className='stage-current-empty';
        card.innerHTML='<span class="stage-card-label">#000 · APERTURA</span><strong>'+escaparHTML(duroOpening.title)+'</strong><span class="stage-requester">'+(duroOpening.phase===0?'LISTA CERRADA · 2.000 TAP TAPS':'REACCIONES A LOS 5.000 TAP TAPS')+'</span>';
        currentDisplay.appendChild(card);
    } else if (playing) {
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
                        Canciones del directo
                    </h2>

                    <div class="stage-queue-legend" aria-label="Estados de la cola">
                        <span><i class="legend-dot legend-active"></i> ACTIVAS AVANZAN</span>
                        <span><i class="legend-dot legend-expiring"></i> POR INACTIVARSE</span>
                        <span><i class="legend-dot legend-inactive"></i> INACTIVAS · NO CUENTAN</span>
                    </div>
                </div>

                <div class="stage-live-list-meta">
                    <span id="stage-live-active-count" class="stage-live-active-count">0 ACTIVAS</span>
                    <span id="stage-live-list-count" class="stage-live-list-count">0</span>
                </div>
            </div>

            <div class="stage-list-tools">
                <label class="stage-search-label" for="stage-search">Buscar canción o usuario</label>
                <input id="stage-search" type="search" placeholder="Canción, artista o @usuario" autocomplete="off">
                <div class="stage-filter-row" role="group" aria-label="Filtrar canciones">
                    <button type="button" data-stage-filter="all" aria-pressed="true">Todas <span></span></button>
                    <button type="button" data-stage-filter="active" aria-pressed="false">Activas <span></span></button>
                    <button type="button" data-stage-filter="inactive" aria-pressed="false">Inactivas <span></span></button>
                    <button type="button" data-stage-filter="played" aria-pressed="false">Escuchadas <span></span></button>
                </div>
                <p id="stage-filter-summary" class="stage-filter-summary" aria-live="polite"></p>
            </div>
            <div
                id="stage-live-list-items"
                class="stage-live-list-items"
            ></div>
        `;

        lista.querySelector("#stage-search").value = stageBusqueda;
        lista.querySelector("#stage-search").addEventListener("input", (event) => {
            stageBusqueda = event.target.value;
            renderizarListaFiltradaStage();
        });
        lista.querySelectorAll("[data-stage-filter]").forEach(button => button.addEventListener("click", () => {
            stageFiltro = button.dataset.stageFilter;
            renderizarListaFiltradaStage();
        }));

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

    colaActual = queue;
    stageUltimosDatos = { played, playing, queue };
    stagePlayingId = playing?.id || null;
    renderizarListaFiltradaStage();
}

function normalizarBusquedaStage(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function datosFiltradosStage(played, playing, queue, filtro, busqueda) {
    const ordenada = [...queue].sort((a,b) => Number(a.sort_order)-Number(b.sort_order) || Number(a.id)-Number(b.id));
    const activas = item => ["active", "expiring"].includes(item.presence_status);
    const base = Math.max(0, Number(playing?.play_number)||0, ...played.map(item => Number(item.play_number)||0));
    const siguiente = ordenada.find(activas)?.id;
    const pendientes = ordenada.map((item,index) => ({item, tipo:"queue", posicion:index, turno:base+index+1, siguiente:item.id===siguiente}));
    const escuchadas = [...played].sort((a,b) => Number(b.play_number||0)-Number(a.play_number||0) || Number(b.id)-Number(a.id)).map(item => ({item,tipo:"played",posicion:0,turno:Number(item.play_number)||null,siguiente:false}));
    const counts = {all:pendientes.length+escuchadas.length,active:ordenada.filter(activas).length,inactive:ordenada.filter(item=>!activas(item)).length,played:escuchadas.length};
    const filas = [...pendientes,...escuchadas].filter(row => {
        if (filtro === "played" && row.tipo !== "played") return false;
        if (filtro === "active" && (row.tipo !== "queue" || !activas(row.item))) return false;
        if (filtro === "inactive" && (row.tipo !== "queue" || activas(row.item))) return false;
        const texto = normalizarBusquedaStage([row.item.text,row.item.raw_comment,row.item.username,usuarioSolicitud(row.item),row.turno ? `#${String(row.turno).padStart(3,"0")} #${row.turno}` : ""].join(" "));
        return normalizarBusquedaStage(busqueda).split(/\s+/).filter(Boolean).every(palabra => texto.includes(palabra));
    });
    return {filas,counts};
}

function renderizarListaFiltradaStage() {
    const lista = document.getElementById("stage-live-list-items");
    if (!lista || !stageLiveActivo) return;
    const {played,playing,queue} = stageUltimosDatos;
    const {filas,counts} = datosFiltradosStage(played,playing,queue,stageFiltro,stageBusqueda);
    document.getElementById("stage-live-active-count").textContent = `${counts.active} ACTIVAS`;
    document.getElementById("stage-live-list-count").textContent = String(queue.length);
    document.querySelectorAll("[data-stage-filter]").forEach(button => {
        button.setAttribute("aria-pressed",String(button.dataset.stageFilter===stageFiltro));
        button.querySelector("span").textContent = counts[button.dataset.stageFilter];
    });
    document.getElementById("stage-filter-summary").textContent = `${filas.length} canciones · Turnos pendientes provisionales`;
    const fragment = document.createDocumentFragment();
    for (const row of filas) fragment.appendChild(tarjetaStage(row.item,row.tipo,row.posicion,row.turno,row.siguiente));
    if (!filas.length) {
        const empty = document.createElement("div");
        empty.className = "stage-live-list-empty";
        empty.textContent = stageBusqueda.trim() ? "No encontramos canciones con esa búsqueda." : "No hay canciones en esta categoría.";
        fragment.appendChild(empty);
    }
    lista.replaceChildren(fragment);
}

function detectarEventosRequests(requests, playing, queue) {
    if (stagePrimeraCarga) return;
    const pagosNuevos = new Set();
    for (const item of requests) {
        const previo = stageRequestsAnterior.get(item.id);
        const method = item.tap_exempt_reason;
        if (previo && ['paypal','breb'].includes(method) && previo.tap_exempt_reason !== method) {
            pagosNuevos.add(item.id);
            const breb = method === 'breb';
            encolarEventoStage(method, breb ? 'NU' : 'P', breb ? 'PAGO BRE-B CONFIRMADO · $8.000 COP' : 'PAGO PAYPAL CONFIRMADO · $2 USD', textoSolicitud(item), usuarioSolicitud(item));
        }
        const nota = Number(item.rating);
        if (item.status === 'played' && item.rating != null && nota >= 1 && nota <= 10 && (!previo || previo.status !== 'played' || previo.rating == null)) {
            encolarEventoStage(nota >= 9 ? 'rating-epic' : nota >= 7 ? 'rating-high' : nota >= 5 ? 'rating-mid' : 'rating-low', nota.toFixed(1) + ' / 10', 'CALIFICACIÓN FINAL', textoSolicitud(item), usuarioSolicitud(item));
        }
    }
    if (playing && playing.id !== stagePlayingId) {
        encolarEventoStage('next', '▶▶', 'SIGUIENTE CANCIÓN', String(playing.text || playing.raw_comment || '').trim(), usuarioSolicitud(playing));
    }
    requests.forEach((item) => {
        const anterior = stageRequestsAnterior.get(item.id);
        if (!anterior) {
            if (item.source === "tiktok_gift") {
                encolarEventoStage("gift", "😎", item.status === "playing" ? "ENTRÓ A SONAR" : "ENTRÓ DE SIGUIENTE", textoSolicitud(item), usuarioSolicitud(item));
            } else if (
                item.status === "queue" &&
                item.source === "tiktok_comment"
            ) {
                const requestId = String(item.id);

                // /admin/live-event es la vía rápida.
                // Si ya anunció esta solicitud, /requests no debe repetirla.
                if (stageLiveEventIds.has(requestId)) {
                    return;
                }

                // Esperamos un instante para darle prioridad al evento rápido.
                // Así evitamos duplicados aunque /requests responda primero.
                if (!stagePendingRequestAlerts.has(requestId)) {
                    const timer = setTimeout(() => {
                        stagePendingRequestAlerts.delete(requestId);

                        if (stageLiveEventIds.has(requestId)) {
                            return;
                        }

                        encolarEventoStage(
                            "added",
                            "＋",
                            "NUEVO EN LA LISTA",
                            textoSolicitud(item),
                            usuarioSolicitud(item)
                        );
                    }, 1500);

                    stagePendingRequestAlerts.set(requestId, timer);
                }
}
        }
    });

    queue.forEach((item, index) => {
        if (pagosNuevos.has(item.id)) return;
        const posicionAnterior = stageQueueAnterior.get(item.id);
        if (posicionAnterior !== undefined && index < posicionAnterior && stagePlayingId === playing?.id) {
            const salto = posicionAnterior - index;
            encolarEventoStage("move", "↑", `ADELANTÓ ${salto} ${salto === 1 ? "PUESTO" : "PUESTOS"}`, textoSolicitud(item), usuarioSolicitud(item));
        }
    });
}

// =====================================================
// EVENTO RÁPIDO PARA MODO ?live
// =====================================================

async function inicializarLiveEvent() {

    if (!modoLivePrivado) {
        return;
    }

    try {

        const response = await fetch(
            `${liveEventURL}?after=0`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            console.warn(
                "LIVE EVENT INIT:",
                response.status
            );
            return;
        }

        const data = await response.json();

        const evento = data?.event;

        if (evento?.id) {

            liveEventAnteriorId =
                Number(evento.id) || 0;
        }

        liveEventInicializado = true;

    } catch (error) {

        console.error(
            "Error inicializando LIVE EVENT:",
            error
        );

    }
}


async function comprobarLiveEvent() {

    if (!modoLivePrivado) {
        return;
    }

    if (!stageLiveActivo) {
        return;
    }

    if (document.hidden) {
        return;
    }

    if (!liveEventInicializado) {
        return;
    }

    if (liveEventConsultaActiva) {
        return;
    }

    liveEventConsultaActiva = true;
    const epoch = stageSessionEpoch;

    try {

        const response = await fetch(
            `${liveEventURL}?after=${encodeURIComponent(
                liveEventAnteriorId
            )}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (!stageLiveActivo || epoch !== stageSessionEpoch) return;

        const evento = data?.event;

        if (!evento?.id) {
            return;
        }

        const eventId =
            Number(evento.id);

        if (
            !Number.isFinite(eventId) ||
            eventId <= liveEventAnteriorId
        ) {
            return;
        }

        liveEventAnteriorId = eventId;

        const requestId = String(eventId);
        stageLiveEventIds.add(requestId);

        // Cancelamos cualquier alerta que /requests haya programado
        // para esta misma solicitud. El evento rápido ya la mostrará.
        const pendingTimer = stagePendingRequestAlerts.get(requestId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            stagePendingRequestAlerts.delete(requestId);
        }

        // =============================================
        // ALERTA INMEDIATA — UNA SOLA VEZ
        // =============================================

        encolarEventoStage(
            "added",
            "＋",
            "NUEVO EN LA LISTA",
            evento.text || "Nueva canción",
            evento.username
                ? `@${String(evento.username).replace(/^@+/, "")}`
                : ""
        );

        // =============================================
        // ACTUALIZAR LA COLA REAL
        // =============================================

        await cargarStageHistorial();

    } catch (error) {

        console.error(
            "Error comprobando LIVE EVENT:",
            error
        );

    } finally {

        liveEventConsultaActiva = false;

    }
}


function iniciarLiveEventPolling() {

    if (!modoLivePrivado) {
        return;
    }

    if (liveEventTimer !== null) {

        clearInterval(
            liveEventTimer
        );

        liveEventTimer = null;
    }

    liveEventTimer = setInterval(() => {

        comprobarLiveEvent();

    }, LIVE_EVENT_INTERVAL);
}


function detenerLiveEventPolling() {

    if (liveEventTimer !== null) {

        clearInterval(
            liveEventTimer
        );

        liveEventTimer = null;
    }

    liveEventInicializado = false;
    liveEventAnteriorId = 0;

    for (const timer of stagePendingRequestAlerts.values()) {
        clearTimeout(timer);
    }
    stagePendingRequestAlerts.clear();
    stageLiveEventIds.clear();
}

async function cargarStageHistorial() {

    if (!stageLiveActivo) {
        return;
    }

    if (stageCargaRequestsActiva) {
        return;
    }

    stageCargaRequestsActiva = true;
    const epoch = stageSessionEpoch;
    try {

        const response = await fetch(
            modoLivePrivado
                ? `${requestsLiveURL}&t=${Date.now()}`
                : requestsURL,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) return;

        const requests = await response.json();
        if (!stageLiveActivo || epoch !== stageSessionEpoch || !Array.isArray(requests)) return;

// Los Tap Taps se consultan independientemente
// del estado visual de /status.
// La fuente real es /live-likes.

        const played = requests.filter((item) => item.status === "played");
        const playing = requests.find((item) => item.status === "playing") || null;
        const queueCompleta = requests
            .filter((item) => item.status === "queue")
            .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

        // La interfaz muestra TODA la cola.
        // La presencia solo determina si una canción está activa,
        // por inactivarse o inactiva. /next en el Worker sigue
        // siendo quien decide cuál puede reproducirse.
        const queue = queueCompleta;

        const firma = JSON.stringify([duroOpening, requests.map((item) => [
    item.id,
    item.status,
    item.sort_order,
    item.text,
    item.raw_comment,
    item.username,
    item.tap_exempt_reason,
    item.presence_status,
    item.presence_remaining_seconds,
    item.play_number,
    item.avatar_url,
    item.rating
])]);

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

// ETAPA 06 — alertas secuenciales, sin modificar pagos ni cola.
let stageAlertGeneration = 0;
const stageSonidos = Object.fromEntries(Object.entries({added:'added',gift:'gafas',paypal:'paypal',move:'move',goal:'goal',breb:'breb','rating-epic':'rating_epic','rating-high':'rating_high','rating-mid':'rating_mid','rating-low':'rating_low',next:'next'}).map(([k,v])=>[k,new Audio('sounds/'+v+(k==='breb'?'.wav':'.mp3'))]));
Object.values(stageSonidos).forEach(a=>{a.preload='none';a.volume=1;});
function detenerSonidosStage(){
    for(const a of Object.values(stageSonidos)){a.pause();try{a.currentTime=0;}catch(_) {}}
    if('speechSynthesis' in window) speechSynthesis.cancel();
}
function resetStageAlerts(){
    stageAlertGeneration++;stageEventosPendientes.length=0;stageEventoActivo=false;
    detenerSonidosStage();document.getElementById('stage-event')?.classList.remove('show');
}
function encolarEventoStage(tipo,icono,kicker,titulo,usuario=''){
    if(!stageLiveActivo)return;
    stageEventosPendientes.push({tipo,icono,kicker,titulo,usuario});
    mostrarSiguienteEventoStage();
}
function reproducirSonidoStage(tipo){
    const audio=stageSonidos[tipo];if(!audio)return;
    audio.play().catch(e=>console.warn('Sonido no disponible:',tipo,e));
}
function hablarEventoStage(texto,tipo){
    if(!('speechSynthesis' in window))return;
    const voces=speechSynthesis.getVoices();
    const voz=voces.find(v=>v.name.includes('Paulina'))||voces.find(v=>v.lang==='es-MX')||voces.find(v=>v.lang.startsWith('es'));
    const msg=new SpeechSynthesisUtterance(texto.slice(0,220));
    if(voz)msg.voice=voz;
    msg.lang=voz?.lang||'es-MX';msg.rate=tipo==='next'?.92:1.10;msg.pitch=tipo==='next'?.82:.95;msg.volume=1;
    speechSynthesis.speak(msg);
}
function mostrarSiguienteEventoStage(){
    if(!stageLiveActivo||stageEventoActivo||!stageEventosPendientes.length)return;
    const overlay=document.getElementById('stage-event');if(!overlay)return;
    const evento=stageEventosPendientes.shift(), generation=++stageAlertGeneration;
    stageEventoActivo=true;detenerSonidosStage();
    overlay.className='stage-event stage-event-'+evento.tipo;
    document.getElementById('stage-event-icon').textContent=evento.icono;
    document.getElementById('stage-event-kicker').textContent=evento.kicker;
    document.getElementById('stage-event-title').textContent=evento.titulo;
    document.getElementById('stage-event-user').textContent=evento.usuario;
    overlay.classList.add('show');reproducirSonidoStage(evento.tipo);
    const speech=evento.tipo==='added'?evento.titulo+'. Anotado en la lista.':evento.tipo==='next'?'Siguiente canción. '+evento.titulo:null;
    if(speech)setTimeout(()=>{if(generation!==stageAlertGeneration)return;Object.values(stageSonidos).forEach(a=>a.pause());hablarEventoStage(speech,evento.tipo);},900);
    const duration=speech?Math.max(5200,Math.min(18000,1800+speech.length*90)):evento.tipo==='goal'?5200:4000;
    setTimeout(()=>{if(generation!==stageAlertGeneration)return;detenerSonidosStage();overlay.classList.remove('show');setTimeout(()=>{if(generation!==stageAlertGeneration)return;stageEventoActivo=false;mostrarSiguienteEventoStage();},450);},duration);
}

function actualizarRankingStage(topUsers) {
    for (const user of topUsers) {
        const key = String(user.username || "").trim().replace(/^@+/, "").toLowerCase();
        if (key && user.avatar_url) stageAvatarCache.set(key, user.avatar_url);
    }
    const playing = stageUltimosDatos.playing;
    if (playing && !playing.avatar_url) {
        const profile = document.querySelector(".stage-current-profile .stage-user-avatar");
        const key = String(playing.username || "").trim().replace(/^@+/, "").toLowerCase();
        if (profile && !profile.querySelector("img") && stageAvatarCache.has(key)) profile.replaceWith(stageAvatar(playing));
    }
    const rankingList = document.getElementById("live-likes-ranking-list");
    if (!rankingList) return;
    if (!topUsers.length) {
        rankingList.innerHTML = '<div class="live-likes-ranking-empty">Todavía no hay ranking.</div>';
        return;
    }
    rankingList.innerHTML = topUsers.slice(0, 5).map((user, index) => {
        const username = String(user.username || "").replace(/^@+/, "");
        const initials = (username || "?").slice(0, 2).toUpperCase();
        const avatar = user.avatar_url
            ? `<img class="live-likes-ranking-avatar" src="${escaparHTML(user.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<span class="live-likes-ranking-avatar live-likes-ranking-avatar-fallback">${escaparHTML(initials)}</span>`;
        return `
        <div class="live-likes-ranking-item">
            <span class="live-likes-ranking-position">${["🥇", "🥈", "🥉"][index] || `${index + 1}`}</span>
            ${avatar}
            <strong class="live-likes-ranking-user">@${escaparHTML(username)}</strong>
            <span class="live-likes-ranking-count">${Number(user.likes || 0).toLocaleString("es-CO")} ❤️</span>
        </div>`;
    }).join("");
}

async function cargarStageLiveLikes() {

// Los Tap Taps se consultan independientemente
// del estado visual de /status.

    if (stageCargaLikesActiva) {
        return;
    }

    stageCargaLikesActiva = true;
    const epoch = stageSessionEpoch;
    try {
        const liveLikesRequestURL =
    `${liveLikesURL}?live&t=${Date.now()}`;

const response = await fetch(
    liveLikesRequestURL,
    {
        cache: "no-store"
    }
);
        if (!response.ok) return;
        const data = await response.json();
        if (!stageLiveActivo || epoch !== stageSessionEpoch) return;

// No descartamos los datos de Tap Taps
// por el estado visual de /status.

        if (Object.prototype.hasOwnProperty.call(data,'opening')) actualizarAperturaStage(data.opening);
        const goal = duroOpening?.phase === 0 ? 2000 : (Number(data.goal) || 5000);
const total = Number(data.total) || 0;
const base = Number(data.base) || 0;

const likesDelLive = Math.max(
    0,
    total - base
);

const progress = duroOpening && duroOpening.phase < 2 ? Math.min(likesDelLive,goal) : likesDelLive % goal;

const porcentaje = Math.min(
    100,
    progress / goal * 100
);

        document.getElementById("live-likes-count").textContent = progress.toLocaleString("es-CO");
        document.getElementById("live-likes-goal").textContent = goal.toLocaleString("es-CO");
        document.getElementById("live-likes-total").textContent = likesDelLive.toLocaleString("es-CO");
        document.getElementById("live-likes-progress").style.width = `${porcentaje}%`;
        document.getElementById("live-likes-message").textContent = duroOpening && duroOpening.phase < 2 ? (duroOpening.phase===0 ? `${Math.max(0,2000-likesDelLive).toLocaleString("es-CO")} TAP TAPS PARA ABRIR LISTA` : `${Math.max(0,5000-likesDelLive).toLocaleString("es-CO")} TAP TAPS PARA EMPEZAR`) : `${Math.max(0, goal - progress).toLocaleString("es-CO")} TAP TAPS PARA LA SIGUIENTE`;
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
                encolarEventoStage("goal", "❤️", "META DE TAP TAPS COMPLETADA", "¡META ALCANZADA!", "EL LIVE LA DESBLOQUEÓ");
            } else if (evento.rating_pending) {
                encolarEventoStage("goal", "❤️", "META DE TAP TAPS COMPLETADA", "¡META ALCANZADA!", "GRACIAS POR LOS TAP TAPS");
            } else if (["gafas","breb","paypal"].includes(evento.exempt_reason)) {
                const proteccion = evento.exempt_reason === "gafas" ? "PROTEGIDA POR GAFAS 😎" : evento.exempt_reason === "breb" ? "PROTEGIDA POR BRE-B ✓" : "PROTEGIDA POR PAYPAL ✓";
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

// =====================================================
// INICIO DEL SISTEMA LIVE / OFFLINE
// =====================================================

iniciarPollingStage();