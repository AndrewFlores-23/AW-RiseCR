"""Servidor local que imita a Cloudflare: /seo sirve seo.html y las
rutas que no existen muestran 404.html. Uso: python3 herramientas/servidor-local.py"""
import http.server, pathlib, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent / "public"
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8788


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RAIZ), **k)

    def send_head(self):
        ruta = self.path.split("?")[0].split("#")[0]
        if ruta != "/" and "." not in ruta.rsplit("/", 1)[-1] and (RAIZ / (ruta.strip("/") + ".html")).exists():
            self.path = ruta.rstrip("/") + ".html"
        elif not (RAIZ / ruta.lstrip("/")).exists() and ruta != "/":
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write((RAIZ / "404.html").read_bytes())
            return None
        return super().send_head()


print(f"Sirviendo {RAIZ} en http://127.0.0.1:{PUERTO}")
http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()
