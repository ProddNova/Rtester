// Avvio del server (così funziona sia "npm start" sia "node index.js", il default di Render).
const server = require('./server');

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('CacciAuto in ascolto sulla porta ' + PORT);
  require('./server/keepalive').start();
});
