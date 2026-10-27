const express = require("express");
const nunjucks = require("nunjucks");
// const pg = require("pg");
// pg.types.setTypeParser(20, (val) => parseInt(val, 10)); // приведение типа к нумбер
require("dotenv").config(); //загружаем модуль dotenv

//подключение к БД mognoDB
const { MongoClient, ObjectId } = require("mongodb");
//инстанс MongoClient, MongoClient.connect()-создает пул подключений возвращаяет промис
const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  poolSize: 10, //размер пула -10 подключений (дефолтное значение 5)
});

const app = express();
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

app.use(express.json());
app.use(express.static("public"));

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("timers");
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/api/timers", async (req, res) => {
  try {
    const isActive = req.query.isActive === "true"; // Получаем флаг из URL
    const filteredTimers = await req.db.collection("timers").find({ isActive: isActive }).toArray();
    const result = filteredTimers.map((t) => {
      return {
        ...t,
        progress: t.isActive ? Date.now() - t.start : t.duration,
        id: t._id.toString(),
      };
    });
    res.json(result);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/api/timers", async (req, res) => {
  try {
    const { description } = req.body;
    //Проверка description
    if (!description || typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Описание обязательно для заполнения" });
    }
    //создать новый объект таймера
    const newTimer = {
      start: Date.now(),
      description: description || "",
      isActive: true,
    };
    //добавить новый таймер в базу таймеров и получаем id из БД
    const { insertedId } = await req.db.collection("timers").insertOne(newTimer);
    res.status(201).json({ id: insertedId });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/api/timers/:id/stop", async (req, res) => {
  const { id } = req.params;
  console.log("Полученный ID:", id); // <--- Добавьте это
  console.log("Тип ID:", typeof id);
  // id валидность
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "Неверный формат ID. Ожидается 24 шестнадцатеричных символа.",
    });
  }
  try {
    const timer = await req.db.collection("timers").findOne({ _id: ObjectId(id) });
    if (!timer) {
      return res.status(404).send(`Timer not found : ${id}`);
    }
    const end = Date.now();
    const duration = end - timer.start;

    await req.db.collection("timers").updateOne(
      { _id: ObjectId(id) },
      {
        $set: {
          isActive: false,
          end: end,
          duration: duration,
        },
      }
    );
    res.status(204).end();
  } catch (err) {
    res.status(400).send(err.message);
  }
});
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
