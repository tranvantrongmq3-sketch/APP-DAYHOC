// =====================================================================
// firebase-config.js — cấu hình dùng chung cho 4 trang
// Chỉ cần dán thông tin Firebase của bạn vào MỘT chỗ này.
// Firebase Console → Project settings → Your apps → Web app → firebaseConfig
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD6O4OVcSdutAJsBBzEWyTdUKhSmw5Xmjg",
  authDomain: "tro-ly-len.firebaseapp.com",
  projectId: "tro-ly-len",
  storageBucket: "tro-ly-len.firebasestorage.app",
  messagingSenderId: "695252564585",
  appId: "1:695252564585:web:46bdb3f72736ff4e1800f8",
  measurementId: "G-JJY14EZY3E"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Chống chèn HTML khi in nội dung do AI hoặc người dùng nhập */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Phục hồi các ký tự escape LaTeX bị JSON parser làm biến dạng
 * Ví dụ: \frac bị biến thành Form Feed + rac (\x0crac)
 *        \text bị biến thành Tab + ext (\text)
 *        \times bị biến thành Tab + imes (\times)
 *        \bar bị biến thành Backspace + ar (\x08ar)
 */
export function fixLatexEscapes(str) {
  if (str === null || str === undefined) return "";
  let s = String(str);
  if (!s) return "";

  return s
    // 1. Phục hồi Form Feed (\x0c) -> \frac, \flat, \forall
    .replace(/\x0crac/g, "\\frac")
    .replace(/\x0clat/g, "\\flat")
    .replace(/\x0corall/g, "\\forall")
    .replace(/\x0c/g, "\\f")

    // 2. Phục hồi Tab (\t / \x09) -> \text, \times, \theta, \tan, \tau, \to, \top...
    .replace(/\text/g, "\\text")
    .replace(/\times/g, "\\times")
    .replace(/\theta/g, "\\theta")
    .replace(/\tan/g, "\\tan")
    .replace(/\tau/g, "\\tau")
    .replace(/\tilde/g, "\\tilde")
    .replace(/\triangle/g, "\\triangle")
    .replace(/\tiny/g, "\\tiny")
    .replace(/\to\b/g, "\\to")
    .replace(/\top\b/g, "\\top")

    // 3. Phục hồi Backspace (\x08) -> \bar, \beta, \binom, \bold, \bullet, \bot
    .replace(/\x08ar/g, "\\bar")
    .replace(/\x08eta/g, "\\beta")
    .replace(/\x08inom/g, "\\binom")
    .replace(/\x08old/g, "\\bold")
    .replace(/\x08ullet/g, "\\bullet")
    .replace(/\x08ot/g, "\\bot")
    .replace(/\x08/g, "\\b")

    // 4. Phục hồi Carriage Return (\r / \x0d) -> \right, \rho, \rangle
    .replace(/\right/g, "\\right")
    .replace(/\rho/g, "\\rho")
    .replace(/\rangle/g, "\\rangle")
    .replace(/\root/g, "\\root")

    // 5. Phục hồi Newline (\n / \x0a) -> \newline, \nu, \neq
    .replace(/\newline/g, "\\newline")
    .replace(/\notin/g, "\\notin")
    .replace(/\neq/g, "\\neq")
    .replace(/\nabla/g, "\\nabla")
    .replace(/\nu\b/g, "\\nu");
}

/**
 * Render công thức Toán học: nhận diện $...$ và $$...$$,
 * tự động phục hồi các ký tự escape LaTeX bị lỗi (\x0crac -> \frac, \text -> \text),
 * tự động phát hiện công thức LaTeX trần không có dấu $,
 * chuyển thành công thức KaTeX hoặc định dạng Toán học đẹp mắt, KHÔNG còn ký hiệu $ hay mã lỗi thô.
 */
