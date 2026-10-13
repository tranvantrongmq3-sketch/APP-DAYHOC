// =====================================================================
// tkb-schedule.js — Module tính toán Kế hoạch Dạy học & Lịch Soạn bài
// Quy tắc chuyên môn trường học: Soạn bài trước ngày dạy 1 ngày (dPrep = dTeaching - 1 ngày)
// Dùng chung đồng bộ cho cả trang Dashboard (nhắc việc) và trang Admin (kế hoạch)
// =====================================================================
import { SUBJECT_PRESETS, getSubjectPpctList } from "./ppct-manager.js";
import { todayStr } from "./firebase-config.js";

function normalizeSubject(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}

function subjectSlug(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseScheduleSlot(rawSlot, defaultSubjectId = "toan") {
  const match = String(rawSlot || "").match(/^(.+?)[-–—]\s*(.+)$/);
  const className = (match ? match[1] : String(rawSlot || "")).trim();
  const subjectLabel = match ? match[2].trim() : "";
  const normalizedLabel = normalizeSubject(subjectLabel);
  const preset = SUBJECT_PRESETS.find(subject =>
    subject.id === subjectLabel || normalizeSubject(subject.name) === normalizedLabel
  );
  const aliases = { toan: "toan", van: "van", nguvan: "van", anh: "anh", tienganh: "anh", su: "su_dia", dia: "su_dia", su_dia: "su_dia" };
  const subjectId = subjectLabel
    ? (preset?.id || aliases[subjectSlug(subjectLabel)] || subjectSlug(subjectLabel))
    : defaultSubjectId;
  const subjectName = subjectLabel ? (preset?.name || subjectLabel) :
    (SUBJECT_PRESETS.find(subject => subject.id === subjectId)?.name || subjectId);

  return { className, subjectId, subjectName };
}

export const DEFAULT_TKB_SLOTS = {
  "2_C_1": "7A4", "2_C_2": "7A4",
  "3_S_1": "9A6", "3_S_2": "9A6",
  "3_C_4": "7A7", "3_C_5": "7A7",
  "5_S_1": "9A6", "5_S_2": "9A6",
  "5_S_4": "9A4", "5_S_5": "9A4",
  "6_S_1": "9A4", "6_S_2": "9A4",
  "6_C_1": "7A7", "6_C_2": "7A7",
  "6_C_4": "7A2", "6_C_5": "7A2",
  "7_C_1": "7A4", "7_C_2": "7A4",
  "7_C_3": "7A2", "7_C_4": "7A2"
};

export const DEFAULT_TIMETABLE = {
  teacher: "Trần Văn Trọng",
  schoolYear: "2026-2027",
  weeks: "Tuần 4, 5",
  applyDate: "2026-09-28", // Thứ 2 ngày 28/09/2026
  slots: { ...DEFAULT_TKB_SLOTS }
};

export const ALLOWED_CLASS_NAMES = ["7A2", "7A4", "7A7", "9A4", "9A6"];

/**
 * Lấy các ô tiết dạy cho 1 tuần chỉ định:
 * 1. Nếu timetable có weekSlots[targetWeekNum], lấy đúng weekSlots của tuần đó.
 * 2. Nếu targetWeekNum là 4 hoặc 5 (tuần gốc ban đầu của mẫu) và timetable có slots, dùng slots mẫu.
 * 3. Với các tuần khác chưa thiết lập, trả về {} (để không bị lỗi 'tuần 5 hiện diện trên tất cả các tuần khác').
 */
export function getWeekSlots(timetable, targetWeekNum) {
  if (!timetable) return {};
  const wNum = Number(targetWeekNum);
  if (timetable.weekSlots && typeof timetable.weekSlots === "object") {
    if (timetable.weekSlots[wNum] !== undefined) {
      return timetable.weekSlots[wNum] || {};
    }
  }
  // Nếu tuần là 4 hoặc 5 và timetable có slots ban đầu chưa bị xóa
  if ((wNum === 4 || wNum === 5) && timetable.slots && Object.keys(timetable.slots).length > 0 && !timetable.cleared) {
    return { ...timetable.slots };
  }
  return {};
}

export function setWeekSlots(timetable, targetWeekNum, newSlots) {
  if (!timetable) return;
  const wNum = Number(targetWeekNum);
  if (!timetable.weekSlots || typeof timetable.weekSlots !== "object") {
    timetable.weekSlots = {};
  }
  timetable.weekSlots[wNum] = { ...(newSlots || {}) };
  timetable.slots = { ...(newSlots || {}) };
}

/**
 * Lấy dữ liệu Thời khóa biểu an toàn từ localStorage hoặc fallback mặc định
 */
export function getStoredTimetable() {
  try {
    const raw = localStorage.getItem("app_timetable");
    if (raw) {
      const parsed = JSON.parse(raw);
      const cleanedSlots = {};
      if (parsed.slots && typeof parsed.slots === "object") {
        Object.entries(parsed.slots).forEach(([k, v]) => {
          if (!v) return;
          const clsName = String(v).split(/[-–—]/)[0].trim().toUpperCase();
          if (clsName && clsName.length <= 15) {
            cleanedSlots[k] = v;
          }
        });
      }

      const weekSlots = {};
      if (parsed.weekSlots && typeof parsed.weekSlots === "object") {
        Object.entries(parsed.weekSlots).forEach(([w, slots]) => {
          if (slots && typeof slots === "object") {
            const cleanWSlots = {};
            Object.entries(slots).forEach(([k, v]) => {
              if (v) cleanWSlots[k] = v;
            });
            weekSlots[w] = cleanWSlots;
          }
        });
      }

      const isExplicitlyCleared = parsed.cleared === true || (parsed.slots && Object.keys(parsed.slots).length === 0 && (parsed.cleared || parsed.manual));

      return {
        teacher: parsed.teacher || DEFAULT_TIMETABLE.teacher,
        schoolYear: parsed.schoolYear || DEFAULT_TIMETABLE.schoolYear,
        weeks: parsed.weeks || DEFAULT_TIMETABLE.weeks,
        applyDate: parsed.applyDate || DEFAULT_TIMETABLE.applyDate,
        cleared: parsed.cleared || false,
        activeWeek: parsed.activeWeek || null,
        weekSlots,
        slots: isExplicitlyCleared ? {} : (Object.keys(cleanedSlots).length > 0
          ? cleanedSlots
          : { ...DEFAULT_TKB_SLOTS })
      };
    }
  } catch (e) {
    console.warn("Lỗi đọc app_timetable:", e);
  }
  return { ...DEFAULT_TIMETABLE, weekSlots: { 4: { ...DEFAULT_TKB_SLOTS }, 5: { ...DEFAULT_TKB_SLOTS } }, slots: { ...DEFAULT_TKB_SLOTS } };
}

/**
 * Trích xuất danh sách số thứ tự tuần từ chuỗi (VD: "Tuần 4, 5" -> [4, 5], "Tuần 1 - 35" -> [1..35])
 */
export function getAvailableWeeks(timetable) {
  const tb = timetable || getStoredTimetable();
  const str = String(tb?.weeks || "Tuần 4, 5").trim();
  const mRange = str.match(/(\d+)\s*(?:[-–—]|đến|\.\.)\s*(\d+)/i);
  if (mRange) {
    const start = parseInt(mRange[1], 10);
    const end = parseInt(mRange[2], 10);
    if (start <= end && end - start <= 52) {
      const arr = [];
      for (let i = start; i <= end; i++) arr.push(i);
      return arr;
    }
  }
  const m = str.match(/\d+/g);
  if (m && m.length > 0) {
    return Array.from(new Set(m.map(Number))).sort((a, b) => a - b);
  }
  return [4, 5];
}

export function parseFlexibleDate(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  const s = String(str).trim();
  // Khớp DD/MM/YYYY hoặc DD-MM-YYYY
  const mDmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mDmy) {
    return new Date(+mDmy[3], +mDmy[2] - 1, +mDmy[1]);
  }
  // Khớp YYYY-MM-DD hoặc YYYY/MM/DD
  const mYmd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (mYmd) {
    return new Date(+mYmd[1], +mYmd[2] - 1, +mYmd[3]);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatDateVN(dateInput) {
  const d = parseFlexibleDate(dateInput);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatFullDateVN(dateInput) {
  const d = parseFlexibleDate(dateInput);
  const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${dayName}, ngày ${day}/${month}/${year}`;
}

export function formatTimeVN(dateInput = new Date()) {
  const d = parseFlexibleDate(dateInput);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatSystemDateTimeVN(dateInput = new Date()) {
  const d = parseFlexibleDate(dateInput);
  const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = formatTimeVN(d);
  return `${dayName}, ngày ${day}/${month}/${year} · ${time}`;
}

export function toInputDateValue(dateInput) {
  const d = parseFlexibleDate(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Tính toán ngày Thứ Hai của tuần học bất kỳ theo Năm học chuẩn Việt Nam
 * Năm học 2026-2027: Tuần 1 bắt đầu từ Thứ Hai, 07/09/2026.
 * Tuần W bắt đầu từ: 07/09/2026 + (W - 1) * 7 ngày.
 */
export function getStandardSchoolWeekMonday(schoolYear = "2026-2027", weekNum = 1) {
  const m = String(schoolYear || "").match(/^(\d{4})/);
  const startYear = m ? parseInt(m[1], 10) : 2026;
  const sep5 = new Date(startYear, 8, 5); // 05/09
  const day = sep5.getDay(); // 0: CN, 1: T2, ..., 6: T7
  const diff = (day === 1) ? 0 : (day === 0 ? 1 : 8 - day);
  const week1Monday = new Date(startYear, 8, 5 + diff);
  week1Monday.setHours(0, 0, 0, 0);

  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(targetMonday.getDate() + (weekNum - 1) * 7);
  return targetMonday;
}

/**
 * Làm sạch và chuẩn hóa ngày Thứ Hai đầu tuần:
 * 1. Phát hiện và tự động sửa lỗi đảo ngược Tháng/Ngày do input/locale en-US (VD: 2026-12-10 -> 2026-10-12)
 * 2. Chuẩn hóa về đúng ngày Thứ Hai của tuần đó
 */
export function sanitizeApplyDate(dateInput, schoolYear = "2026-2027", targetWeekNum = 1) {
  if (!dateInput) {
    return getStandardSchoolWeekMonday(schoolYear, targetWeekNum || 1);
  }

  let d = parseFlexibleDate(dateInput);
  if (isNaN(d.getTime())) {
    return getStandardSchoolWeekMonday(schoolYear, targetWeekNum || 1);
  }

  // Phát hiện lỗi đảo ngược Tháng và Ngày (do browser định dạng MM/DD/YYYY)
  if (typeof dateInput === "string") {
    const m = dateInput.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) {
      const year = +m[1];
      const mon = +m[2];
      const day = +m[3];
      if (mon <= 12 && day <= 12 && mon !== day) {
        const currDayOfWeek = d.getDay(); // 1: Thứ Hai
        const swapped = new Date(year, day - 1, mon);
        const swappedDayOfWeek = swapped.getDay();
        if (currDayOfWeek !== 1 && swappedDayOfWeek === 1) {
          d = swapped;
        } else if (targetWeekNum) {
          const expected = getStandardSchoolWeekMonday(schoolYear, targetWeekNum);
          if (Math.abs(swapped - expected) < Math.abs(d - expected)) {
            d = swapped;
          }
        }
      }
    }
  }

  // Chuẩn hóa về ngày Thứ Hai của tuần đó
  const dow = d.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Lấy chính xác ngày Thứ Hai của tuần chỉ định targetWeekNum
 */
export function getWeekMonday(timetable, targetWeekNum) {
  const tb = timetable || getStoredTimetable();
  const schoolYear = tb?.schoolYear || "2026-2027";
  const allWeeks = getAvailableWeeks(tb);
  const startWeek = allWeeks[0] || 1;

  const cleanBaseMonday = sanitizeApplyDate(tb?.applyDate, schoolYear, startWeek);
  const stdWeek1Monday = getStandardSchoolWeekMonday(schoolYear, 1);
  const diffWeeks = Math.round((cleanBaseMonday - stdWeek1Monday) / (7 * 86400000));
  const detectedWeek = 1 + diffWeeks;

  if (detectedWeek >= 1 && detectedWeek <= 45) {
    const monday = new Date(cleanBaseMonday);
    monday.setDate(monday.getDate() + (targetWeekNum - detectedWeek) * 7);
    return monday;
  }
  return getStandardSchoolWeekMonday(schoolYear, targetWeekNum);
}

/**
 * Trả về danh sách 6 ngày trong tuần (Thứ 2 đến Thứ 7) cho tuần chỉ định theo chuẩn VN
 */
export function getWeekDates(applyDate, weekNum, startWeek = 4, timetable = null) {
  const tb = timetable || (applyDate ? { applyDate, weeks: `Tuần ${weekNum}` } : null);
  const monday = getWeekMonday(tb, weekNum);
  const y = monday.getFullYear();
  const m = monday.getMonth();
  const d = monday.getDate();
  const daysOfWeekNames = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const shortNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const curToday = todayStr();

  return [0, 1, 2, 3, 4, 5].map((dIdx) => {
    const dTeaching = new Date(y, m, d + dIdx);
    const dateStr = toInputDateValue(dTeaching);
    const dateVN = formatDateVN(dTeaching);
    const isToday = (dateStr === curToday);
    return {
      dayNum: dIdx + 2,
      dayName: daysOfWeekNames[dIdx],
      shortName: shortNames[dIdx],
      dateObj: dTeaching,
      dateStr,
      dateVN,
      isToday
    };
  });
}

/**
 * Tự động tính toán tuần hiện tại dựa trên ngày hôm nay và ngày bắt đầu áp dụng TKB
 * Nếu hôm nay là Chủ nhật, đó là ngày chuẩn bị bài cho Thứ 2 của tuần kế tiếp!
 */
export function getActiveWeek(timetable, curToday = todayStr()) {
  const tb = timetable || getStoredTimetable();
  const schoolYear = tb?.schoolYear || "2026-2027";
  const allWeeks = getAvailableWeeks(tb);

  const todayDate = parseFlexibleDate(curToday);
  todayDate.setHours(0, 0, 0, 0);

  const stdWeek1Monday = getStandardSchoolWeekMonday(schoolYear, 1);
  stdWeek1Monday.setHours(0, 0, 0, 0);

  const diffDays = Math.round((todayDate - stdWeek1Monday) / 86400000);
  // +1 để ngày Chủ nhật (diffDays 6, 13, 20...) tự động chuyển sang tuần kế tiếp để chuẩn bị bài cho Thứ 2
  const weekOffset = Math.floor((diffDays + 1) / 7);
  const candidateWeek = 1 + weekOffset;

  if (allWeeks.includes(candidateWeek)) return candidateWeek;
  if (candidateWeek > Math.max(...allWeeks)) return Math.max(...allWeeks);
  if (candidateWeek < Math.min(...allWeeks)) return Math.min(...allWeeks);
  return allWeeks[0] || 1;
}

/**
 * Tính toán toàn bộ danh sách tiết dạy & lịch soạn bài cho 1 tuần theo Thời khóa biểu
 * Tuân thủ tuyệt đối quy tắc: Soạn bài trước ngày dạy 1 ngày
 */
export function computeTkbSchedule({
  timetable = null,
  recentLessons = [],
  curToday = todayStr(),
  targetWeekNum = null
} = {}) {
  const tb = timetable || getStoredTimetable();
  const allWeeks = getAvailableWeeks(tb);
  const weekNum = targetWeekNum || getActiveWeek(tb, curToday);

  const baseMonday = getWeekMonday(tb, weekNum);
  const y = baseMonday.getFullYear();
  const m = baseMonday.getMonth();
  const d = baseMonday.getDate();
  const baseMondayStr = toInputDateValue(baseMonday);

  const todayDate = parseFlexibleDate(curToday);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDateStr = toInputDateValue(tomorrowDate);

  const daysOfWeekNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const prepDayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

  const scheduleList = [];
  const classCounter = {};

  const weekSlots = getWeekSlots(tb, weekNum);

  for (let dIdx = 0; dIdx < 6; dIdx++) {
    const dayNum = dIdx + 2; // 2..7
    const dayName = daysOfWeekNames[dIdx];

    // Ngày dạy (chuẩn Việt Nam DD/MM/YYYY)
    const dTeaching = new Date(y, m, d + dIdx);
    const teachDateStr = toInputDateValue(dTeaching);
    const teachDateVN = formatDateVN(dTeaching);
    const teachDateDisplay = `${dayName}, ${teachDateVN}`;

    // Hạn soạn bài trước 1 ngày (dTeaching - 1 ngày, chuẩn Việt Nam)
    const dPrep = new Date(y, m, d + dIdx - 1);
    const prepDateStr = toInputDateValue(dPrep);
    const prepDayName = prepDayNames[dPrep.getDay()];
    const prepDateVN = formatDateVN(dPrep);
    const prepDateDisplay = `${prepDayName}, ${prepDateVN}`;

    const isTeachingTomorrow = (teachDateStr === tomorrowDateStr);
    const isTeachingToday = (teachDateStr === curToday);

    ["S", "C"].forEach((sess) => {
      for (let p = 1; p <= 5; p++) {
        const key = `${dayNum}_${sess}_${p}`;
        const rawSlot = weekSlots[key] || "";
        if (!rawSlot) continue;

        const parsedSlot = parseScheduleSlot(rawSlot, tb.subjectId || "toan");
        const clsClean = parsedSlot.className.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
        const subjectKey = `${parsedSlot.subjectId}:${clsClean}`;
        const grade = clsClean.match(/^[6-9]/)?.[0] || "7";
        const ppctList = getSubjectPpctList(parsedSlot.subjectId, grade);
        const weekLessons = ppctList.filter(item => +item.week === +weekNum);

        if (!classCounter[subjectKey]) classCounter[subjectKey] = 0;
        classCounter[subjectKey]++;
        const orderInWeek = classCounter[subjectKey];

        const ppctInfo = weekLessons[orderInWeek - 1];
        const lessonsBeforeWeek = ppctList.filter(item => +item.week < +weekNum).length;
        const tietPpct = ppctInfo?.tiet || lessonsBeforeWeek + orderInWeek || orderInWeek;
        const ppctKey = `${grade}-${tietPpct}`;

        // Kiểm tra bài đã soạn kịch bản chưa
        const savedLesson = (recentLessons || []).find((l) => {
          if ((l.subjectId || "toan") !== parsedSlot.subjectId) return false;
          if (l.ppctKey && l.ppctKey === ppctKey) return true;
          if (+l.grade === +grade && +l.tiet === +tietPpct) return true;
          if (ppctInfo && l.title === ppctInfo.title && String(l.grade) === String(grade)) return true;
          return false;
        });
        const isDone = !!savedLesson;

        // Trạng thái chuẩn bị bài (Quy tắc soạn trước 1 ngày)
        let status = "future";
        if (isDone) {
          status = "done";
        } else if (curToday === prepDateStr) {
          // Hôm nay chính là hạn soạn cho bài dạy ngày mai!
          status = "urgent";
        } else if (curToday > prepDateStr) {
          // Đã qua hạn soạn (hôm qua hoặc trước đó) mà chưa có bài
          status = "overdue";
        } else {
          // Chưa đến hạn soạn
          status = "future";
        }

        scheduleList.push({
          key,
          dayNum,
          dayName,
          session: sess === "S" ? "Sáng" : "Chiều",
          period: p,
          className: clsClean,
          subjectId: parsedSlot.subjectId,
          subjectName: parsedSlot.subjectName,
          grade,
          orderInWeek,
          weekNum,
          tietPpct,
          ppctKey,
          ppctInfo,
          title: ppctInfo ? ppctInfo.title : `${parsedSlot.subjectName} lớp ${grade} - Tiết ${tietPpct}`,
          chapter: ppctInfo ? ppctInfo.chapter : "",
          teachDateStr,
          teachDateVN,
          teachDateDisplay,
          prepDateStr,
          prepDateVN,
          prepDateDisplay,
          isTeachingTomorrow,
          isTeachingToday,
          status,
          isDone,
          savedLesson
        });
      }
    });
  }

  const total = scheduleList.length;
  const urgent = scheduleList.filter((s) => s.status === "urgent").length;
  const overdue = scheduleList.filter((s) => s.status === "overdue").length;
  const done = scheduleList.filter((s) => s.status === "done").length;
  const tomorrowLessons = scheduleList.filter((s) => s.isTeachingTomorrow);
  const tomorrowCount = tomorrowLessons.length;
  const tomorrowUnprepared = tomorrowLessons.filter((s) => !s.isDone).length;

  return {
    weekNum,
    allWeeks,
    baseMondayStr,
    scheduleList,
    total,
    urgent,
    overdue,
    done,
    tomorrowCount,
    tomorrowUnprepared,
    teacher: tb.teacher,
    schoolYear: tb.schoolYear,
    applyDate: tb.applyDate
  };
}
