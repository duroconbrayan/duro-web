"""Prueba del tap tap en el LABORATORIO de DURO LIVE (tu Worker corriendo solo en tu Mac, con datos de prueba).

Uso:  python3 probar_taptap.py      (con el laboratorio encendido en http://127.0.0.1:8787)

Qué hace:
1. Dos fans de prueba piden una canción por comentario (igual que en un LIVE).
2. «Adelanta el reloj» 11 minutos: las canciones y su presencia quedan viejas, como si nadie hubiera tocado.
3. Fan A da tap tap: se manda lo mismo que manda tu app cada 60 segundos (/song-presence).
   Fan B no hace nada.
4. Revisa la lista pública (/requests) y quién sonaría después (/next).

Resultado esperado: la canción de A queda ACTIVA y la de B INACTIVA.
Nunca toca tu DURO LIVE real: todo va a 127.0.0.1 y a la base local del laboratorio.
"""
import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime, timedelta, timezone

LAB = "http://127.0.0.1:8787"
CLAVE = "laboratorio"                      # la clave de admin de prueba (.dev.vars del laboratorio)
AQUI = os.path.dirname(os.path.abspath(__file__))
WR = ["npx", "--yes", "wrangler@4"]
LOCAL = ["--local", "--persist-to", ".estado", "--config", "wrangler.jsonc"]


def pedir(ruta, metodo="GET", datos=None):
    req = urllib.request.Request(LAB + ruta, method=metodo, data=json.dumps(datos).encode() if datos is not None else None,
                                 headers={"Authorization": f"Bearer {CLAVE}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"null")


def wrangler(*args):
    r = subprocess.run(WR + list(args) + LOCAL, cwd=AQUI, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("wrangler falló:\n" + r.stderr[-500:])


def lista():
    return {s["id"]: s for s in pedir("/requests") if s.get("status") in ("queue", "playing")}


def mostrar(titulo, filtro):
    print(f"\n{titulo}")
    for s in lista().values():
        if s["id"] in filtro:
            print(f"  #{s['id']} {s['username']:<14} {s['presence_status']:<9} quedan {s['presence_remaining_seconds']}s")


def main():
    # Asegura que el laboratorio está encendido y NO es producción
    if "127.0.0.1" not in LAB:
        raise SystemExit("Esto solo corre contra el laboratorio local.")
    pedir("/status")

    print("1) Dos fans piden canción…")
    a = pedir("/comment-add", "POST", {"text": "Escucho Voces - Brayan Trampa", "username": "fan_tap_tap",
                                       "tiktok_user_id": "9001", "raw_comment": "!pedir Escucho Voces"})
    b = pedir("/comment-add", "POST", {"text": "Carolina Ortiz - Brayan Trampa", "username": "fan_quieto",
                                       "tiktok_user_id": "9002", "raw_comment": "!pedir Carolina Ortiz"})
    ids = {a["id"], b["id"]}
    mostrar("   Recién pedidas (deben estar activas):", ids)

    print("\n2) Adelanto el reloj 11 minutos (canciones y presencia viejas)…")
    viejo = datetime.now(timezone.utc) - timedelta(minutes=11)
    wrangler("d1", "execute", "DB", "--command",
             f"UPDATE requests SET created_at = '{viejo.strftime('%Y-%m-%d %H:%M:%S')}' WHERE id IN ({a['id']}, {b['id']})")
    for s in (a, b):
        wrangler("kv", "key", "put", f"song_presence:{s['id']}",
                 json.dumps({"request_id": s["id"], "last_activity_at": viejo.isoformat()}), "--binding", "DURO_STATE")
    mostrar("   Sin tap taps hace 11 minutos (deben estar inactivas):", ids)

    print("\n3) fan_tap_tap da tap tap (lo mismo que manda tu app cada 60 s)…")
    r = pedir("/song-presence", "POST", {"tiktok_user_id": "9001", "username": "fan_tap_tap"})
    print(f"   Respuesta del Worker: found={r.get('found')} updated={r.get('updated')}")
    time.sleep(1)
    L = lista()
    mostrar("   Después del tap tap:", ids)

    ok_a = L[a["id"]]["presence_status"] == "active"
    ok_b = L[b["id"]]["presence_status"] == "inactive"
    print("\nResultado:")
    print(f"  {'✅' if ok_a else '❌'} La canción de quien dio tap tap sigue ACTIVA")
    print(f"  {'✅' if ok_b else '❌'} La canción de quien no hizo nada quedó INACTIVA")
    print("\n" + ("✅ El tap tap mantiene activa la canción." if ok_a and ok_b else "❌ Algo no funciona como debería."))


if __name__ == "__main__":
    main()