export function renderMath(s) {
  if (s === null || s === undefined) return "";
  let text = String(s);
  if (!text) return "";

  // 1. Phục hồi các ký tự escape LaTeX bị hỏng do JSON parser (\x0crac -> \frac, \text -> \text...)
  text = fixLatexEscapes(text);

  const mathTokens = [];

  // 2. Khối $$...$$ (Display Math)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    const id = mathTokens.length;
    mathTokens.push({ formula: formula.trim(), display: true });
    return `___MATH_BLOCK_${id}___`;
  });

  // 3. Khối $...$ (Inline Math)
  text = text.replace(/\$([^\$\r\n]+?)\$/g, (match, formula) => {
    const id = mathTokens.length;
    mathTokens.push({ formula: formula.trim(), display: false });
    return `___MATH_INLINE_${id}___`;
  });

  // 4. Tự động nhận diện công thức LaTeX trần (không có cặp dấu $)
  // Ví dụ: \sin \alpha = \frac{\text{Cạnh đối}}{\text{Cạnh huyền}} = \frac{AC}{BC}.
  const hasLatex = /\\(?:frac|sqrt|sin|cos|tan|cot|alpha|beta|gamma|delta|theta|pi|cdot|times|pm|le|ge|ne|notin|in|mathbb|approx|Delta|angle|text|left|right|degree|circ)\b/i.test(text);
  if (hasLatex) {
    const trimmed = text.trim();
    // Kiểm tra xem toàn bộ chuỗi có phải là một đẳng thức/biểu thức LaTeX toán học
    const isFullFormula = /^(?:[a-zA-Z\d\(\)]+\s*=\s*)?\\(?:frac|sqrt|sin|cos|tan|cot|alpha|beta|theta|mathbb)/i.test(trimmed) ||
                         (trimmed.startsWith("\\") && trimmed.includes("="));

    if (isFullFormula && !text.includes("___MATH_")) {
      let formulaClean = trimmed;
      let trailingPunct = "";
      if (/[.,;:]$/.test(formulaClean)) {
        trailingPunct = formulaClean.slice(-1);
        formulaClean = formulaClean.slice(0, -1).trim();
      }
      const id = mathTokens.length;
      mathTokens.push({ formula: formulaClean, display: false });
      text = `___MATH_INLINE_${id}___${trailingPunct}`;
    } else {
      // Nhận diện từng cụm biểu thức LaTeX trong đoạn văn
      text = text.replace(/((?:[a-zA-Z\d\(\)]+\s*=\s*)?\\(?:frac|sqrt|sin|cos|tan|cot|alpha|beta|gamma|theta|pi|cdot|times|pm|le|ge|ne|notin|in|mathbb|approx|Delta|angle|text)\b[^\$\n\r]*?)(?=[,\.]?(?:\s+[a-zA-ZÀ-ỹ]{2,}|\s*$|[\n\r]))/g, (match, formula) => {
        let f = formula.trim();
        let punct = "";
        if (/[.,;:]$/.test(f)) {
          punct = f.slice(-1);
          f = f.slice(0, -1).trim();
        }
        const id = mathTokens.length;
        mathTokens.push({ formula: f, display: false });
        return `___MATH_INLINE_${id}___${punct}`;
      });
    }
  }

  // 5. Escape an toàn cho phần văn bản thông thường
  text = esc(text);

  // 6. Hàm render một công thức: ưu tiên KaTeX, có fallback thông minh khử hoàn toàn ký hiệu $
  const renderFormula = (formula, isDisplay) => {
    let f = fixLatexEscapes(formula).trim();

    if (typeof window !== "undefined" && window.katex) {
      try {
        return window.katex.renderToString(f, {
          displayMode: isDisplay,
          throwOnError: false
        });
      } catch (e) {
        console.warn("KaTeX renderToString error:", e);
      }
    }

    // Fallback: Làm sạch các lệnh LaTeX phổ biến để hiển thị đẹp mắt không còn ký hiệu $
    let clean = f
      .replace(/\\text\{([^}]+)\}/g, "$1")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
      .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
      .replace(/\\mathbb\{([RZQNC])\}/g, (_, symbol) => ({ R: "ℝ", Z: "ℤ", Q: "ℚ", N: "ℕ", C: "ℂ" }[symbol]))
      .replace(/\\notin\b/g, "∉")
      .replace(/\\in\b/g, "∈")
      .replace(/\\sin/g, "sin")
      .replace(/\\cos/g, "cos")
      .replace(/\\tan/g, "tan")
      .replace(/\\cot/g, "cot")
      .replace(/\\times/g, "×")
      .replace(/\\cdot/g, "·")
      .replace(/\\pm/g, "±")
      .replace(/\\le/g, "≤")
      .replace(/\\ge/g, "≥")
      .replace(/\\ne/g, "≠")
      .replace(/\\approx/g, "≈")
      .replace(/\\alpha/g, "α")
      .replace(/\\beta/g, "β")
      .replace(/\\gamma/g, "γ")
      .replace(/\\theta/g, "θ")
      .replace(/\\pi/g, "π")
      .replace(/\\Delta/g, "Δ")
      .replace(/\\degree/g, "°")
      .replace(/\\circ/g, "°")
      .replace(/\\left\s*([(\[{|])/g, "$1")
      .replace(/\\right\s*([)\]}|])/g, "$1")
      .replace(/\\,/g, " ")
      .replace(/\\;/g, " ")
      .replace(/\\quad/g, "  ")
      .replace(/\\/g, "");

    const escClean = esc(clean);
    if (isDisplay) {
      return `<div class="math-display" style="text-align:center;margin:8px 0;font-family:'Cambria Math','Times New Roman',serif;font-style:italic;color:var(--yellow,#f2d16b);font-weight:700;">${escClean}</div>`;
    }
    return `<span class="math-inline" style="font-family:'Cambria Math','Times New Roman',serif;font-style:italic;color:var(--yellow,#f2d16b);font-weight:700;padding:0 3px;">${escClean}</span>`;
  };

  // 7. Thay thế token trở lại
  text = text.replace(/___MATH_BLOCK_(\d+)___/g, (match, id) => {
    const item = mathTokens[+id];
    return item ? renderFormula(item.formula, true) : "";
  });

  text = text.replace(/___MATH_INLINE_(\d+)___/g, (match, id) => {
    const item = mathTokens[+id];
    return item ? renderFormula(item.formula, false) : "";
  });

  return text;
}

