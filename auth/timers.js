const express = require("express");
require("dotenv").config(); //загружаем модуль dotenv
const { auth } = require("./users"); // импорт функции авторизации
const WebSocket = require("ws"); // Добавлено для константы OPEN

const { ObjectId } = require("mongodb"); // класс для работы с ID документов MongoDB

const router = express.Router(); // создание дочернего роутера
router.use(auth()); // аутентификация для всех вложенных роутов

// Вспомогательная функция для уведомления клиента через WS
//  Поиск сокета пользователя и отправка all_timers
const notifyUserUpdate = async (req) => {
  const wss = req.app.get("wss");
  const sendAllTimers = req.app.get("sendAllTimers");

  wss.clients.forEach((client) => {
    if (client.user && client.user._id.toString() === req.user._id.toString() && client.readyState === WebSocket.OPEN) {
      sendAllTimers(client, req.db);
    }
  });
};

router.get("/api/timers", async (req, res) => {
  try {
    const isActive = req.query.isActive === "true"; // Получаем флаг из URL
    //получаем отфильтрованный списко таймеров конертного пользователя
    const filteredTimers = await req.db
      .collection("timer")
      .find({
        isActive: isActive,
        userId: req.user._id,
      })
      .toArray();
    // подготовка списка таймеров
    const result = filteredTimers.map((t) => {
      return {
        ...t,
        progress: t.isActive ? Date.now() - t.start : t.duration,
        id: t._id.toString(),
      };
    });
    res.json(result); // отправка результата в формате JSON
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post("/api/timers", async (req, res) => {
  try {
    const { description } = req.body;
    //Проверка description (его заполнения)
    if (!description || typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Описание обязательно для заполнения" });
    }
    //создать новый объект таймера
    const newTimer = {
      start: Date.now(),
      description: description || "",
      isActive: true,
      userId: req.user._id,
    };
    //добавить новый таймер в базу таймеров и получаем id из БД
    const { insertedId } = await req.db.collection("timer").insertOne(newTimer);
    // : Уведомляем клиента через сокет
    await notifyUserUpdate(req);
    res.status(201).json({ id: insertedId });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post("/api/timers/:id/stop", async (req, res) => {
  const { id } = req.params; //получение id
  // id валидность
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "Неверный формат ID. Ожидается 24 шестнадцатеричных символа.",
    });
  }
  try {
    const timer = await req.db.collection("timer").findOne({ _id: ObjectId(id) }); // поиск таймера в БД по его ID
    if (!timer) {
      return res.status(404).send(`Timer not found : ${id}`);
    }
    const end = Date.now(); //время окончания таймера
    const duration = end - timer.start; //обсалютное значение таймера
    // сохранение результатов остановки таймера в БД
    await req.db.collection("timer").updateOne(
      { _id: ObjectId(id) },
      {
        $set: {
          isActive: false,
          end: end,
          duration: duration,
        },
      }
    );
    // ИЗМЕНЕНИЕ: Уведомляем клиента через сокет
    await notifyUserUpdate(req);
    res.status(204).end(); // статус 204: запрос выполнен, данных нет
  } catch (err) {
    res.status(400).send(err.message);
  }
});

module.exports = { router };
