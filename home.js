const API = "https://playlist-api.bookingelbrayan.workers.dev";

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "DURO";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "DURO";
  return new Intl.DateTimeFormat("es-CO", {
    day:"numeric", month:"short", year:"numeric"
  }).format(date);
}

function coverUrl(article) {
  return article.cover_image || "";
}

function articleHref(article) {
  return `/noticias/${encodeURIComponent(article.slug)}`;
}

function renderHero(articles) {
  const hero = $("#heroSection");
  if (!articles.length) {
    hero.innerHTML = `
      <div class="hero-main loaded">
        <div class="hero-copy">
          <span class="eyebrow">DURO · NOTICIAS</span>
          <h1>La cultura urbana tiene una nueva casa.</h1>
          <p>Estamos preparando las historias, noticias y lanzamientos que van a formar parte de DURO.</p>
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-card"><div class="hero-card-copy"><span class="eyebrow">PRÓXIMAMENTE</span><h2>Noticias</h2><p>El contenido editorial de DURO está tomando forma.</p></div></div>
        <div class="hero-card"><div class="hero-card-copy"><span class="eyebrow">DESCUBRE</span><h2>Playlist</h2><p>Entra al directo y descubre qué está sonando.</p></div></div>
      </div>`;
    return;
  }

  const [main, ...side] = articles;
  const image = coverUrl(main);
  hero.innerHTML = `
    <a class="hero-main loaded" href="${articleHref(main)}"
       style="${image ? `background-image:linear-gradient(180deg,rgba(0,0,0,.02) 15%,rgba(0,0,0,.9) 100%),url('${escapeHtml(image)}');background-size:cover;background-position:center` : ""}">
      <div class="hero-copy">
        <span class="eyebrow">${escapeHtml(main.category || "NOTICIAS")}</span>
        <h1>${escapeHtml(main.title)}</h1>
        <p>${escapeHtml(main.excerpt || "La historia detrás de lo que está pasando.")}</p>
        <div class="hero-meta">${escapeHtml(main.author || "DURO")} · ${formatDate(main.published_at)}</div>
      </div>
    </a>
    <div class="hero-side">
      ${side.slice(0,2).map((article) => {
        const img = coverUrl(article);
        return `<a class="hero-card" href="${articleHref(article)}"
          style="${img ? `background-image:linear-gradient(180deg,rgba(0,0,0,.02) 10%,rgba(0,0,0,.92) 100%),url('${escapeHtml(img)}');background-size:cover;background-position:center` : ""}">
          <div class="hero-card-copy">
            <span class="eyebrow">${escapeHtml(article.category || "NOTICIAS")}</span>
            <h2>${escapeHtml(article.title)}</h2>
            <p>${formatDate(article.published_at)}</p>
          </div>
        </a>`;
      }).join("")}
    </div>`;
}

function renderNews(articles) {
  const grid = $("#newsGrid");
  if (!articles.length) {
    grid.innerHTML = `<div class="news-empty">Todavía no hay artículos publicados. Esta sección se llenará desde el panel editorial.</div>`;
    return;
  }
  grid.innerHTML = articles.slice(0,6).map((article) => {
    const img = coverUrl(article);
    return `<article class="news-card">
      <a class="news-image" href="${articleHref(article)}">
        ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(article.title)}" loading="lazy" decoding="async">` : ""}
      </a>
      <div class="news-body">
        <span class="section-kicker">${escapeHtml(article.category || "NOTICIAS")}</span>
        <h3><a href="${articleHref(article)}">${escapeHtml(article.title)}</a></h3>
        <p>${escapeHtml(article.excerpt || "")}</p>
        <div class="news-meta">${escapeHtml(article.author || "DURO")} · ${formatDate(article.published_at)}</div>
      </div>
    </article>`;
  }).join("");
}

function renderRanking(articles) {
  $("#rankingList").innerHTML = articles.slice(0,5).map((article,index) => `
    <div class="rank-item">
      <span class="rank-num">${String(index+1).padStart(2,"0")}</span>
      <a href="${articleHref(article)}">
        <span class="rank-cat">${escapeHtml(article.category || "NOTICIAS")}</span>
        ${escapeHtml(article.title)}
      </a>
    </div>`).join("");
}

function renderTrends(articles) {
  const cats = [...new Set(articles.map(a => a.category).filter(Boolean))].slice(0,5);
  if (cats.length) {
    $("#trendItems").innerHTML = cats.map(c => `<span>${escapeHtml(c).toUpperCase()}</span>`).join("");
  }
}

async function loadArticles() {
  try {
    const response = await fetch(`${API}/articles?limit=20`, { cache:"no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    renderHero(articles);
    renderNews(articles);
    renderRanking(articles);
    renderTrends(articles);

    $("#articleCount").textContent = `${articles.length} publicados`;
  } catch (error) {
    console.error("DURO articles:", error);
    renderHero([]);
    renderNews([]);
    $("#rankingList").innerHTML = `<div class="rank-item"><a href="/en-construccion.html?seccion=NOTICIAS">Estamos preparando el contenido editorial.</a></div>`;
    $("#articleCount").textContent = "DURO";
  }
}

function initMenu() {
  const toggle = $("#menuToggle");
  const nav = $("#mobileNav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "✕" : "☰";
  });
}

function initSearch() {
  const toggle = $("#searchToggle");
  const panel = $("#searchPanel");
  const input = $("#searchInput");
  toggle?.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") panel.hidden = true;
    if (event.key === "/" && document.activeElement !== input) {
      event.preventDefault();
      panel.hidden = false;
      input.focus();
    }
  });
}

initMenu();
initSearch();
loadArticles();
