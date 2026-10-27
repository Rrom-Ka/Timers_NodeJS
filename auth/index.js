const express = require("express");
const cookieParser = require("cookie-parser"); //Работа в куки в експресс
const nunjucks = require("nunjucks");
require("dotenv").config(); //загружаем модуль dotenv

const http = require("http");
const WebSocket = require("ws");

//подключение к БД mognoDB
const { MongoClient } = require("mongodb");
const { findUserBySessionId } = require("./users"); //для проверки сокетов
const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  poolSize: 10,
});

const app = express();
const server = http.createServer(app); // Создаем HTTP сервер для совместной работы с WS
const wss = new WebSocket.Server({ noServer: true }); // WS сервер

// Вспомогательные функции для рассылки сообщений клиентам
const sendAllTimers = async (ws, db) => {
  const timers = await db.collection("timer").find({ userId: ws.user._id }).toArray();
  ws.send(
    JSON.stringify({
      type: "all_timers",
      data: timers.map((t) => ({
        ...t,
        id: t._id.toString(),
        progress: t.isActive ? Date.now() - t.start : t.duration,
      })),
    })
  );
};

const sendActiveTimers = async (ws, db) => {
  const active = await db.collection("timer").find({ userId: ws.user._id, isActive: true }).toArray();
  ws.send(
    JSON.stringify({
      type: "active_timers",
      data: active.map((t) => ({
        ...t,
        id: t._id.toString(),
        progress: Date.now() - t.start,
      })),
    })
  );
};

//  Аутентификация веб-сокетов (через HTTP Upgrade)
server.on("upgrade", async (req, socket, head) => {
  const cookieHeader = req.headers.cookie || "";
  const sessionId = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("sessionId="))
    ?.split("=")[1];

  if (!sessionId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    const client = await clientPromise;
    const db = client.db("timers");
    const user = await findUserBySessionId(db, sessionId);

    if (!user) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user; // Привязываем пользователя к сокету
      wss.emit("connection", ws, req);
    });
  } catch (e) {
    socket.destroy();
  }
});

// . Логика при подключении
wss.on("connection", async (ws) => {
  const client = await clientPromise;
  const db = client.db("timers");

  // 3. Отправляем все таймеры один раз при подключении
  await sendAllTimers(ws, db);

  // 5. Каждую секунду шлем активные таймеры
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      sendActiveTimers(ws, db);
    }
  }, 1000);

  ws.on("close", () => clearInterval(interval));
});

// Делаем wss и функции доступными в роутерах через app
app.set("wss", wss);
app.set("sendAllTimers", sendAllTimers);

//Интеграция nunjucks с express
nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.use(express.json()); // парсинг JSON-тела запроса, создание req.body
app.use(express.static("public")); // доступ по прямой ссылке из браузера к ф-л в /public
app.use(cookieParser()); // извлекает куки в req.cookies
// подключение базы данных к каждому запросу через req.db
app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("timers");
    next();
  } catch (error) {
    next(error);
  }
});

// регистрация роутеров для пользователей и таймеров
const usersModule = require("./users");
app.use("/", usersModule.router); // роуты пользователей
const timersModule = require("./timers");
app.use("/", timersModule.router); // роуты таймеров

// установка порта (из среды или 3000)
const port = process.env.PORT || 3000;

// app.listen(port, () => {
//   console.log(`  Listening on http://localhost:${port}`); // запуск сервера
// });

// Запуск именно server (HTTP + WS), а не app
server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
