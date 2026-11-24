import profile from "./resume-data.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const assetUrl = (path) => new URL(path, import.meta.url).href;
const query = (selector) => document.querySelector(selector);
const page = document.body.dataset.page;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function arrow() {
  const icon = element("span", "arrow", "↗");
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function externalLink(url, className, label) {
  const parsed = new URL(url);
  if (!["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol)) {
    throw new Error("Неподдерживаемая ссылка: " + url);
  }
  const link = element("a", className, label);
  link.href = parsed.href;
  if (["https:", "http:"].includes(parsed.protocol)) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  return link;
}

function initMenu() {
  const header = query(".site-header");
  const menu = query("#site-nav");
  const toggle = query("[data-menu-toggle]");
  const setOpen = (open) => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  };
  header.classList.add("is-enhanced");
  toggle.hidden = false;
  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function startRotation({ region, controls, button, interval, advance, labels }) {
  let playing = !reducedMotion.matches;
  let onScreen = false;
  let timer;

  function schedule() {
    window.clearTimeout(timer);
    if (!playing || !onScreen || document.hidden || controls.matches(":focus-within, :hover")) return;
    timer = window.setTimeout(() => {
      advance();
      schedule();
    }, interval);
  }

  function setPlaying(next) {
    playing = next;
    button.querySelector(".play-symbol").classList.toggle("is-paused", !playing);
    const label = labels[playing ? 0 : 1];
    button.setAttribute("aria-label", label);
    button.title = label;
    schedule();
  }

  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    schedule();
  }, { threshold: 0.15 });
  observer.observe(region);
  button.addEventListener("click", () => setPlaying(!playing));
  controls.addEventListener("pointerenter", schedule);
  controls.addEventListener("pointerleave", schedule);
  controls.addEventListener("focusin", schedule);
  controls.addEventListener("focusout", () => window.requestAnimationFrame(schedule));
  document.addEventListener("visibilitychange", schedule);
  reducedMotion.addEventListener("change", (event) => setPlaying(!event.matches));
  setPlaying(playing);
}

function initHero() {
  const select = query("[data-role-selectors]");
  const label = query("[data-role-name]");
  const pause = query("[data-role-play]");
  const options = profile.roles.map((role, index) => {
    const option = element("button", "role-option");
    option.type = "button";
    option.setAttribute("aria-label", role.name);
    option.title = role.name;
    option.style.setProperty("--swatch", "var(--" + role.color + ")");
    option.addEventListener("click", () => showRole(index));
    select.append(option);
    return option;
  });
  let current = 0;
  function showRole(index, animate = true) {
    current = index;
    const role = profile.roles[index];
    label.textContent = role.name;
    label.style.setProperty("--role-color", "var(--" + role.color + ")");
    options.forEach((option, position) => option.setAttribute("aria-pressed", String(position === index)));
    if (animate && !reducedMotion.matches) {
      label.classList.remove("is-updating");
      void label.offsetWidth;
      label.classList.add("is-updating");
    }
  }
  showRole(0, false);
  if (options.length > 1) {
    pause.parentElement.hidden = false;
    startRotation({
      region: query("#home"),
      controls: pause.parentElement,
      button: pause,
      interval: 4700,
      advance: () => showRole((current + 1) % options.length),
      labels: ["Приостановить смену ролей", "Возобновить смену ролей"],
    });
  }

  const markers = [...document.querySelectorAll(".section-indicator a, .site-nav [data-home-section]")];
  const updateSection = () => {
    const sightline = Math.min(250, window.innerHeight * .36);
    const section = ["home", "documents", "skills", "projects", "experience"]
      .findLast((id) => document.getElementById(id).getBoundingClientRect().top <= sightline) || "home";
    markers.forEach((marker) => {
      if (marker.hash === "#" + section) marker.setAttribute("aria-current", "location");
      else marker.removeAttribute("aria-current");
    });
  };
  window.addEventListener("scroll", updateSection, { passive: true });
  window.addEventListener("resize", updateSection);
  updateSection();
}

function documentLink(doc) {
  const url = new URL("documents/", import.meta.url);
  url.searchParams.set("doc", doc.id);
  return url;
}

