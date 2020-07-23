function getRequest(url, callback) {
  $.ajax({
    type: "GET",
    url: url,
    crossDomain: true,
    success: function (data) { callback(data); },
    error: function () { console.log(arguments); }
  });
}

function updateEventInfo(data) {
  if (data["status"] === "success") {
    $("#event-detail").attr("data-event-id", data["event"]["event_id"]).attr("data-team-event", data["event"]["team_event"]).attr("data-track", data["event"]["track_config_id"]);
    $("#event-detail .title").text(data["event"]["name"]);
    $("#event-detail .server").text(data["event"]["server_name"]);
    if (data["event"]["quali_start"] !== undefined) {
      $("#event-detail .quali .date").text(data["event"]["quali_start"]);
    }
    if (data["event"]["race_start"] !== undefined) {
      $("#event-detail .race .date").text(data["event"]["race_start"]);
    }

    var trackApi = "/ac/track/" + data["event"]["track_config_id"];
    getRequest("/api" + trackApi, updateTrackInfo);
    $("#track-preview img").attr("src", "/images" + trackApi + "/preview");
  }
}

function updateTrackInfo(data) {
  if (data["status"] === "success") {
    $("#track-preview .name").text(data["track"]["display_name"]);
  }
}

function updateCurrentGrip(data) {
  if (data["status"] == "success") {
    var session = data["session"];
    $("#track-condition .current-grip .value").text((session["current_grip"] * 100) + "%");
  }
}

function setRemainingTimeTimer(start_time, duration_min) {
  setTimeout(function () {
    setRemainingTime(start_time, duration_min);
  }, 1000);
}

function setRemainingTime(start_time, duration_min) {
  var elapsedMS = Date.now() - (start_time / 1000);
  var remainTime = getTimeDiffString(duration_min * 60 - elapsedMS / 1000);
  console.log(remainTime);
  $("#remaining span").text(remainTime);

  var nextTimeout = 60000;
  if (remainTime < 60 * 60) {
    nextTimeout = 1000;
  }
  setTimeout(function () {
    setRemainingTime(start_time, duration_min);
  }, nextTimeout);
}

function getTimeDiffString(diff) {
  // Diff in secs
  if (diff < 0) diff = -diff;
  if (diff < 0) {
    return "--";
  } else if (diff < 60) {
    return diff;
  } else if (diff < 60 * 60) {
    return Math.floor(diff / 60) + "M " + (diff % 60) + "S";
  } else {
    diff = Math.floor(diff / 60);
    return Math.floor(diff / 60) + "H " + (diff % 60) + "M";
  }
}

function getLapTimeString(lapTime) {
  // Laptime in ms
  if (lapTime === 0) return "-";
  var min = "";
  var sec = "";
  var ms = "";

  ms = lapTime % 1000;
  lapTime = Math.floor(lapTime / 1000);
  sec = lapTime % 60;
  lapTime = Math.floor(lapTime / 60);
  min = lapTime;
  if (min >= 60) {
    return "-";
  }

  if (sec < 10) {
    sec = "0" + sec;
  }
  if (ms < 10) {
    ms = "00" + ms;
  } else if (ms < 100) {
    ms = "0" + ms;
  }

  return min + ":" + sec + ":" + ms;
}



carList = {};
driverList = {};
function updateCarName(data) {
  if (data["status"] === "success") {
    var car = data["car"];
    $(".lb-car[data-car-id=" + car["car_id"] + "]").text(car["display_name"]);
    carList[car["car_id"]] = car["display_name"];
  }
}

function updateDriverName(data) {
  if (data["status"] === "success") {
    var user = data["user"];
    $(".lb-driver[data-user-id=" + user["user_id"] + "]").text(user["name"]);
    driverList[user["user_id"]] = user["name"];
  }
}

function getWeatherDisplayName(weather) {
  weather = weather.split("_");
  if (weather[0] === "sol") {
    weather.shift();
  }
  weather.shift();
  return weather.join(" ");
}

function updateSessionInfo(data) {
  if (data["status"] == "success") {
    for (var idx = 0; idx < data["sessions"].length; ++idx) {
      if (data["sessions"][idx]["type"] === "Practice") continue;
      if (data["sessions"][idx]["is_finished"] === 1) continue;

      var session = data["sessions"][idx];
      console.log(session);
      $("#event-detail .active").removeClass("active");
      if (session["type"] === "Race") {
        $("#event-detail .race .live").addClass("active");
      } else {
        $("#event-detail .quali .live").addClass("active");
      }

      $("#track-condition .weather .value").text(getWeatherDisplayName(session["weather"]));
      $("#track-condition .air-temp .temp-val").text(session["air_temp"]);
      $("#track-condition .road-temp .temp-val").text(session["road_temp"]);
      $("#track-condition .start-grip .value").text((session["start_grip"] * 100) + "%");
      $("#track-condition .current-grip .value").text((session["current_grip"] * 100) + "%");
      $("#remaining").attr("data-session-start", session["start_time"]);
      if (session["duration_min"] != 0) {
        $("#remaining").attr("data-session-type", "time");
        $("#remaining span").addClass("remain-time");
        remainingTimerId = setRemainingTimeTimer(session["start_time"], session["duration_min"]);
      } else {
        $("#remaining span").addClass("remain-laps");
      }

      break;
    }
  }
}

