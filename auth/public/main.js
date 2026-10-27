/*global UIkit, Vue */

(() => {
  const notification = (config) =>
    UIkit.notification({
      pos: "top-right",
      timeout: 5000,
      ...config,
    });

  const alert = (message) =>
    notification({
      message,
      status: "danger",
    });

  const info = (message) =>
    notification({
      message,
      status: "success",
    });

  const fetchJson = (...args) =>
    fetch(...args)
      .then((res) =>
        res.ok
          ? res.status !== 204
            ? res.json()
            : null
          : res.text().then((text) => {
              throw new Error(text);
            })
      )
      .catch((err) => {
        alert(err.message);
      });

  new Vue({
    el: "#app",
    data: {
      desc: "",
      activeTimers: [],
      oldTimers: [],
      client: null, // Ссылка на WebSocket
    },
    methods: {
      // ИЗМЕНЕНИЕ: Методы fetchActiveTimers и fetchOldTimers удалены

      createTimer() {
        const description = this.desc;
        this.desc = "";
        fetchJson("/api/timers", {
          method: "post",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description }),
        }).then(({ id }) => {
          info(`Created new timer "${description}" [${id}]`);
          // ИЗМЕНЕНИЕ: fetchActiveTimers() больше не вызывается, ждем данные от WS
        });
      },
      stopTimer(id) {
        fetchJson(`/api/timers/${id}/stop`, {
          method: "post",
        }).then(() => {
          info(`Stopped the timer [${id}]`);
          // ИЗМЕНЕНИЕ: fetch-методы удалены, ждем данные от WS
        });
      },
      formatTime(ts) {
        return new Date(ts).toTimeString().split(" ")[0];
      },
      formatDuration(d) {
        d = Math.floor(d / 1000);
        const s = d % 60;
        d = Math.floor(d / 60);
        const m = d % 60;
        const h = Math.floor(d / 60);
        return [h > 0 ? h : null, m, s]
          .filter((x) => x !== null)
          .map((x) => (x < 10 ? "0" : "") + x)
          .join(":");
      },
    },
    created() {
      // ИЗМЕНЕНИЕ: Создание WebSocket клиента
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.client = new WebSocket(`${protocol}//${window.location.host}`);

      // ИЗМЕНЕНИЕ: Подписка на сообщения от сервера
      this.client.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);

          if (type === "all_timers") {
            // Разделяем на активные и старые
            this.activeTimers = data.filter((t) => t.isActive);
            this.oldTimers = data.filter((t) => !t.isActive);
          }

          if (type === "active_timers") {
            // Обновляем только список активных (для тикающего прогресса)
            this.activeTimers = data;
          }
        } catch (e) {
          console.error("Ошибка обработки сообщения WS:", e);
        }
      };

      this.client.onerror = () => {
        alert("Ошибка WebSocket соединения");
      };

      // ИЗМЕНЕНИЕ: Интервал fetch удален, так как сервер шлет active_timers каждую секунду сам
    },
  });
})();
