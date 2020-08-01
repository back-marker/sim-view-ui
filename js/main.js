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

    getRequest("/api/ac/event/" + data["event"]["event_id"] + "/session/latest", updateSessionInfo);
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
    $("#track-condition .current-grip .value").text((session["current_grip"] * 100).toFixed(1) + "%");
  }
}

function setRemainingTimeTimer(start_time, duration_min) {
  setTimeout(function () {
    setRemainingTime(start_time, duration_min);
  }, 1000);
}

function setRemainingLaps(current_lap) {
  var remainLapsText;
  if (current_lap == -1) {
    remainLapsText = "Finished";
  } else {
    var totalLap = Number($("#remaining").attr("data-laps"));
    if (totalLap == current_lap) {
      remainLapsText = "Last Lap";
    } else {
      remainLapsText = current_lap + " / " + totalLap;
    }
  }
  $("#remaining span").text(remainLapsText);
}

function setRemainingTime(start_time, duration_min) {
  var elapsedMS = Date.now() - Math.floor(start_time / 1000);
  var diffTime = duration_min * 60 - Math.floor(elapsedMS / 1000);
  var remainTime = getTimeDiffString(diffTime);
  $("#remaining span").text(remainTime);

  var nextTimeout = 60000;
  if (diffTime < 60 * 60) {
    nextTimeout = 1000;
  }
  setTimeout(function () {
    setRemainingTime(start_time, duration_min);
  }, nextTimeout);
}

