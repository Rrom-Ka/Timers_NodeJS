// const crypto = require("crypto");
// const { promisify } = require("util");

// // Превращаем функции crypto в промисы для удобного использования с async/await
// const scrypt = promisify(crypto.scrypt);

// const hashPassword = async (password) => {
//   // Генерируем случайную соль для каждого пользователя
//   const salt = crypto.randomBytes(16).toString("hex");
//   // Хэшируем пароль с солью (64 байта на выходе)
//   const derivedKey = await scrypt(password, salt, 64);
//   // Сохраняем соль вместе с хэшем через двоеточие
//   return `${salt}:${derivedKey.toString("hex")}`;
// };

// const verifyPassword = async (password, storedHash) => {
//   // Разделяем соль и хэш, которые мы сохранили в БД
//   const [salt, hash] = storedHash.split(":");
//   // Хэшируем введенный пароль с той же солью
//   const derivedKey = await scrypt(password, salt, 64);
//   // Сравниваем результат (используем timingSafeEqual для защиты от атак по времени)
//   return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey);
// };

// router.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     // 1. Хэшируем пароль функцией scrypt
//     const hashedPassword = await hashPassword(password);

//     // 2. Сохраняем строку "соль:хэш" в БД
//     const { insertedId } = await req.db.collection("users").insertOne({
//       username,
//       password: hashedPassword,
//     });

//     const sessionId = await createSession(req.db, insertedId);
//     res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
//   } catch (err) {
//     res.status(500).send(err.message);
//   }
// });

// router.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
//   const { username, password } = req.body;
//   const user = await findUserByUsername(req.db, username);

//   // Используем функцию verifyPassword для сравнения
//   if (!user || !(await verifyPassword(password, user.password))) {
//     return res.redirect("/?authError=true");
//   }

//   const sessionId = await createSession(req.db, user._id);
//   res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
// });
