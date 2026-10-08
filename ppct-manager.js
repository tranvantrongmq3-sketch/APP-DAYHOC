// =====================================================================
// ppct-manager.js — Quản lý Phân phối chương trình môn Toán
// =====================================================================
import { PPCT as DEFAULT_MATH_PPCT, KIND_LABEL } from "./ppct-data.js";

export const SUBJECT_PRESETS = [
  { id: "toan", name: "Toán học", icon: "📐", grades: [7, 9] }
];

const STORAGE_KEY = "app_all_ppct_data";
const ACTIVE_SUBJECT_KEY = "app_active_subject";

/**
 * Lấy dữ liệu PPCT môn Toán và loại bỏ dữ liệu môn cũ khỏi bộ nhớ lưu trữ.
 */
export function getAllPpctData() {
  let stored = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc PPCT từ localStorage:", e);
  }

  const custom = {};
  const savedMath = stored["toan"];
  const mathData = savedMath && typeof savedMath === "object" && !Array.isArray(savedMath)
    ? savedMath
    : null;

  custom["toan"] = mathData || {
    id: "toan",
    name: "Toán học",
    icon: "📐",
    grades: {
      "7": DEFAULT_MATH_PPCT["7"] || [],
      "9": DEFAULT_MATH_PPCT["9"] || []
    }
  };
  if (!custom["toan"].grades) custom["toan"].grades = {};
  delete custom["toan"].grades["6"];
  delete custom["toan"].grades["8"];
  if (!custom["toan"].grades["7"] || !custom["toan"].grades["7"].length) {
    custom["toan"].grades["7"] = DEFAULT_MATH_PPCT["7"] || [];
  }
  if (!custom["toan"].grades["9"] || !custom["toan"].grades["9"].length) {
    custom["toan"].grades["9"] = DEFAULT_MATH_PPCT["9"] || [];
  }

  if (Object.keys(stored).some(id => id !== "toan")) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch (e) {
      console.warn("Lỗi lưu PPCT vào localStorage:", e);
    }
  }

  return custom;
}

/**
 * Lưu toàn bộ dữ liệu PPCT vào localStorage
 */
export function saveAllPpctData(allData) {
  try {
    const mathData = allData && allData["toan"];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      toan: mathData && typeof mathData === "object" && !Array.isArray(mathData) ? mathData : {
        id: "toan",
        name: "Toán học",
        icon: "📐",
        grades: {
          "7": DEFAULT_MATH_PPCT["7"] || [],
          "9": DEFAULT_MATH_PPCT["9"] || []
        }
      }
    }));
  } catch (e) {
    console.warn("Lỗi lưu PPCT vào localStorage:", e);
  }
}

/**
 * Lấy môn học hiện đang được chọn
 */
export function getActiveSubject() {
  setActiveSubject("toan");
  return "toan";
}

/**
 * Đặt môn học đang hoạt động
 */
export function setActiveSubject(subId) {
  try {
    localStorage.setItem(ACTIVE_SUBJECT_KEY, "toan");
  } catch (e) {}
}

/**
 * Lấy danh sách tiết theo môn và khối lớp
 */
export function getSubjectPpctList(subjectId = "toan", grade = "7") {
  const allData = getAllPpctData();
  const sub = allData[subjectId];
  if (sub && sub.grades && sub.grades[String(grade)]) {
    return sub.grades[String(grade)];
  }
  // Fallback môn Toán nếu có trong ppct-data
  if (subjectId === "toan" && DEFAULT_MATH_PPCT[String(grade)]) {
    return DEFAULT_MATH_PPCT[String(grade)];
  }
  return [];
}

/**
 * Lấy chi tiết 1 tiết bất kỳ (tương thích ngược với getTiet)
 */
export function getLessonPpct(grade, tiet, subjectId = null) {
  const sub = subjectId || getActiveSubject();
  const list = getSubjectPpctList(sub, String(grade));
  if (list && list.length >= tiet) {
    return list[tiet - 1];
  }
  return undefined;
}

/**
 * Phân tích file Excel PPCT do giáo viên tải lên
 * Tự động nhận diện các cột: Tiết, Tuần, Tên bài, Yêu cầu cần đạt, Tích hợp số / STEM
 */
