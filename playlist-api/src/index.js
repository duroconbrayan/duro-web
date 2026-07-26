import { GoogleAuth } from "google-auth-library";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/playlist") {
      try {
        const credentials = JSON.parse(env.GOOGLE_CREDENTIALS);

        const auth = new GoogleAuth({
          credentials,
          scopes: [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
          ],
        });

        const client = await auth.getClient();

        const response = await client.request({
          url: "https://sheets.googleapis.com/v4/spreadsheets/1QN3M9UzAWP5eIN7jIqbXTB1M5e8WCVyNzxlg1xVJ1ck/values/A:A",
        });

        const filas = response.data.values || [];

        const canciones = filas.slice(1).map((fila, index) => ({
          puesto: index + 1,
          cancion: fila[0],
        }));

        return new Response(JSON.stringify(canciones), {
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://duroconbrayan.com"
  }
});

      } catch (error) {
        return new Response(
          "Error leyendo playlist: " + error.message,
          { status: 500 }
        );
      }
    }

    return new Response("Worker funcionando", {
  headers: {
    "Access-Control-Allow-Origin": "https://duroconbrayan.com"
  }
});
  },
};