const { google } = require("googleapis");

async function leerPlaylist() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const respuesta = await sheets.spreadsheets.values.get({
    spreadsheetId: "1QN3M9UzAWP5eIN7jIqbXTB1M5e8WCVyNzxlg1xVJ1ck",
    range: "A:B",
  });

  const canciones = respuesta.data.values.slice(1).map((fila, index) => ({
  puesto: index + 1,
  cancion: fila[0]
}));

console.log(canciones);
}

leerPlaylist();