function initCarousel() {
  const carousel = query("[data-carousel]");
  const stage = query("[data-carousel-stage]");
  const controls = query("[data-carousel-controls]");
  const count = query("[data-carousel-count]");
  const documents = profile.documents;
  if (!documents.length) {
    stage.append(element("p", "empty-state", "Документы появятся здесь после добавления."));
    return;
  }
  const cards = documents.map((doc) => {
    const card = element("a", "carousel-card");
    card.href = documentLink(doc);
    card.setAttribute("aria-label", doc.title + (doc.example ? " · образец" : ""));
    card.title = doc.title;
    const preview = element("img");
    preview.alt = "";
    preview.loading = "lazy";
    card.append(preview);
    stage.append(card);
    return { card, preview, source: doc.pages[0] };
  });
  let current = 0;
  function showCard(index) {
    current = (documents.length + index) % documents.length;
    count.textContent = String(current + 1).padStart(2, "0") + " / " + String(documents.length).padStart(2, "0");
    cards.forEach(({ card, preview, source }, position) => {
      let offset = (position - current + cards.length) % cards.length;
      if (offset > cards.length / 2) offset -= cards.length;
      const visible = Math.abs(offset) <= 2;
      if (visible && !preview.hasAttribute("src")) preview.src = assetUrl(source);
      card.dataset.position = visible ? String(offset) : "off";
      card.style.setProperty("--offset", offset);
      card.tabIndex = visible ? 0 : -1;
      card.setAttribute("aria-hidden", String(!visible));
      if (offset === 0) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    });
  }
  showCard(0);
  if (documents.length === 1) return;
  controls.hidden = false;
  query("[data-carousel-prev]").addEventListener("click", () => showCard(current - 1));
  query("[data-carousel-next]").addEventListener("click", () => showCard(current + 1));
  startRotation({
    region: carousel,
    controls: carousel,
    button: query("[data-carousel-play]"),
    interval: 5200,
    advance: () => showCard(current + 1),
    labels: ["Приостановить галерею", "Возобновить галерею"],
  });
}

function renderSkills() {
  const groups = query("[data-skills]");
  for (const group of profile.skills) {
    const section = element("section", "skill-group");
    const list = element("ul", "skill-tags");
    list.setAttribute("role", "list");
    for (const skill of group.items) list.append(element("li", "skill-tag", skill));
    section.append(element("h3", "", group.title), list);
    groups.append(section);
  }
}

function renderProjects() {
  const projects = query("[data-projects]");
  profile.projects.forEach((project, index) => {
    const details = element("details", "project");
    details.name = "side-projects";
    details.open = index === 0;
    const summary = element("summary");
    const glyph = element("span", "project-glyph");
    const toggle = element("span", "project-toggle");
    glyph.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-hidden", "true");
    const headings = element("span", "project-label");
    headings.append(element("span", "project-category", project.category), element("span", "project-name", project.name));
    summary.append(glyph, headings, toggle);

    const body = element("div", "project-body");
    body.append(element("p", "", project.description));
    const stack = element("ul", "project-stack");
    stack.setAttribute("role", "list");
    for (const tool of project.stack) stack.append(element("li", "", tool));
    const links = element("div", "project-links");
    for (const [url, label] of [[project.demo, "Смотреть демо"], [project.repository, "Код на GitHub"]]) {
      if (!url) continue;
      const link = externalLink(url, "text-link", label);
      link.append(arrow());
      links.append(link);
    }
    body.append(stack, links);
    details.append(summary, body);
    projects.append(details);
  });
}

function renderExperience() {
  const grid = query("[data-experience]");
  for (const item of profile.experience) {
    const tile = item.url ? externalLink(item.url, "work-tile") : element("article", "work-tile");
    if (item.logo) {
      const logo = element("img", "work-logo");
      logo.src = assetUrl(item.logo);
      logo.alt = item.name;
      logo.loading = "lazy";
      tile.append(logo);
    } else {
      tile.append(element("h3", "work-wordmark", item.name));
    }
    if (item.description) tile.append(element("p", "work-role", item.description));
    if (item.url) tile.append(arrow());
    grid.append(tile);
  }
}

