(function () {
  var STORAGE_KEY = "ab-ural-projects-v1";
  var TYPE_LABEL = {
    "жилой": "Жилой",
    "коммерческий": "Коммерческий",
    "промышленный": "Промышленный",
    "другой": "Другой"
  };

  var config = window.SITE_CONFIG || {};
  var defaults = clone(window.PROJECTS || []);
  var projects = readStored() || clone(defaults);
  var filter = "all";
  var pendingImage = "";

  var grid = document.getElementById("projects-grid");
  var empty = document.getElementById("projects-empty");
  var status = document.getElementById("projects-status");
  var editor = document.getElementById("editor");
  var editorList = document.getElementById("editor-list");
  var editorForm = document.getElementById("editor-form");
  var editorError = document.getElementById("editor-error");
  var editorStatus = document.getElementById("editor-status");
  var preview = document.getElementById("editor-preview");
  var requestForm = document.getElementById("request-form");

  setupReveal();
  renderProjects();
  renderEditorList();
  setupNav();
  setupFilters();
  setupRequest();
  setupEditor();
  setupContacts();

  var revealObserver = null;

  function setupReveal() {
    var selectors = [
      ".prose",
      ".about-gallery",
      "#services .section-label",
      "#services h2",
      ".service",
      ".section-head",
      ".filters",
      ".adv",
      "#advantages .section-label",
      "#advantages h2",
      "#process .section-label",
      "#process h2",
      ".step",
      ".band",
      ".request-copy",
      ".form"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(function (node) {
      node.classList.add("reveal");
    });

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.16, rootMargin: "0px 0px -32px 0px" });
    }

    watchReveals(document.querySelectorAll(".reveal"));
  }

  function watchReveals(nodes) {
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.classList.contains("is-in")) return;
      if (!revealObserver) {
        node.classList.add("is-in");
        return;
      }
      revealObserver.observe(node);
    });
  }

  function setupNav() {
    var burger = document.querySelector(".burger");
    var nav = document.getElementById("nav");

    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeNav();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) closeNav();
    });

    var links = nav.querySelectorAll('a[href^="#"]:not(.btn)');
    var sections = Array.prototype.map.call(links, function (link) {
      return document.querySelector(link.getAttribute("href"));
    }).filter(Boolean);

    if ("IntersectionObserver" in window) {
      var current = null;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) current = entry.target.id;
        });
        links.forEach(function (link) {
          var active = link.getAttribute("href") === "#" + current;
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (section) { observer.observe(section); });
    }

    function closeNav() {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Открыть меню");
    }
  }

  function setupFilters() {
    document.querySelector(".filters").addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      filter = button.getAttribute("data-filter");
      document.querySelectorAll(".filter").forEach(function (item) {
        var active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderProjects();
    });
  }

  function setupRequest() {
    document.querySelectorAll(".js-request").forEach(function (link) {
      link.addEventListener("click", clearProject);
    });

    document.getElementById("clear-project").addEventListener("click", clearProject);

    grid.addEventListener("click", function (event) {
      var button = event.target.closest("[data-project]");
      if (!button) return;
      var project = projects.find(function (item) { return item.id === button.getAttribute("data-project"); });
      if (!project) return;
      document.getElementById("project-name").value = project.title;
      var note = document.getElementById("project-note");
      note.hidden = false;
      note.querySelector("span").textContent = "Проект: " + project.title;
      document.getElementById("request").scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
      document.getElementById("name").focus({ preventScroll: true });
    });

    var hint = document.getElementById("form-hint");
    requestForm.addEventListener("submit", onSubmit);
    document.getElementById("form-again").addEventListener("click", function () {
      requestForm.reset();
      clearProject();
      clearErrors();
      document.getElementById("form-success").hidden = true;
      requestForm.querySelectorAll(".field, .form-row, #submit-btn").forEach(function (node) {
        node.hidden = false;
      });
      document.getElementById("submit-btn").disabled = false;
      hint.hidden = true;
    });
  }

  function onSubmit(event) {
    event.preventDefault();
    if (document.getElementById("company").value) {
      showSuccess("Заявка принята", "Спасибо. Мы посмотрим задачу и вернёмся с составом проектных работ.");
      return;
    }

    var data = {
      name: valueOf("name").trim(),
      phone: valueOf("phone").trim(),
      email: valueOf("email").trim(),
      objectType: valueOf("object-type"),
      message: valueOf("message").trim(),
      project: valueOf("project-name").trim()
    };

    var errors = {};
    if (data.name.length < 2) errors.name = "Укажите имя.";
    if (data.phone.replace(/\D/g, "").length < 10) errors.phone = "Укажите телефон с кодом, не короче 10 цифр.";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Проверьте написание почты.";
    if (data.message.length < 10) errors.message = "Коротко опишите объект и задачу — хотя бы пару слов.";

    requestForm.querySelectorAll(".field").forEach(function (field) {
      var input = field.querySelector("input, textarea");
      var error = field.querySelector(".field-error");
      if (!input || !error || !input.id) return;
      var message = errors[input.id] || "";
      field.classList.toggle("is-invalid", Boolean(message));
      error.hidden = !message;
      error.textContent = message;
    });

    if (Object.keys(errors).length) {
      var firstInvalid = requestForm.querySelector(".is-invalid input, .is-invalid textarea");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var button = document.getElementById("submit-btn");
    button.disabled = true;

    if (hasEndpoint()) {
      fetch(config.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (response) {
        if (!response.ok) throw new Error("status");
        showSuccess("Заявка отправлена", "Спасибо. Обсудим состав проектных работ и подготовим предложение с учётом ваших требований.");
      }).catch(function () {
        showSuccess("Не удалось отправить", "Сервис приёма заявок не ответил. Напишите на почту бюро или попробуйте ещё раз чуть позже.");
      }).finally(function () {
        button.disabled = false;
      });
      return;
    }

    button.disabled = false;

    if (hasEmail()) {
      var body = [
        "Имя: " + data.name,
        "Телефон: " + data.phone,
        data.email ? "Почта: " + data.email : "",
        data.objectType ? "Тип объекта: " + data.objectType : "",
        data.project ? "Проект: " + data.project : "",
        "",
        data.message
      ].filter(Boolean).join("\n");
      window.location.href = "mailto:" + config.email
        + "?subject=" + encodeURIComponent("Заявка с сайта — Архитектурное бюро Урал")
        + "&body=" + encodeURIComponent(body);
      showSuccess("Откройте письмо и отправьте его", "Почтовая программа получила текст заявки. Письмо дойдёт до бюро после отправки.");
      return;
    }

    showSuccess("Почта для заявок не указана", "Текст заявки остался только на этой странице. Добавьте адрес в js/config.js — тогда кнопка будет открывать письмо или отправлять форму.");
  }

  function showSuccess(title, text) {
    requestForm.querySelectorAll(".field, .form-row, .form-hint, #submit-btn, #project-note").forEach(function (node) {
      node.hidden = true;
    });
    document.getElementById("success-title").textContent = title;
    document.getElementById("success-text").textContent = text;
    document.getElementById("form-success").hidden = false;
  }

  function clearErrors() {
    requestForm.querySelectorAll(".field").forEach(function (field) {
      field.classList.remove("is-invalid");
      var error = field.querySelector(".field-error");
      if (error) {
        error.hidden = true;
        error.textContent = "";
      }
    });
  }

  function clearProject() {
    document.getElementById("project-name").value = "";
    document.getElementById("project-note").hidden = true;
  }

  function setupContacts() {
    var box = document.getElementById("footer-contacts");
    var parts = [];
    if (hasEmail()) {
      var mail = document.createElement("a");
      mail.href = "mailto:" + config.email;
      mail.textContent = config.email;
      parts.push(mail);
    }
    if (config.phone && String(config.phone).trim()) {
      var phone = document.createElement("a");
      phone.href = "tel:" + String(config.phone).replace(/[^\d+]/g, "");
      phone.textContent = String(config.phone).trim();
      parts.push(phone);
    }
    parts.forEach(function (node, index) {
      if (index) box.appendChild(document.createTextNode(" · "));
      box.appendChild(node);
    });
  }

  function setupEditor() {
    document.querySelectorAll(".js-open-editor").forEach(function (button) {
      button.addEventListener("click", function () {
        editorError.hidden = true;
        editor.showModal();
      });
    });

    document.getElementById("editor-close").addEventListener("click", function () {
      editor.close();
    });

    document.getElementById("edit-file").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      pendingImage = "";
      if (!file) {
        updatePreview(document.getElementById("edit-path").value);
        return;
      }
      resizeImage(file).then(function (url) {
        pendingImage = url;
        updatePreview(url);
        editorError.hidden = true;
      }).catch(function () {
        pendingImage = "";
        showEditorError("Не удалось прочитать изображение. Нужен файл JPG, PNG или WebP.");
      });
    });

    document.getElementById("edit-path").addEventListener("input", function (event) {
      if (!pendingImage) updatePreview(event.target.value.trim());
    });

    editorForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var id = document.getElementById("edit-id").value;
      var title = document.getElementById("edit-title").value.trim();
      var type = document.getElementById("edit-type").value;
      var location = document.getElementById("edit-location").value.trim();
      var path = document.getElementById("edit-path").value.trim();
      var existing = projects.find(function (item) { return item.id === id; });
      var image = pendingImage || path || (existing ? existing.image : "");

      if (title.length < 2) return showEditorError("Укажите название проекта.");
      if (!TYPE_LABEL[type]) return showEditorError("Выберите тип объекта.");
      if (location.length < 2) return showEditorError("Укажите город или регион.");
      if (!image) return showEditorError("Добавьте изображение: файл или путь вида images/photo.jpg.");

      var project = {
        id: id || ("p-" + Date.now().toString(36)),
        title: title,
        type: type,
        location: location,
        image: image,
        alt: title + ", " + location
      };

      if (existing) {
        var index = projects.indexOf(existing);
        projects[index] = project;
      } else {
        projects.push(project);
      }

      if (!persist()) return;
      pendingImage = "";
      renderProjects();
      renderEditorList();
      fillEditorForm(null);
      editorStatus.textContent = "Сохранено в этом браузере.";
    });

    document.getElementById("editor-reset-form").addEventListener("click", function () {
      fillEditorForm(null);
    });

    document.getElementById("editor-delete").addEventListener("click", function () {
      var id = document.getElementById("edit-id").value;
      var project = projects.find(function (item) { return item.id === id; });
      if (!project) return;
      if (!window.confirm("Удалить проект «" + project.title + "»?")) return;
      projects = projects.filter(function (item) { return item.id !== id; });
      if (!persist()) return;
      renderProjects();
      renderEditorList();
      fillEditorForm(null);
      editorStatus.textContent = "Проект удалён в этом браузере.";
    });

    editorList.addEventListener("click", function (event) {
      var edit = event.target.closest("[data-edit]");
      var move = event.target.closest("[data-move]");
      if (edit) {
        var project = projects.find(function (item) { return item.id === edit.getAttribute("data-edit"); });
        fillEditorForm(project);
        return;
      }
      if (!move) return;
      var from = Number(move.getAttribute("data-index"));
      var dir = Number(move.getAttribute("data-move"));
      var to = from + dir;
      if (to < 0 || to >= projects.length) return;
      var moved = projects.splice(from, 1)[0];
      projects.splice(to, 0, moved);
      if (!persist()) return;
      renderProjects();
      renderEditorList();
    });

    document.getElementById("editor-download").addEventListener("click", downloadProjects);
    document.getElementById("editor-import").addEventListener("change", importProjects);
    document.getElementById("editor-restore").addEventListener("click", function () {
      if (!window.confirm("Удалить локальные правки и вернуть проекты из файла js/projects.js?")) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* остаётся файл */ }
      projects = clone(defaults);
      renderProjects();
      renderEditorList();
      fillEditorForm(null);
      editorStatus.textContent = "Показаны проекты из файла.";
    });
  }

  function renderProjects() {
    var visible = projects.filter(function (project) {
      return filter === "all" || project.type === filter;
    });
    grid.replaceChildren();
    visible.forEach(function (project) {
      var card = document.createElement("article");
      card.className = "card reveal";

      var media = document.createElement("div");
      media.className = "card-media";
      var image = document.createElement("img");
      image.src = project.image;
      image.alt = project.alt || project.title;
      image.width = 1024;
      image.height = 640;
      image.loading = "lazy";
      media.appendChild(image);

      var type = document.createElement("p");
      type.className = "card-type";
      type.textContent = TYPE_LABEL[project.type] || "Другой";

      var title = document.createElement("h3");
      title.textContent = project.title;

      var location = document.createElement("p");
      location.className = "card-location";
      location.textContent = project.location;

      var button = document.createElement("button");
      button.className = "btn btn-small";
      button.type = "button";
      button.setAttribute("data-project", project.id);
      button.textContent = "Подробнее";
      button.setAttribute("aria-label", "Подробнее о проекте «" + project.title + "»");

      card.append(media, type, title, location, button);
      grid.appendChild(card);
    });

    watchReveals(grid.querySelectorAll(".reveal"));

    empty.hidden = visible.length !== 0;
    var noun = plural(visible.length, ["проект", "проекта", "проектов"]);
    status.textContent = visible.length
      ? "Показано " + visible.length + " " + noun
      : "В этой категории нет проектов";
  }

  function renderEditorList() {
    editorList.replaceChildren();
    if (!projects.length) {
      var note = document.createElement("p");
      note.textContent = "Пока нет ни одной карточки.";
      editorList.appendChild(note);
      return;
    }
    projects.forEach(function (project, index) {
      var row = document.createElement("article");
      row.className = "editor-item";

      var image = document.createElement("img");
      image.src = project.image;
      image.alt = "";

      var text = document.createElement("p");
      text.appendChild(document.createTextNode(project.title));
      text.appendChild(document.createElement("br"));
      var meta = document.createElement("small");
      meta.textContent = (TYPE_LABEL[project.type] || "Другой") + " · " + project.location;
      text.appendChild(meta);

      var controls = document.createElement("div");
      controls.className = "editor-controls";
      controls.appendChild(miniButton("Изменить", { "data-edit": project.id }));
      if (index > 0) controls.appendChild(document.createTextNode(" "));
      if (index > 0) controls.appendChild(miniButton("Выше", { "data-move": "-1", "data-index": String(index) }));
      if (index < projects.length - 1) controls.appendChild(document.createTextNode(" "));
      if (index < projects.length - 1) controls.appendChild(miniButton("Ниже", { "data-move": "1", "data-index": String(index) }));

      row.append(image, text, controls);
      editorList.appendChild(row);
    });
  }

  function fillEditorForm(project) {
    pendingImage = "";
    editorError.hidden = true;
    editorStatus.textContent = "";
    document.getElementById("editor-form-title").textContent = project ? "Редактирование" : "Новый проект";
    document.getElementById("edit-id").value = project ? project.id : "";
    document.getElementById("edit-title").value = project ? project.title : "";
    document.getElementById("edit-type").value = project ? project.type : "жилой";
    document.getElementById("edit-location").value = project ? project.location : "";
    document.getElementById("edit-path").value = project && project.image.indexOf("data:") !== 0 ? project.image : "";
    document.getElementById("edit-file").value = "";
    document.getElementById("editor-delete").hidden = !project;
    updatePreview(project ? project.image : "");
  }

  function updatePreview(src) {
    preview.hidden = !src;
    preview.replaceChildren();
    if (!src) return;
    var image = document.createElement("img");
    image.src = src;
    image.alt = "Предпросмотр изображения проекта";
    preview.appendChild(image);
  }

  function showEditorError(message) {
    editorError.hidden = false;
    editorError.textContent = message;
    editorStatus.textContent = "";
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      showEditorError("Браузер не сохранил карточки: слишком большой объём снимков. Уменьшите фото или укажите путь к файлу в папке images.");
      return false;
    }
  }

  function downloadProjects() {
    var content = "/* Обновлённый список проектов. Замените им js/projects.js */\nwindow.PROJECTS = " + JSON.stringify(projects, null, 2) + ";\n";
    var blob = new Blob([content], { type: "text/javascript" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "projects.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
    editorStatus.textContent = "Файл projects.js скачан. Замените им js/projects.js на сайте.";
  }

  function importProjects(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || "");
        var start = text.indexOf("[");
        var end = text.lastIndexOf("]");
        if (start < 0 || end < start) throw new Error("format");
        var data = JSON.parse(text.slice(start, end + 1));
        if (!Array.isArray(data) || !data.length) throw new Error("empty");
        var next = data.map(normalizeProject);
        projects = next;
        if (!persist()) return;
        renderProjects();
        renderEditorList();
        fillEditorForm(null);
        editorStatus.textContent = "Список проектов загружен в этот браузер.";
      } catch (err) {
        showEditorError("Файл не похож на список проектов. Нужен projects.js или JSON-массив.");
      }
    };
    reader.readAsText(file);
  }

  function normalizeProject(item) {
    var type = TYPE_LABEL[item.type] ? item.type : "другой";
    return {
      id: String(item.id || ("p-" + Math.random().toString(36).slice(2, 8))),
      title: String(item.title || "Без названия"),
      type: type,
      location: String(item.location || ""),
      image: String(item.image || ""),
      alt: String(item.alt || item.title || "Проект")
    };
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        reject(new Error("type"));
        return;
      }
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        var maxSide = 1400;
        var scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("load"));
      };
      image.src = url;
    });
  }

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return null;
      return data.map(normalizeProject);
    } catch (err) {
      return null;
    }
  }

  function miniButton(label, attrs) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "text-btn";
    button.textContent = label;
    Object.keys(attrs).forEach(function (key) {
      button.setAttribute(key, attrs[key]);
    });
    return button;
  }

  function valueOf(id) {
    return document.getElementById(id).value;
  }

  function hasEmail() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(config.email || "")) && !/example\.com$/i.test(config.email);
  }

  function hasEndpoint() {
    return /^https?:\/\//i.test(String(config.formEndpoint || ""));
  }

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function plural(count, forms) {
    var n = Math.abs(count) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
})();
