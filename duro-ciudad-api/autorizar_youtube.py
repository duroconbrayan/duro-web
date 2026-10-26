"""Autoriza una sola vez a duro-ciudad para leer la duración media de las vistas de tu canal (YouTube Analytics).

Uso:  python3 autorizar_youtube.py /ruta/al/client_secret_XXXX.json

1. Abre Google en tu navegador: entras con la cuenta del canal y le das «Permitir».
   Solo pide permiso de LECTURA de estadísticas (yt-analytics.readonly): no puede subir, borrar ni cambiar nada.
2. Guarda client id, client secret y el permiso (refresh token) como secretos cifrados del Worker duro-ciudad.
   No se imprimen ni se guardan en ningún archivo.
"""
import http.server
import json
import secrets
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
import hashlib
import base64
import os
import ssl

PUERTO = 8765
REDIRECCION = f"http://127.0.0.1:{PUERTO}/"
ALCANCE = "https://www.googleapis.com/auth/yt-analytics.readonly"
AQUI = os.path.dirname(os.path.abspath(__file__))


def contexto_ssl():
    if os.path.exists("/etc/ssl/cert.pem"):
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


def main(ruta):
    with open(ruta, encoding="utf-8") as f:
        datos = json.load(f)
    cliente = datos.get("installed") or datos.get("web")
    if not cliente:
        sys.exit("Ese JSON no es un cliente OAuth de Google (debe ser de tipo «App de escritorio»).")
    estado = secrets.token_urlsafe(16)
    verificador = secrets.token_urlsafe(48)
    reto = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b"=").decode()
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cliente["client_id"], "redirect_uri": REDIRECCION, "response_type": "code", "scope": ALCANCE,
        "access_type": "offline", "prompt": "consent", "state": estado, "code_challenge": reto, "code_challenge_method": "S256"})

    recibido = {}

    class Manejador(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
            if q.get("state") != estado:
                self.send_response(400); self.end_headers(); return
            recibido.update(q)
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
            self.wfile.write("<h2>Listo. Ya puedes cerrar esta pestaña y volver a la oficina.</h2>".encode())
            threading.Thread(target=self.server.shutdown).start()

        def log_message(self, *a):
            pass

    servidor = http.server.HTTPServer(("127.0.0.1", PUERTO), Manejador)
    print("Abriendo Google en tu navegador… entra con la cuenta del canal y dale «Permitir».")
    webbrowser.open(url)
    servidor.serve_forever()
    if "code" not in recibido:
        sys.exit(f"Google no dio el permiso: {recibido.get('error', 'sin respuesta')}")

    cuerpo = urllib.parse.urlencode({"code": recibido["code"], "client_id": cliente["client_id"], "client_secret": cliente["client_secret"],
                                      "redirect_uri": REDIRECCION, "grant_type": "authorization_code", "code_verifier": verificador}).encode()
    with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=cuerpo), context=contexto_ssl()) as r:
        tokens = json.loads(r.read())
    if "refresh_token" not in tokens:
        sys.exit("Google no entregó el permiso permanente (refresh token). Vuelve a correr el script.")

    for nombre, valor in [("YT_CLIENT_ID", cliente["client_id"]), ("YT_CLIENT_SECRET", cliente["client_secret"]),
                          ("YT_REFRESH_TOKEN", tokens["refresh_token"])]:
        r = subprocess.run(["npx", "--yes", "wrangler@4", "secret", "put", nombre], input=valor, text=True,
                           capture_output=True, cwd=AQUI)
        print(f"{nombre}: {'guardado en Cloudflare ✓' if r.returncode == 0 else 'ERROR ' + r.stderr[-300:]}")
    print("Listo: duro-ciudad ya puede leer la duración media de tus vistas.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
