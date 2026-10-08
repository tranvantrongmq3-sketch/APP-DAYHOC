/* responsive.js — hỗ trợ giao diện điện thoại & máy tính bảng (không phụ thuộc trang) */
(function () {
  "use strict";

  /* 1. Gắn class theo trang để CSS nhắm đúng (classroom / dashboard) */
  var page = (location.pathname.split("/").pop() || "").toLowerCase();
  function markPage() {
    if (!document.body) return;
    if (page === "classroom.html") document.body.classList.add("rs-classroom");
    if (page === "dashboard.html" || page === "") document.body.classList.add("rs-dashboard");
  }

  /* 2. Bọc <table> trong khung cuộn ngang nếu chưa có */
  function isScrollable(el) {
    var cs = el && getComputedStyle(el);
    return !!cs && /(auto|scroll)/.test(cs.overflowX);
  }
  function wrapTables(root) {
    (root || document).querySelectorAll("table").forEach(function (t) {
      var p = t.parentElement;
      if (!p || p.classList.contains("table-scroll") || isScrollable(p)) return;
      var w = document.createElement("div");
      w.className = "table-scroll";
      p.insertBefore(w, t);
      w.appendChild(t);
    });
  }

  /* 3. Cuộn tab đang chọn vào giữa thanh tab (khi thanh tab cuộn ngang) */
  function revealActiveTab() {
    var nav = document.querySelector(".top nav");
    if (!nav) return;
    var active = nav.querySelector('.active, [aria-current="page"], [aria-selected="true"]');
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }

  /* 4. Chạm ra ngoài thì đóng popover chi tiết ô TKB */
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".tkb-compact-slot")) return;
    document.querySelectorAll(".tkb-compact-slot.is-touch-open").forEach(function (s) {
      s.classList.remove("is-touch-open");
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".tkb-compact-slot.is-touch-open").forEach(function (s) {
      s.classList.remove("is-touch-open");
    });
  });

  /* 5. Bàn phím ảo che ô nhập: cuộn ô đang nhập vào vùng nhìn thấy */
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    setTimeout(function () {
      try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
    }, 320);
  });

  function init() {
    markPage();
    wrapTables();
    revealActiveTab();
    /* Bảng được JS của trang vẽ sau → theo dõi để bọc tiếp */
    if (window.MutationObserver) {
      var timer;
      new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () { wrapTables(); }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