function getTimeDiffString(diff) {
  // Diff in secs
  if (diff < 0) {
    return "--";
  } else if (diff < 60) {
    return diff + "S";
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

function getGapString(diff) {
  if (typeof diff === "string") {
    return diff;
  } else {
    getLapTimeString(diff);
  }
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

var sessionGripIntervalHandler = -1;
var sessionLeaderboardIntervalHandler = -1;
function updateSessionInfo(data) {
  if (data["status"] == "success") {
    var session = data["session"];
    if (session["type"] == "Practice" || session["is_finished"] === 1) {
      $("#message").text("No Qualification or Race session running for this event");
      $("#message").removeClass("hidden");
      return;
    }
    $("main").removeClass("hidden");

    $("#event-detail .active").removeClass("active");
    if (session["type"] === "Race") {
      $("#event-detail .race .live").addClass("active");
    } else {
      $("#event-detail .quali .live").addClass("active");
    }

    $("#track-condition .weather .value").text(getWeatherDisplayName(session["weather"]));
    $("#track-condition .air-temp .temp-val").text(session["air_temp"]);
    $("#track-condition .road-temp .temp-val").text(session["road_temp"]);
    if (session["start_grip"] != -1) {
      $("#track-condition .start-grip .value").text((session["start_grip"] * 100).toFixed(1) + "%");
    }
    if (session["current_grip"] != -1) {
      $("#track-condition .current-grip .value").text((session["current_grip"] * 100).toFixed(1) + "%");
    }
    $("#remaining").attr("data-session-start", session["start_time"]);
    if (session["duration_min"] != 0) {
      $("#remaining").attr("data-session-type", "time");
      $("#remaining span").addClass("remain-time");
      remainingTimerId = setRemainingTimeTimer(session["start_time"], session["duration_min"]);
    } else {
      $("#remaining span").addClass("remain-laps");
      $("#remaining").attr("data-laps", session["laps"]);
    }

    $("head title").text("Sim View | Live " + session["type"]);
    $("#event-detail").attr("data-session", session["type"].toLocaleLowerCase());
    if (session["type"] == "Race") {
      setupRaceLeaderBoardStructure();
    } else {
      setupQualiLeaderBoardStructure();
    }

    sessionGripIntervalHandler = setInterval(function () {
      getRequest("/api/ac/session/" + session["session_id"], updateSessionGrip);
    }, 30 * 1000);

    sessionLeaderboardIntervalHandler = setInterval(function () {
      getRequest("/api/ac/session/" + session["session_id"] + "/leaderboard/" + session["type"].toLocaleLowerCase(), updateLeaderBoard);
    }, 10 * 1000);

  }
}

function updateSessionGrip(data) {
  if (data["status"] == "success") {
    var session = data["session"]
    if (session["is_finished"] === 1) {
      if (sessionLeaderboardIntervalHandler != -1) {
        clearInterval(sessionLeaderboardIntervalHandler);
      }
      if (sessionGripIntervalHandler != -1) {
        clearInterval(sessionGripIntervalHandler);
      }
      var sessionOverText = session["type"] + " session is over";
      if (session["type"] !== "Race") {
        sessionOverText += ". Reloading in 5 secs";
        setTimeout(function () { window.location.reload(true); }, 5 * 1000);
      }
      $("#message").text(sessionOverText);
      $("#message").removeClass("hidden");

      return;
    }

    if (session["start_grip"] != -1) {
      $("#track-condition .start-grip .value").text((session["start_grip"] * 100) + "%");
    }
    if (session["current_grip"] != -1) {
      $("#track-condition .current-grip .value").text((session["current_grip"] * 100) + "%");
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
    if (time !== 0) {
      if (sec2 === 0) {
        return time - sec1;
      } else {
        return sec2;
      }
    } else {
      return sec2;
    }
  } else {
    if (time !== 0) {
      return time - sec1 - sec2;
    } else {
      return 0;
    }
  }
}

function fixLeaderboard(leaderboard) {
  // Add purple sectors info
  var sec1_idx = -1, sec2_idx = -1, sec3_idx = -1;
  for (var idx = 0; idx < leaderboard.length; ++idx) {
    // No change required for sector_1
    leaderboard[idx]["sector_2"] = getSectorTime(leaderboard[idx]["best_lap_time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 2);
    leaderboard[idx]["sector_3"] = getSectorTime(leaderboard[idx]["best_lap_time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 3);
    // Remove this
    if (leaderboard[idx]["is_connected"] == 1) {
      if (sec1_idx == -1 || leaderboard[idx]["sector_1"] < leaderboard[sec1_idx]["sector_1"]) {
        sec1_idx = idx;
      }
      if (sec2_idx == -1 || leaderboard[idx]["sector_2"] < leaderboard[sec2_idx]["sector_2"]) {
        sec2_idx = idx;
      }
      if (sec3_idx == -1 || leaderboard[idx]["sector_3"] < leaderboard[sec3_idx]["sector_3"]) {
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

prevLapList = {}
function fixRaceLeaderboard(leaderboard) {
  var prevLaps = -1;
  var best_idx = -1;
  for (var idx = 0; idx < leaderboard.length; ++idx) {
    // No change required for sector_1
    leaderboard[idx]["sector_2"] = getSectorTime(leaderboard[idx]["last_lap_time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 2);
    leaderboard[idx]["sector_3"] = getSectorTime(leaderboard[idx]["last_lap_time"], leaderboard[idx]["sector_1"], leaderboard[idx]["sector_2"], 3);
    if (leaderboard[idx]["last_lap_time"] !== 0) {
      prevLapList[leaderboard[idx]["user_id"]] = leaderboard[idx]["last_lap_time"];
    }

    if (leaderboard[idx]["best_lap_time"] != 0) {
      if (best_idx == -1 || leaderboard[idx]["best_lap_time"] < leaderboard[best_idx]["best_lap_time"]) {
        best_idx = idx;
      }
    }
    if (leaderboard[idx]["gap"] === undefined) {
      if (prevLaps != -1) {
        leaderboard[idx]["gaps"] = "+" + (prevLaps - leaderboard[idx]["laps"]) + " L";
      }
    } else {
      leaderboard[idx]["gaps"] = getLapTimeString(leaderboard[idx]["gaps"]);
    }
    prevLaps = leaderboard[idx]["laps"];
  }

  if (best_idx != -1) {
    leaderboard[best_idx]["purple_lap"] = true;
  }

  return leaderboard
}

function getDriverStatusClass(is_connected, is_finished) {
  if (is_finished) {
    return "status-chequered";
  } else if (is_connected) {
    return "status-green";
  } else {
    return "status-red";
  }
}

function getLeaderBoardHtml(pos, info) {
  return "<ul data-pos=\"" + pos + "\">" +
    "<li class=\"lb-pos\">" + pos + "</li>" +
    "<li class=\"lb-status\"><span class=\"status " + getDriverStatusClass(info["is_connected"], info["is_finished"]) + "\"></span></li>" +
    "<li class=\"lb-car\" data-car-id=\"" + info["car_id"] + "\">" + ((carList[info["car_id"]] !== undefined) ? carList[info["car_id"]] : "") + "</li>" +
    "<li class=\"lb-driver\" data-user-id=\"" + info["user_id"] + "\">" + ((driverList[info["user_id"]] !== undefined) ? driverList[info["user_id"]] : "") + "</li>" +
    "<li class=\"lb-best-lap" + (pos == 1 && info["is_connected"] == 1 && info["best_lap_time"] != 0 ? " purple-sec" : "") + "\">" + getLapTimeString(info["best_lap_time"]) + "</li>" +
    "<li class=\"lb-gap\">" + (info["gap"] === undefined ? "-" : "+" + getLapTimeString(info["gap"])) + "</li>" +
    "<li class=\"lb-sec1" + (info["sec1_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_1"]) + "</li>" +
    "<li class=\"lb-sec2" + (info["sec2_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_2"]) + "</li>" +
    "<li class=\"lb-sec3" + (info["sec3_purple"] === 1 ? " purple-sec" : "") + "\">" + getSectorTimeString(info["sector_3"]) + "</li>" +
    "<li class=\"lb-laps\">" + info["valid_laps"] + "</li>" +
    "<div class=\"clear-both\"></div>" +
    "</ul>";
}

function getRaceLeaderBoardHtml(pos, info) {
  return "<ul data-pos=\"" + pos + "\">" +
    "<li class=\"lb-pos\">" + pos + "</li>" +
    "<li class=\"lb-status\"><span class=\"status " + getDriverStatusClass(info["is_connected"], info["is_finished"]) + "\"></span></li>" +
    "<li class=\"lb-car\" data-car-id=\"" + info["car_id"] + "\">" + ((carList[info["car_id"]] !== undefined) ? carList[info["car_id"]] : "") + "</li>" +
    "<li class=\"lb-driver\" data-user-id=\"" + info["user_id"] + "\">" + ((driverList[info["user_id"]] !== undefined) ? driverList[info["user_id"]] : "") + "</li>" +
    "<li class=\"lb-laps\">" + info["laps"] + "</li>" +
    "<li class=\"lb-gap\">" + (info["gap"] === undefined ? "-" : "+" + getGapString(info["gap"])) + "</li>" +
    "<li class=\"lb-best-lap" + (info["purple_lap"] ? " purple-sec" : "") + "\">" + getLapTimeString(info["best_lap_time"]) + "</li>" +
    "<li class=\"lb-last-lap\">" + getLapTimeString(prevLapList[info["user_id"]] !== undefined ? prevLapList[info["user_id"]] : 0) + "</li>" +
    "<li class=\"lb-sec1\">" + getSectorTimeString(info["sector_1"]) + "</li>" +
    "<li class=\"lb-sec2\">" + getSectorTimeString(info["sector_2"]) + "</li>" +
    "<li class=\"lb-sec3\">" + getSectorTimeString(info["sector_3"]) + "</li>" +
    "<div class=\"clear-both\"></div>" +
    "</ul>";
}

function setupRaceLeaderBoardStructure() {
  leaderboardHeader = "<ul>" +
    "<li class=\"lb-pos\">Pos</li>" +
    "<li class=\"lb-status\">Status</li>" +
    "<li class=\"lb-car\">Car</li>" +
    "<li class=\"lb-driver\">Driver</li>" +
    "<li class=\"lb-laps\">Laps</li>" +
    "<li class=\"lb-gap\">Gap</li>" +
    "<li class=\"lb-best-lap\">Best Lap</li>" +
    "<li class=\"lb-last-lap\">Last Lap</li>" +
    "<li class=\"lb-sec1\">S1</li>" +
    "<li class=\"lb-sec2\">S2</li>" +
    "<li class=\"lb-sec3\">S3</li>" +
    "<div class=\"clear-both\"></div>" +
    "</ul>";
  $("#board-header").html(leaderboardHeader);
}

function setupQualiLeaderBoardStructure() {
  leaderboardHeader = "<ul>" +
    "<li class=\"lb-pos\">Pos</li>" +
    "<li class=\"lb-status\">Status</li>" +
    "<li class=\"lb-car\">Car</li>" +
    "<li class=\"lb-driver\">Driver</li>" +
    "<li class=\"lb-best-lap\">Best Lap</li>" +
    "<li class=\"lb-gap\">Gap</li>" +
    "<li class=\"lb-sec1\">S1</li>" +
    "<li class=\"lb-sec2\">S2</li>" +
    "<li class=\"lb-sec3\">S3</li>" +
    "<li class=\"lb-laps\">Laps</li>" +
    "<div class=\"clear-both\"></div>" +
    "</ul>";
  $("#board-header").html(leaderboardHeader);
}

function updateLeaderBoard(data) {
  if (data["status"] == "success") {
    var leaderboard = data["leaderboard"];
    var leaderboardHtml = "";
    var pendingCarList = new Set();
    var pendingDriverList = new Set();
    var sessionType = $("#event-detail").attr("data-session");
    if (sessionType == "race") {
      leaderboard = fixRaceLeaderboard(leaderboard);
    } else {
      leaderboard = fixLeaderboard(leaderboard);
    }
    for (idx = 0; idx < leaderboard.length; ++idx) {
      if (sessionType == "race") {
        leaderboardHtml += getRaceLeaderBoardHtml(idx + 1, leaderboard[idx]);
      } else {
        leaderboardHtml += getLeaderBoardHtml(idx + 1, leaderboard[idx]);
      }
      if (carList[leaderboard[idx]["car_id"]] === undefined) {
        pendingCarList.add(leaderboard[idx]["car_id"]);
      }
      if (driverList[leaderboard[idx]["user_id"]] === undefined) {
        pendingDriverList.add(leaderboard[idx]["user_id"]);
      }
    }

    $("#board-body").html(leaderboardHtml);
    if ($("#remaining span").hasClass("remain-laps")) {
      if (leaderboard[0] != undefined) {
        if (leaderboard[0]["is_finished"] == 1) {
          setRemainingLaps(-1);
        } else {
          setRemainingLaps(leaderboard[0]["laps"] + 1)
        }
      } else {
        setRemainingLaps(1);
      }
    }

    pendingCarList.forEach(function (car_id) {
      getRequest("/api/ac/car/" + car_id, updateCarName);
    });
    pendingDriverList.forEach(function (user_id) {
      getRequest("/api/ac/user/" + user_id, updateDriverName);
    });
  }
}

function getCurrentEvent() {
  return window.location.toString().match("event/([0-9]+)/")[1];
}


function getEventHtml(event) {
  return "<a href=\"/ac/event/" + event["event_id"] + "/live\">" +
    "<div class=\"event\" data-event-id=\"" + event["event_id"] + "\">" +
    "<div class=\"header\">" +
    "<div class=\"title\">" + event["name"] + "</div>" +
    "<div class=\"server-container\">" +
    "<div class=\"server\">" + event["server_name"] + "</div>" +
    "<div class=\"live" + (event["active"] ? " active" : "") + "\"></div>" +
    (event["team_event"] ? "<div class=\"team\"></div>" : "") +
    "<div class=\"clear-both\"></div>" +
    "</div>" +
    "</div>" +
    "<div class=\"time\">" +
    "<div class=\"quali\"><span class=\"tag\">Qualification</span><span class=\"date\">" + (event["quali_start"] || "N/A") + "</span></div>" +
    "<div class=\"race \"><span class=\"tag\">Race</span><span class=\"date\">" + (event["race_start"] || "N/A") + "</span></div>" +
    "</div>" +
    "<div class=\"track\">" +
    "<div class=\"preview\">" +
    "<img src=\"/images/ac/track/" + event["track_config_id"] + "/preview\">" +
    "</div>" +
    "<div class=\"clear-both\"></div>" +
    "</div>" +
    "<div class=\"footer\"></div>" +
    "</div>" + "</a>";
}

function updateAllEvents(data) {
  if (data["status"] == "success") {
    var eventHtml = ""
    for (var idx = 0; idx < data["events"].length; ++idx) {
      eventHtml += getEventHtml(data["events"][idx]);
    }
    $("#event-container").html(eventHtml);
  }
}

$(document).ready(function () {
  var page = $("body").attr("data-page");
  if (page == "lb-page") {
    getRequest("/api/ac/event/" + getCurrentEvent(), updateEventInfo);
  } else if (page == "events-page") {
    getRequest("/api/ac/events", updateAllEvents);
  }
});