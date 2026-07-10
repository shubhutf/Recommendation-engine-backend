const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const connectDB = require("./config/db");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        const nextPort = Number(PORT) + 1;
        console.log(`⚠️ Port ${PORT} is busy. Trying port ${nextPort}...`);

        app.listen(nextPort, () => {
          console.log(`Server fallback running on port ${nextPort}`);
        });
      } else {
        console.error(err);
      }
    });
  } catch (err) {
    console.error("Server failed to start:", err.message);
    process.exit(1);
  }
}

start();