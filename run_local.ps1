$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = @"
<!DOCTYPE html><html><body><pre id="out"></pre>
<script>
    const DEFAULT_TKB_SLOTS = {
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

    const MATH_PPCT_FALLBACK = {
      "7": [
        { tiet: 13, week: 4, title: "Luyện tập chung (Tiết 2)", chapter: "Chương I. Số hữu tỉ" },
        { tiet: 14, week: 4, title: "Bài tập cuối chương I", chapter: "Chương I. Số hữu tỉ" },
        { tiet: 15, week: 4, title: "Bài 5: Làm quen với số thập phân vô hạn tuần hoàn (Tiết 1)", chapter: "Chương II. Số thực" },
        { tiet: 16, week: 4, title: "Bài 5: Làm quen với số thập phân vô hạn tuần hoàn (Tiết 2)", chapter: "Chương II. Số thực" },
        { tiet: 17, week: 5, title: "Bài 6: Số vô tỉ. Căn bậc hai số học (Tiết 1)", chapter: "Chương II. Số thực" },
        { tiet: 18, week: 5, title: "Bài 6: Số vô tỉ. Căn bậc hai số học (Tiết 2)", chapter: "Chương II. Số thực" },
        { tiet: 19, week: 5, title: "Bài 7: Tập hợp các số thực (Tiết 1)", chapter: "Chương II. Số thực" },
        { tiet: 20, week: 5, title: "Bài 7: Tập hợp các số thực (Tiết 2)", chapter: "Chương II. Số thực" }
      ],
      "9": [
        { tiet: 13, week: 4, title: "Bài 11. Tỉ số lượng giác của góc nhọn (Tiết 1)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 14, week: 4, title: "Bài 11. Tỉ số lượng giác của góc nhọn (Tiết 2)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 15, week: 4, title: "Bài 11. Tỉ số lượng giác của góc nhọn (Tiết 3)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 16, week: 4, title: "Bài 11. Tỉ số lượng giác của góc nhọn (Tiết 4)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 17, week: 5, title: "Bài 12. Một số hệ thức giữa cạnh, góc trong tam giác vuông (Tiết 1)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 18, week: 5, title: "Bài 12. Một số hệ thức giữa cạnh, góc trong tam giác vuông (Tiết 2)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 19, week: 5, title: "Bài 12. Một số hệ thức giữa cạnh, góc trong tam giác vuông (Tiết 3)", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" },
        { tiet: 20, week: 5, title: "Luyện tập chung", chapter: "Chương IV. Hệ thức lượng trong tam giác vuông" }
      ]
    };

    function parseScheduleSlot(rawSlot) {
      return { className: String(rawSlot || ""), subjectId: "toan", subjectName: "Toán học" };
    }

    const curToday = "2026-10-06";
    const weekNum = 5;
    const scheduleList = [];
    const classCounter = {};
    const tb = { slots: DEFAULT_TKB_SLOTS, applyDate: "2026-09-28" };

    for (let dIdx = 0; dIdx < 6; dIdx++) {
      const dayNum = dIdx + 2;
      ["S", "C"].forEach((sess) => {
        for (let p = 1; p <= 5; p++) {
          const key = `${dayNum}_${sess}_${p}`;
          const rawSlot = (tb.slots && tb.slots[key]) || "";
          if (!rawSlot) return;

          const parsedSlot = parseScheduleSlot(rawSlot);
          const clsClean = parsedSlot.className.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
          const subjectKey = `${parsedSlot.subjectId}:${clsClean}`;
          const grade = clsClean.match(/^[6-9]/)?.[0] || "7";
          const ppctList = MATH_PPCT_FALLBACK[grade] || [];
          const weekLessons = ppctList.filter(item => +item.week === +weekNum);

          if (!classCounter[subjectKey]) classCounter[subjectKey] = 0;
          classCounter[subjectKey]++;
          const orderInWeek = classCounter[subjectKey];

          const ppctInfo = weekLessons[orderInWeek - 1];
          const lessonsBeforeWeek = ppctList.filter(item => +item.week < +weekNum).length;
          const tietPpct = ppctInfo?.tiet || lessonsBeforeWeek + orderInWeek || orderInWeek;

          scheduleList.push({
            key,
            className: clsClean,
            orderInWeek,
            hasPpct: !!ppctInfo,
            tietPpct
          });
        }
      });
    }

    document.getElementById("out").textContent = JSON.stringify(scheduleList, null, 2);
</script></body></html>
"@

Set-Content 'test_local.html' $testHtml -Encoding UTF8
$p = Start-Process -FilePath $edge -ArgumentList '--headless', '--dump-dom', 'http://127.0.0.1:8765/test_local.html' -NoNewWindow -PassThru -RedirectStandardOutput 'test_local.txt'
$p.WaitForExit(8000)
Get-Content 'test_local.txt' -Raw -Encoding UTF8
Remove-Item 'test_local.html', 'test_local.txt' -ErrorAction SilentlyContinue