function updateCurrentSession() {

}

function getSectorTimeString(time) {
  return getLapTimeString(time);
}

function getSectorTime(time, sec1, sec2, sec) {
  if (sec === 1) {
    return sec1;
  } else if (sec === 2) {
    if (sec2 === 0) {
      return time - sec1;
    } else {
      return sec2;
    }
  } else {
    if (sec2 === 0) {
      return 0;
    } else {
      return time - sec1 - sec2;
    }
  }
}

function fixLeaderboard(leaderboard) {
  // Add purple sectors info
  var sec1_idx = -1, sec2_idx = -1, sec3_idx = -1;
  for (var idx = 0; idx < leaderboard.length; ++idx) {
    // No change required for sector_1
    leaderboard[idx]["sector_2"] = getSectorTime(leaderboard[idx]["time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 2);
    leaderboard[idx]["sector_3"] = getSectorTime(leaderboard[idx]["time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 3);
    // Remove this
    leaderboard[idx]["is_connected"] = 1;
    if (leaderboard[idx]["is_connected"] == 1) {
      if (sec1_idx == -1 || leaderboard[idx]["sector_1"] < leaderboard[idx]["sector_1"]) {
        sec1_idx = idx;
      }
      if (sec2_idx == -1 || leaderboard[idx]["sector_2"] < leaderboard[idx]["sector_2"]) {
        sec2_idx = idx;
      }
      if (sec3_idx == -1 || leaderboard[idx]["sector_3"] < leaderboard[idx]["sector_3"]) {
        sec3_idx = idx;
      }
    }
  }

  if (sec1_idx != -1 && leaderboard[sec1_idx]["sector_1"] != 0) {
    leaderboard[sec1_idx]["sec1_purple"] = 1;
  }
  if (sec2_idx != -1 && leaderboard[sec2_idx]["sector_2"] != 0) {
    leaderboard[sec2_idx]["sec2_purple"] = 1;
  }
  if (sec3_idx != -1 && leaderboard[sec3_idx]["sector_3"] != 0) {
    leaderboard[sec3_idx]["sec3_purple"] = 1;
  }

  return leaderboard;
}

function getLeaderBoardHtml(pos, info) {
  console.log(info);
  return "<ul data-pos=\"" + pos + "\">" +
    "<li class=\"lb-pos\">" + pos + "</li>" +
    "<li class=\"lb-status\"><span class=\"status status-" + (info["is_connected"] === 1 ? "green" : "red") + "\"></span></li>" +
    //"<li class=\"lb-team-no\">101</li>
    //"<li class=\"lb-car-class car-class-1">GT3</li>
    "<li class=\"lb-car\" data-car-id=\"" + info["car_id"] + "\">" + ((carList[info["car_id"]] !== undefined)? carList[info["car_id"]] : "") + "</li>" +
    //<li class="lb-team">Ravenwest Racing</li>
    "<li class=\"lb-driver\" data-user-id=\"" + info["user_id"] + "\">" + ((driverList[info["user_id"]] !== undefined)? driverList[info["user_id"]] : "") + "</li>" +
    "<li class=\"lb-best-lap" + (pos == 1 && info["is_connected"] == 1 ? " purple-sec" : "") + "\">" + getLapTimeString(info["time"]) + "</li>" +
    "<li class=\"lb-gap\">" + (info["gap"] === undefined ? "-" : "+" + getLapTimeString(info["gap"])) + "</li>" +
    "<li class=\"lb-sec1" + (info["sec1_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_1"]) + "</li>" +
    "<li class=\"lb-sec2" + (info["sec2_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_2"]) + "</li>" +
    "<li class=\"lb-sec3" + (info["sec3_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_3"]) + "</li>" +
    "<li class=\"lb-laps\">" + info["valid_laps"] + "</li>" +
    "<div class=\"clear-both\"></div>" +
    "</ul>";
}

function updateLeaderBoard(data) {
  if (data["status"] == "success") {
    var leaderboard = data["leaderboard"];
    var leaderboardHtml = "";
    leaderboard = fixLeaderboard(leaderboard);
    var pendingCarList = new Set();
    var pendingDriverList = new Set();
    for (idx = 0; idx < leaderboard.length; ++idx) {
      leaderboardHtml += getLeaderBoardHtml(idx + 1, leaderboard[idx]);
      if (carList[leaderboard[idx]["car_id"]] === undefined) {
        pendingCarList.add(leaderboard[idx]["car_id"]);
      }
      if (driverList[leaderboard[idx]["user_id"]] === undefined) {
        pendingDriverList.add(leaderboard[idx]["user_id"]);
      }
    }
    $("#board-body").html(leaderboardHtml);

    pendingCarList.forEach(function (car_id) {
      getRequest("/api/ac/car/" + car_id, updateCarName);
    });
    pendingDriverList.forEach(function (user_id) {
      getRequest("/api/ac/user/" + user_id, updateDriverName);
    });
  }
}

$(document).ready(function () {
  // Event id 3;
  var eventId = 3;
  getRequest("/api/ac/event/" + eventId, updateEventInfo);
  getRequest("/api/ac/event/" + eventId + "/sessions", updateSessionInfo);
  setInterval(function () {
    getRequest("/api/ac/session/7/leaderboard", updateLeaderBoard);
  }, 10000);
});