export function parsePpctExcel(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) {
    throw new Error("File Excel không có đủ dữ liệu (ít nhất 2 dòng).");
  }

  let colTiet = -1, colWeek = -1, colTitle = -1, colReq = -1, colDigital = -1, colChapter = -1, colKind = -1;
  let headerRowIdx = -1;

  for (let rIdx = 0; rIdx < Math.min(10, sheetRows.length); rIdx++) {
    const row = sheetRows[rIdx];
    if (!Array.isArray(row)) continue;

    row.forEach((cell, cIdx) => {
      const s = String(cell || "").toLowerCase().trim();
      if (s.includes("tiết") || s === "tiet" || s === "stt") {
        if (colTiet === -1) colTiet = cIdx;
      }
      if (s.includes("tuần") || s === "tuan" || s === "week") {
        if (colWeek === -1) colWeek = cIdx;
      }
      if (s.includes("tên bài") || s.includes("bài học") || s.includes("nội dung bài") || s.includes("tên bài dạy") || s === "tên bài") {
        colTitle = cIdx;
      }
      if (s.includes("yêu cầu") || s.includes("yccd") || s.includes("mục tiêu") || s.includes("chuẩn kiến thức")) {
        colReq = cIdx;
      }
      if (s.includes("tích hợp") || s.includes("năng lực số") || s.includes("chuyển đổi số") || s.includes("stem") || s.includes("kỹ thuật số")) {
        colDigital = cIdx;
      }
      if (s.includes("chương") || s.includes("chủ đề") || s.includes("mạch kiến thức")) {
        colChapter = cIdx;
      }
      if (s.includes("loại") || s.includes("hình thức")) {
        colKind = cIdx;
      }
    });

    if (colTitle !== -1 && (colTiet !== -1 || colWeek !== -1)) {
      headerRowIdx = rIdx;
      break;
    }
  }

  // Dự phòng nếu không tìm thấy header rõ ràng: giả định thứ tự cột tiêu chuẩn
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    colTiet = 0; colWeek = 1; colTitle = 2; colChapter = 3; colReq = 4; colDigital = 5;
  }

  const result = [];
  let currentChapter = "";
  let autoTiet = 1;

  for (let rIdx = headerRowIdx + 1; rIdx < sheetRows.length; rIdx++) {
    const row = sheetRows[rIdx];
    if (!Array.isArray(row) || !row.length) continue;

    const rawTitle = colTitle !== -1 ? String(row[colTitle] || "").trim() : "";
    if (!rawTitle) continue;

    // Nhận diện dòng tên chương/chủ đề
    if (rawTitle.toLowerCase().startsWith("chương") || rawTitle.toLowerCase().startsWith("chủ đề") || rawTitle.toLowerCase().startsWith("phần")) {
      currentChapter = rawTitle;
      continue;
    }

    let tiet = autoTiet;
    if (colTiet !== -1 && row[colTiet] !== undefined && row[colTiet] !== null && String(row[colTiet]).trim() !== "") {
      const parsedTiet = parseInt(String(row[colTiet]).match(/\d+/)?.[0]);
      if (!isNaN(parsedTiet)) tiet = parsedTiet;
    }

    let week = Math.ceil(tiet / 4);
    if (colWeek !== -1 && row[colWeek] !== undefined && row[colWeek] !== null && String(row[colWeek]).trim() !== "") {
      const parsedWeek = parseInt(String(row[colWeek]).match(/\d+/)?.[0]);
      if (!isNaN(parsedWeek)) week = parsedWeek;
    }

    let chapter = currentChapter;
    if (colChapter !== -1 && row[colChapter]) {
      chapter = String(row[colChapter]).trim() || currentChapter;
    }

    let requirement = colReq !== -1 ? String(row[colReq] || "").trim() : "";
    let digital = colDigital !== -1 ? String(row[colDigital] || "").trim() : "";

    let kind = "bai";
    const lowTitle = rawTitle.toLowerCase();
    if (lowTitle.includes("ôn tập") || lowTitle.includes("on tap")) kind = "ontap";
    else if (lowTitle.includes("kiểm tra") || lowTitle.includes("kiem tra") || lowTitle.includes("đánh giá")) kind = "kiemtra";
    else if (lowTitle.includes("hoạt động") || lowTitle.includes("thực hành") || lowTitle.includes("trải nghiệm") || lowTitle.includes("stem")) kind = "hoatdong";

    result.push({
      tiet,
      week,
      title: rawTitle,
      chapter: chapter || "Chương trình chung",
      requirement,
      digital,
      kind
    });

    autoTiet = tiet + 1;
  }

  // Sắp xếp lại theo thứ tự tiết
  result.sort((a, b) => a.tiet - b.tiet);
  return result;
}
