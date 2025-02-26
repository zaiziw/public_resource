function Q(selector) {
  return document.querySelector(selector);
}
setInterval(() => {
  updateTimer();
}, 1000);
// 启用tooltips
const tooltipTriggerList = document.querySelectorAll(
  '[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
  (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);

// 监听 Q("#input_dingtalk") 文本变化
Q("#input_dingtalk").addEventListener("input", function () {
  processDingTalkInput();
});
Q("#input_worktime_per_day").addEventListener("input", function () {
  processDingTalkInput();
});
Q("#switch_filter").addEventListener("change", function () {
  processDingTalkInput();
});
Q("#input_alert_forward").addEventListener("input", function () {
  processDingTalkInput();
});
Q("#btn_read_clipboard").addEventListener("click", function () {
  Q("#input_dingtalk").value = "";
  clearStatus();
  // 网页获取剪切板内容
  if (!navigator.clipboard) {
    addStatus("不支持自动读取剪贴板,请手动粘贴到输入框", "danger");
    return;
  }
  navigator.clipboard
    .readText()
    .then((text) => {
      Q("#input_dingtalk").value = text;
      processDingTalkInput();
    })
    .catch((err) => {
      addStatus("无法读取剪贴板内容：" + err, "danger");
    });
});
let hasNotificationPermission = false;
function updateNotificationPermission() {
  hasNotificationPermission =
    window.Notification && Notification.permission === "granted";
  if (window.Notification && Notification.permission !== "granted") {
    Notification.requestPermission(function (status) {
      hasNotificationPermission = status === "granted";
      if (!hasNotificationPermission) {
        addStatus("无法获取通知权限", "warning");
      }
    });
  }
}
function processDingTalkInput() {
  updateNotificationPermission();
  processDingTalkWorktime(
    Q("#input_dingtalk").value,
    Q("#input_worktime_per_day").value,
    Q("#switch_filter").checked,
    Q("#input_alert_forward").value,
  );
}

function addStatus(message) {
  Q("#status_wrapper").innerHTML += `<p>${message}</p>`;
}
function clearStatus() {
  Q("#status_wrapper").innerHTML = "";
}
function processDingTalkWorktime(content, worktimePerDay, filter, alertForward) {
  needEndTime = null;
  clearStatus();
  const matches = content.matchAll(
    /(\d{2}):(\d{2}) (上班|下班)打卡·成功班次时间(\d{2})月(\d{2})日 \d{2}:\d{2}.*?(\d{4})年(\d{2})月(\d{2})日/g
  );

  let begTime;
  let endTime;
  const history = [];
  let isNewDay = false;
  let tmp;
  for (const match of matches) {
    const args = match.slice(1);
    const [hour, minute, type, month, day, year] = args;
    const time = new Date(year, month - 1, day, hour, minute);
    if (type === "上班") {
      if (isNewDay) {
        history.pop();
      }
      begTime = time;
      isNewDay = true;
      tmp = {
        begTime,
        workTimeInMinutes: 0,
      };
      history.push(tmp);
    } else {
      if (!isSameDay(begTime, time)) {
        addStatus(
          `打卡记录不完整: <br> 上班:${
            begTime?.toLocaleString() || "未打卡"
          }<br>下班:${time?.toLocaleString() || "未打卡"} `,
          "danger"
        );
        continue;
      }
      endTime = time;
      const workTime = endTime.getTime() - begTime.getTime();
      const workTimeInMinutes = Math.ceil(workTime / 1000 / 60);
      tmp.endTime = endTime;
      tmp.workTimeInMinutes = workTimeInMinutes;
      isNewDay = false;
    }
  }
  // 过滤非相邻天数
  var filteredHistory = [];
  if (filter) {
    for(let i = history.length - 1; i >= 0; i--) {
      if (i == history.length - 1 || isContinuousDay(history[i].begTime, history[i + 1].begTime)) {
        filteredHistory.unshift(history[i]);
        continue;
      }
      break;
    }
  } else {
    filteredHistory = history;
  }
  filteredHistory.forEach((item) => {
    // 每日打卡情况
    const { begTime, endTime, workTimeInMinutes } = item;
    const date = (begTime || endTime).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const total =
      begTime && endTime
        ? ` (${formatMilliSeconds(endTime.getTime() - begTime.getTime())})`
        : "";
    addStatus(
      `[${date}] ${formatTime(begTime)} > ${formatTime(endTime)} ${total}`
    );
  });

  const totalWorkTimeInMinutes = filteredHistory.reduce(
    (acc, cur) => acc + cur.workTimeInMinutes,
    0
  );
  const totalWorkTimeFormated = formatMinutes(totalWorkTimeInMinutes);
  const needWorkTimeInMinutes = worktimePerDay * 60 * filteredHistory.length;
  Q("#label_total").innerHTML = `${totalWorkTimeFormated}/${formatMinutes(
    needWorkTimeInMinutes
  )}(共${filteredHistory.length}天)`;
  const diff = needWorkTimeInMinutes - totalWorkTimeInMinutes;
  Q("#label_need").innerHTML = `${formatMinutes(diff)}`;
  const lastDay = filteredHistory[filteredHistory.length - 1];
  const showRecommend = lastDay && !lastDay.endTime;
  Q("#left_wrap").style.display = showRecommend ? "" : "none";
  if (showRecommend) {
    needEndTime = new Date(
      lastDay.begTime.getTime() + diff * 60 * 1000
    );
    alerTime = new Date(
      lastDay.begTime.getTime() + diff * 60 * 1000 - alertForward * 60 * 1000
    );
    Q("#label_recommend").innerHTML = `${needEndTime.toLocaleString()}`;
    updateTimer();
    // Q("#label_off_duty").innerHTML = `${needEndTime.toLocaleString()}`;
  }
}
var needEndTime = null;
var alerTime = null;
var hasNotified = false;
var hasNotifiedAlert = false;
function updateTimer() {
  if (needEndTime) {
    const leftTime = needEndTime.getTime() - Date.now();
    const leftTimeAlert = alerTime.getTime() - Date.now();
    if (leftTime > 0) {
      hasNotified = false;
      if (leftTimeAlert == leftTime) {
        Q("#label_off_duty").innerHTML = `<span class="text-danger">将在 ${formatMilliSeconds(leftTime, true)} 后提醒</span>`;
      }else{
        Q("#label_off_duty").innerHTML = `<span class="text-danger">将在 ${formatMilliSeconds(leftTime, true)} 后下班</span>`;
      }
    } else {
      Q("#label_off_duty").innerHTML = `<span class="text-success">下班打卡时间到了(已过${formatMilliSeconds(-leftTime)})</span>`;
      if (!hasNotified) {
        hasNotified = true;
        new Notification(`下班打卡时间到了: ${needEndTime.toLocaleTimeString()}`, {
          icon: "./favicon.png"
        });
      }
    }

    if (leftTimeAlert == leftTime || leftTime <= 0) {
      return;
    }

    if (leftTimeAlert > 0) {
      hasNotifiedAlert = false;
      Q("#label_off_duty_alert").innerHTML = `<span class="text-danger">将在 ${formatMilliSeconds(leftTimeAlert, true)} 后提醒</span>`;
    } else {
      Q("#label_off_duty_alert").innerHTML = "";
      if (!hasNotifiedAlert) {
        hasNotifiedAlert = true;
        new Notification(`还有 ${formatMilliSeconds(leftTime, true)} 分钟下班！`, {
          icon: "./favicon.png"
        });
      }
    }
  }
}

/**
 * 是否为同一天
 * @param {Date} date1
 * @param {Date} date2
 * @returns
 */
function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/** 是否为相邻天 */
function isContinuousDay(date1, date2) {
  if (!date1 || !date2) return false;
  var newDate = new Date(date1.getTime() + 24 * 60 * 60 * 1000);
  return isSameDay(newDate, date2);
}

function formatMilliSeconds(milliseconds, full) {
  // 如果大于1小时,则显示小时和分钟
  if (milliseconds > 60 * 60 * 1000) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    if (!full) {
      return `${hours}小时${minutes}分钟`;
    } else {
      const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
      return `${hours}小时${minutes}分钟${seconds}秒`;
    }
  }
  // 如果大于1分钟，则显示分钟和秒数
  if (milliseconds > 60 * 1000) {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes}分钟${seconds}秒`;
  }
  // 否则，直接显示秒数
  return `${Math.floor(milliseconds / 1000)}秒`;
}

function formatMinutes(minutes) {
  return formatMilliSeconds(minutes * 60 * 1000);
}

function formatTime(date) {
  return date ? date.toLocaleTimeString() : "未打卡";
}