/** Ngày hôm nay dạng yyyy-mm-dd theo giờ máy */
export const todayStr = () => new Date().toLocaleDateString("sv-SE");

export const LEVEL_LABEL = { yeu: "Yếu", tb: "Trung bình", kha: "Khá", gioi: "Giỏi" };
export const STEP_LEVEL_LABEL = { de: "Dễ", vua: "Vừa", kho: "Khó" };

/**
 * Không cần đăng nhập: trang tự đăng nhập ẩn danh để Firestore nhận được yêu cầu.
 * Có timeout tự động để không bao giờ treo trang nếu mạng/Firebase lỗi.
 */
export function requireTeacher() {
  return new Promise((resolve) => {
    let resolved = false;
    const fallback = () => {
      if (!resolved) {
        resolved = true;
        resolve({ uid: "local-teacher", email: "Giáo viên" });
      }
    };
    const timer = setTimeout(fallback, 2000);
    try {
      const off = onAuthStateChanged(auth, async (user) => {
        try {
          off();
          clearTimeout(timer);
          const u = user || (await signInAnonymously(auth)).user;
          if (!resolved) {
            resolved = true;
            resolve({ uid: u.uid, email: "Giáo viên" });
          }
        } catch (e) {
          console.warn("Firebase Auth fallback to local:", e);
          fallback();
        }
      });
    } catch (e) {
      console.warn("Auth error, fallback to local:", e);
      fallback();
    }
  });
}

export function toast(msg, ms = 2600) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  if (typeof msg === "string" && (msg.includes("<a") || msg.includes("<b") || msg.includes("<div") || msg.includes("<br") || msg.includes("<span"))) {
    t.innerHTML = msg;
  } else {
    t.textContent = msg;
  }
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), ms);
}