function initArchive() {
  const documents = profile.documents;
  if (!documents.length) {
    query("[data-documents-empty]").hidden = false;
    return;
  }

  const viewer = query("[data-document-viewer]");
  const stage = query("[data-document-stage]");
  const sheet = query("[data-document-sheet]");
  const front = query("[data-document-front]");
  const back = query("[data-document-back]");
  const description = query("[data-document-description]");
  const title = query("[data-document-name]");
  const type = query("[data-document-type]");
  const meta = query("[data-document-meta]");
  const original = query("[data-document-original]");
  const list = query("[data-document-list]");
  const pageControls = query("[data-page-controls]");
  const pageCount = query("[data-page-count]");
  const previous = query("[data-page-prev]");
  const next = query("[data-page-next]");
  const dialog = query("[data-image-dialog]");
  const fullImage = query("[data-full-image]");
  const fullTitle = query("[data-full-image-title]");
  const baseAngle = -10;
  let pitch = -3;
  let yaw = baseAngle;
  let capture = null;
  let selected = 0;
  let currentPage = 0;

  function rotate(x, y) {
    pitch = x;
    yaw = y;
    sheet.style.setProperty("--rotate-x", pitch + "deg");
    sheet.style.setProperty("--rotate-y", yaw + "deg");
  }

  function resetRotation() {
    rotate(-3, Math.round((yaw - baseAngle) / 360) * 360 + baseAngle);
  }

  const items = documents.map((doc, index) => {
    const item = element("a", "archive-item");
    item.href = documentLink(doc);
    const thumbnail = element("img");
    thumbnail.src = assetUrl(doc.pages[0]);
    thumbnail.alt = "";
    thumbnail.loading = "lazy";
    item.append(thumbnail, element("span", "", doc.title + (doc.example ? " · образец" : "")));
    item.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showDocument(index);
      viewer.scrollIntoView({ block: "start" });
    });
    list.append(item);
    return item;
  });

  function showPage(index, updateUrl = true) {
    const doc = documents[selected];
    currentPage = Math.max(0, Math.min(index, doc.pages.length - 1));
    const url = assetUrl(doc.pages[currentPage]);
    front.src = url;
    back.src = url;
    front.alt = doc.title + " — страница " + (currentPage + 1);
    original.href = url;
    pageControls.hidden = doc.pages.length === 1;
    pageCount.textContent = (currentPage + 1) + " / " + doc.pages.length;
    previous.disabled = currentPage === 0;
    next.disabled = currentPage === doc.pages.length - 1;
    resetRotation();
    if (updateUrl) {
      const address = new URL(window.location.href);
      address.searchParams.set("doc", doc.id);
      if (currentPage > 0) address.searchParams.set("page", String(currentPage + 1));
      else address.searchParams.delete("page");
      window.history.replaceState(null, "", address);
    }
  }

  function showDocument(index, initialPage = 0, updateUrl = true) {
    selected = index;
    const doc = documents[index];
    type.textContent = doc.type + (doc.example ? " · образец" : "");
    title.textContent = doc.title;
    description.textContent = doc.description;
    meta.replaceChildren();
    for (const [term, value] of [["Организация", doc.issuer], ["Год", doc.year]]) {
      if (value) meta.append(element("dt", "", term), element("dd", "", value));
    }
    items.forEach((item, position) => {
      if (position === selected) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
    showPage(initialPage, updateUrl);
  }

  stage.addEventListener("pointerdown", (event) => {
    if (capture || !event.isPrimary || event.button !== 0 || event.target.closest("button")) return;
    capture = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch, yaw };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (event) => {
    if (capture?.id !== event.pointerId) return;
    const tilt = Math.max(-36, Math.min(36, capture.pitch - (event.clientY - capture.y) * .24));
    rotate(tilt, capture.yaw + (event.clientX - capture.x) * .62);
  });
  stage.addEventListener("lostpointercapture", (event) => {
    if (capture?.id !== event.pointerId) return;
    capture = null;
    stage.classList.remove("is-dragging");
  });

  query("[data-rotate-left]").addEventListener("click", () => rotate(pitch, yaw - 45));
  query("[data-rotate-right]").addEventListener("click", () => rotate(pitch, yaw + 45));
  query("[data-rotate-reset]").addEventListener("click", resetRotation);
  previous.addEventListener("click", () => showPage(currentPage - 1));
  next.addEventListener("click", () => showPage(currentPage + 1));
  query("[data-document-enlarge]").addEventListener("click", () => {
    fullImage.src = front.src;
    fullImage.alt = front.alt;
    fullTitle.textContent = front.alt;
    dialog.showModal();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const selectedDocument = Math.max(0, documents.findIndex((doc) => doc.id === params.get("doc")));
  const requestedPage = Number.parseInt(params.get("page"), 10) || 1;
  showDocument(selectedDocument, requestedPage - 1, false);
  viewer.hidden = false;
  query("[data-archive-list]").hidden = false;
}

function renderContacts() {
  const methods = query("[data-contacts]");
  for (const contact of profile.contacts) {
    const link = externalLink(contact.url, "button button-outline contact-method");
    const label = element("span");
    label.append(element("strong", "", contact.label), element("small", "", contact.value));
    link.append(label, arrow());
    methods.append(link);
  }
}

initMenu();
if (page === "home") {
  initHero();
  initCarousel();
  renderSkills();
  renderProjects();
  renderExperience();
} else if (page === "documents") {
  initArchive();
} else if (page === "contacts") {
  renderContacts();
}
