require("dotenv").config(); //- для доступа к переменным окуржения
const crypto = require("crypto"); // модуль для безопасности и шифрования

const express = require("express");
const cookieParser = require("cookie-parser"); //Работа в куки в експресс
const bodyParser = require("body-parser"); //Анализирует тела входящих запросов

const { nanoid } = require("nanoid"); // генератор  ID

const { ObjectId } = require("mongodb"); // класс для работы с ID документов MongoDB

const router = express.Router(); //Router
router.use(cookieParser()); // поддержка кукис

//поиск по имени пользователя
const findUserByUsername = async (db, username) =>
  db
    .collection("users") //поиск в таблице users
    .findOne({ username }); //находим одну запись
//поиск по сессии пользователя
const findUserBySessionId = async (db, sessionId) => {
  const session = await db.collection("sessions").findOne(
    { sessionId },
    {
      projection: { userId: 1 },
    }
  );
  if (!session) {
    console.log("Сессия не найдена в БД");
    return;
  }
  return db
    .collection("users") //поиск в таблице users
    .findOne({ _id: new ObjectId(session.userId) }); //id это спец объект
};
//содзание сессии
const createSession = async (db, userId) => {
  const sessionId = nanoid();
  //в "sessions" вносим одну запись insertOne()
  await db.collection("sessions").insertOne({
    userId,
    sessionId,
  });
  return sessionId;
};
//удаление сессиии
const deleteSession = async (db, sessionId) => {
  console.log(sessionId);
  await db.collection("sessions").deleteOne({ sessionId });
};

//хеширование пароля
const hashPass = (pass) => {
  //преобразуем pass в хэш
  const hashPassword = crypto.createHash("sha256").update(pass).digest("hex");
  return hashPassword;
};
const auth = () => async (req, res, next) => {
  //наличия сессии в куках
  if (!req.cookies["sessionId"]) {
    return next();
  }
  //поиск пользователя в БД по ID сессии
  const user = await findUserBySessionId(req.db, req.cookies["sessionId"]);
  req.user = user; //привязка найденного юзера к объекту запроса
  req.sessionId = req.cookies["sessionId"]; //сохранение ID сессии
  next();
};
// рендеринг главной страницы
router.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user, //передача данных авторизованного юзера
    authError: req.query.authError === "true", //проверка флага ошибки в URL
  });
});
//вход пользователя
router.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body; //извлечение пароля и имени из формы
  const hashedPassword = hashPass(password); // хеширование введённого пароля
  const user = await findUserByUsername(req.db, username); // поиск пользователя в БД
  // проверка существования юзера и совпадения паролей
  if (!user || user.hashedPassword !== hashedPassword) {
    return res.redirect("/?authError=true"); // принудительная отправка браузера на другой URL с флагом ошибки
  }
  const sessionId = await createSession(req.db, user._id); // создание новой сессии в БД изменили _id
  // установка сессионной куки и переход на главную
  res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
});
//регитсрация пользователя
router.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { username, password } = req.body;
    //преобразуем пароль в хэш
    const hashedPassword = hashPass(password);
    // Проверяем, имени на занятость
    const existingUser = await findUserByUsername(req.db, username);
    if (existingUser) {
      return res.status(400).send("User already exists");
    }
    // Создаем пользователя
    const { insertedId } = await req.db.collection("users").insertOne({
      username,
      hashedPassword, // В реальных проектах пароль нужно хешировать!
    });
    const sessionId = await createSession(req.db, insertedId); // создание и запись сессии в БД
    res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/"); // запись куки сессии и переход на главную
  } catch (err) {
    res.status(500).send(err.message);
  }
});
//выход пользователя
router.get("/logout", auth(), async (req, res) => {
  // если не вошел — сразу на главную
  if (!req.user) {
    return res.redirect("/");
  }
  await deleteSession(req.db, req.sessionId); // удаление сессии из базы данных
  res.clearCookie("sessionId").redirect("/"); // очистка куки в браузере и редирект
});

// module.exports = router;
module.exports = {
  router,
  findUserByUsername,
  findUserBySessionId,
  auth,
};
