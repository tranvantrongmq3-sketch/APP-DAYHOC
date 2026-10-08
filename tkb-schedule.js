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
          if (ALLOWED_CLASS_NAMES.includes(clsName)) {
            cleanedSlots[k] = v;
          }
        });
      }

      return {
        teacher: parsed.teacher || DEFAULT_TIMETABLE.teacher,
        schoolYear: parsed.schoolYear || DEFAULT_TIMETABLE.schoolYear,
        weeks: parsed.weeks || DEFAULT_TIMETABLE.weeks,
        applyDate: parsed.applyDate || DEFAULT_TIMETABLE.applyDate,
        slots: Object.keys(cleanedSlots).length > 0
          ? cleanedSlots
          : { ...DEFAULT_TKB_SLOTS }
      };
    }
  } catch (e) {
    console.warn("Lỗi đọc app_timetable:", e);
  }
  return { ...DEFAULT_TIMETABLE, slots: { ...DEFAULT_TKB_SLOTS } };
}

/**
 * Trích xuất danh sách số thứ tự tuần từ chuỗi (VD: "Tuần 4, 5" -> [4, 5])
 */
export function getAvailableWeeks(timetable) {
  const tb = timetable || getStoredTimetable();
  const m = (tb.weeks || "").match(/\d+/g);
  if (m && m.length > 0) {
    return m.map(Number);
  }
  return [4];
}

/**
 * Tự động tính toán tuần hiện tại dựa trên ngày hôm nay và ngày bắt đầu áp dụng TKB
 * Nếu hôm nay là Chủ nhật, đó là ngày chuẩn bị bài cho Thứ 2 của tuần kế tiếp!
 */
export function getActiveWeek(timetable, curToday = todayStr()) {
  const tb = timetable || getStoredTimetable();
  const allWeeks = getAvailableWeeks(tb);
  const startWeek = allWeeks[0] || 4;

  const applyDateStr = (tb.applyDate || "2026-09-28").trim();
  const [y, m, d] = applyDateStr.split("-").map(Number);
  const mondayStart = new Date(y, m - 1, d);

  const [cy, cm, cd] = curToday.split("-").map(Number);
  const todayDate = new Date(cy, cm - 1, cd);

  const diffDays = Math.round((todayDate - mondayStart) / 86400000);
  // +1 để ngày Chủ nhật (diffDays 6, 13...) tính vào chuẩn bị cho tuần tới
  const weekOffset = Math.floor((diffDays + 1) / 7);
  const candidateWeek = startWeek + weekOffset;

  if (allWeeks.includes(candidateWeek)) return candidateWeek;
  if (candidateWeek > Math.max(...allWeeks)) return Math.max(...allWeeks);
  if (candidateWeek < Math.min(...allWeeks)) return Math.min(...allWeeks);
  return startWeek;
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
  const startWeek = allWeeks[0] || 4;

  const weekNum = targetWeekNum || getActiveWeek(tb, curToday);
  const weekDelta = weekNum - startWeek;

  const applyDateStr = (tb.applyDate || "2026-09-28").trim();
  const [y, m, d] = applyDateStr.split("-").map(Number);
  const baseMonday = new Date(y, m - 1, d + weekDelta * 7);
  const baseMondayStr = baseMonday.toLocaleDateString("sv-SE");

  const [cy, cm, cd] = curToday.split("-").map(Number);
  const todayDate = new Date(cy, cm - 1, cd);
  const tomorrowDate = new Date(cy, cm - 1, cd + 1);
  const tomorrowDateStr = tomorrowDate.toLocaleDateString("sv-SE");

  const daysOfWeekNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const prepDayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

  const scheduleList = [];
  const classCounter = {};

  for (let dIdx = 0; dIdx < 6; dIdx++) {
    const dayNum = dIdx + 2; // 2..7
    const dayName = daysOfWeekNames[dIdx];

    // Ngày dạy
    const dTeaching = new Date(y, m - 1, d + weekDelta * 7 + dIdx);
    const teachDateStr = dTeaching.toLocaleDateString("sv-SE");
    const teachDateDisplay = `${dayName}, ${String(dTeaching.getDate()).padStart(2, "0")}/${String(dTeaching.getMonth() + 1).padStart(2, "0")}/${dTeaching.getFullYear()}`;

    // Hạn soạn bài trước 1 ngày (dTeaching - 1 ngày)
    const dPrep = new Date(y, m - 1, d + weekDelta * 7 + dIdx - 1);
    const prepDateStr = dPrep.toLocaleDateString("sv-SE");
    const prepDayName = prepDayNames[dPrep.getDay()];
    const prepDateDisplay = `${prepDayName}, ${String(dPrep.getDate()).padStart(2, "0")}/${String(dPrep.getMonth() + 1).padStart(2, "0")}`;

    const isTeachingTomorrow = (teachDateStr === tomorrowDateStr);
    const isTeachingToday = (teachDateStr === curToday);

    ["S", "C"].forEach((sess) => {
      for (let p = 1; p <= 5; p++) {
        const key = `${dayNum}_${sess}_${p}`;
        const rawSlot = (tb.slots && tb.slots[key]) || "";
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
          teachDateDisplay,
          prepDateStr,
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
