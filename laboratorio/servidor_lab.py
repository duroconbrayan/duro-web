"""Página del LABORATORIO de DURO LIVE en http://127.0.0.1:4175

Habla SOLO con tu Worker de prueba (http://127.0.0.1:8787, datos locales). Nunca con el DURO LIVE real.
Acciones: pedir canción como un fan, dar tap tap (lo mismo que manda tu app), adelantar el reloj y ver la lista.
"""
import http.server
import json
import os
import socketserver
import subprocess
import urllib.request
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
LAB = "http://127.0.0.1:8787"
CLAVE = "laboratorio"
PUERTO = 4175


def worker(ruta, metodo="GET", datos=None):
    req = urllib.request.Request(LAB + ruta, method=metodo, data=json.dumps(datos).encode() if datos is not None else None,
                                 headers={"Authorization": f"Bearer {CLAVE}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"null")


def wrangler(*args):
    r = subprocess.run(["npx", "--yes", "wrangler@4", *args, "--local", "--persist-to", ".estado", "--config", "wrangler.jsonc"],
                       cwd=AQUI, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-300:])


def leer_presencia(id_):
    """Lee la última actividad guardada en el KV del laboratorio (no la lista, que tiene caché de 10 s)."""
    r = subprocess.run(["npx", "--yes", "wrangler@4", "kv", "key", "get", f"song_presence:{id_}", "--binding", "DURO_STATE",
                        "--local", "--persist-to", ".estado", "--config", "wrangler.jsonc", "--text"], cwd=AQUI, capture_output=True, text=True)
    try:
        t = r.stdout[r.stdout.index("{"):]
        return datetime.fromisoformat(json.loads(t)["last_activity_at"].replace("Z", "+00:00"))
    except (ValueError, KeyError):
        return None


def adelantar(minutos):
    """Hace que todas las canciones en cola y su última presencia parezcan «minutos» más viejas."""
    ids = subprocess.run(["npx", "--yes", "wrangler@4", "d1", "execute", "DB", "--json", "--command",
                          "SELECT id, created_at FROM requests WHERE status IN ('queue','playing')",
                          "--local", "--persist-to", ".estado", "--config", "wrangler.jsonc"], cwd=AQUI, capture_output=True, text=True).stdout
    filas = json.loads(ids[ids.index("["):])[0]["results"]
    for f in filas:
        creada = datetime.strptime(f["created_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        wrangler("d1", "execute", "DB", "--command",
                 f"UPDATE requests SET created_at = '{(creada - timedelta(minutes=minutos)).strftime('%Y-%m-%d %H:%M:%S')}' WHERE id = {int(f['id'])}")
        ultima = (leer_presencia(f["id"]) or creada) - timedelta(minutes=minutos)
        wrangler("kv", "key", "put", f"song_presence:{int(f['id'])}", json.dumps({"request_id": f["id"], "last_activity_at": ultima.isoformat()}),
                 "--binding", "DURO_STATE")
    return len(filas)


class Lab(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=AQUI, **k)

    def responder(self, datos, codigo=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        if self.path.startswith("/api/lista"):
            try:
                return self.responder([s for s in worker("/requests") if s.get("status") in ("queue", "playing")])
            except Exception as e:
                return self.responder({"error": f"El laboratorio no está encendido ({e})"}, 503)
        if self.path in ("/", "/index.html"):
            self.path = "/lab.html"
        if os.path.basename(self.path).startswith(".") or self.path.endswith((".py", ".sql", ".jsonc", ".vars")):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        largo = int(self.headers.get("Content-Length") or 0)
        datos = json.loads(self.rfile.read(largo) or b"{}")
        try:
            if self.path == "/api/pedir":
                fan = str(datos["fan"])[:40]
                return self.responder(worker("/comment-add", "POST", {"text": str(datos.get("cancion") or "Canción de prueba")[:120],
                                                                      "username": fan, "tiktok_user_id": "lab-" + fan, "raw_comment": "!pedir"}))
            if self.path == "/api/taptap":
                fan = str(datos["fan"])[:40]
                return self.responder(worker("/song-presence", "POST", {"tiktok_user_id": "lab-" + fan, "username": fan}))
            if self.path == "/api/adelantar":
                return self.responder({"canciones": adelantar(int(datos.get("minutos", 5)))})
            if self.path == "/api/sonar":
                return self.responder(worker("/next", "POST", {}))
        except Exception as e:
            return self.responder({"error": str(e)[:300]}, 500)
        self.send_error(404)


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PUERTO), Lab) as httpd:
    print(f"Laboratorio DURO LIVE en http://127.0.0.1:{PUERTO}")
    httpd.serve_forever()
