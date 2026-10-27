/*global UIkit */

(() => {
  // Элементы DOM
  const inputDesc = document.querySelector("#timer-desc");
  const btnCreate = document.querySelector("#timer-create");
  const activeList = document.querySelector("#active-timers");
  const oldList = document.querySelector("#old-timers");

  const notification = (config) => UIkit.notification({ pos: "top-right", timeout: 5000, ...config });
  const alert = (msg) => notification({ message: msg, status: "danger" });
  const info = (msg) => notification({ message: msg, status: "success" });

  const fetchJson = (...args) =>
    fetch(...args)
      .then((res) => {
        if (!res.ok) {
          return res.text().then((t) => {
            throw new Error(t);
          });
        }

        if (res.status === 204) {
          return null;
        }

        return res.json();
      })
      .catch((err) => alert(err.errMessage || err.message));

  const formatTime = (ts) => new Date(ts).toTimeString().split(" ")[0];

  const formatDuration = (d) => {
    d = Math.floor(d / 1000);
    const s = d % 60,
      m = Math.floor(d / 60) % 60,
      h = Math.floor(d / 3600);
    return [h > 0 ? h : null, m, s]
      .filter((x) => x !== null)
      .map((x) => (x < 10 ? "0" : "") + x)
      .join(":");
  };

  // Отрисовка списков
  const renderTimers = (container, timers, isActive) => {
    container.innerHTML = timers
      .map(
        (t) => `
      <li>
        ${t.description} (${isActive ? formatDuration(Date.now() - t.start) : formatDuration(t.duration)})
        ${
          isActive
            ? `<button class="stop-btn" data-id="${t.id}">Stop</button>`
            : `<span>Ended at ${formatTime(t.end)}</span>`
        }
      </li>
    `
      )
      .join("");
  };

  const fetchActive = () => fetchJson("/api/timers?isActive=true").then((data) => renderTimers(activeList, data, true));
  const fetchOld = () => fetchJson("/api/timers?isActive=false").then((data) => renderTimers(oldList, data, false));

  // Обработка кликов (делегирование)
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("stop-btn")) {
      const id = e.target.dataset.id;
      fetchJson(`/api/timers/${id}/stop`, { method: "post" }).then(() => {
        info(`Stopped [${id}]`);
        fetchActive();
        fetchOld();
      });
    }
  });

  btnCreate.onclick = () => {
    const description = inputDesc.value;
    inputDesc.value = "";
    fetchJson("/api/timers", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    }).then(({ id }) => {
      info(`Created "${description}" [${id}]`);
      fetchActive();
    });
  };

  // Init
  fetchActive();
  fetchOld();
  setInterval(fetchActive, 1000);
})();
