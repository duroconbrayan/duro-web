const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(express.static("../"));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  next();
});

const PORT = 3000;

async function obtenerPlaylist() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const respuesta = await sheets.spreadsheets.values.get({
    spreadsheetId: "1QN3M9UzAWP5eIN7jIqbXTB1M5e8WCVyNzxlg1xVJ1ck",
    range: "A:A",
  });

  const canciones = respuesta.data.values.slice(1).map((fila, index) => ({
    puesto: index + 1,
    cancion: fila[0],
  }));

  return canciones;
}

app.get("/playlist", async (req, res) => {
    console.log("Entró a la ruta playlist");
  try {
    const playlist = await obtenerPlaylist();
    res.json(playlist);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error leyendo playlist");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});

process.stdin.resume();