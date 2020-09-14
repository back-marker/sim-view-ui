function getRequest(url, callback) {
  $.ajax({
    type: "GET",
    url: url,
    crossDomain: true,
    success: function(data) { callback(data); },
    error: function() { console.log(arguments); }
  });
}

function setRemainingTimeTimer(start_time, duration_min) {
  LeaderboardPage.setRemainingTime(start_time, duration_min);
  setTimeout(function() {
    LeaderboardPage.setRemainingTime(start_time, duration_min);
  }, 1000);
}

class Page {
  static cb_updateCarName(data) {
    if (data["status"] === "success") {
      var car = data["car"];
      LeaderBoard.carList[car["car_id"]] = { "name": car["display_name"], "class": car["car_class"] };
      if (LeaderBoard.carColorClass.indexOf(car["car_class"]) === -1) {
        LeaderBoard.carColorClass.push(car["car_class"]);
      }
      $(".lb-car[data-car-id=" + car["car_id"] + "] .car-name").text(car["display_name"]);
      $(".lb-car-class[data-car-id=" + car["car_id"] + "]").text(car["car_class"]).addClass(Util.getCarColorClass(car["car_id"]));
    }
  }

  static cb_updateDriverName(data) {
    if (data["status"] === "success") {
      var user = data["user"];
      $(".lb-driver[data-driver-id=" + user["user_id"] + "]").text(user["name"]);
      LeaderBoard.driverList[user["user_id"]] = user["name"];
    }
  }
}

class LeaderboardPage extends Page {

  static SESSION_TYPE = { PRACTICE: "Practice", QUALIFYING: "Qualifying", RACE: "Race" }
  static sessionGripIntervalHandler = -1;
  static sessionLeaderboardIntervalHandler = -1;

  static cb_updateEventInfo(data) {
    if (data["status"] === "success") {
      var event = data["event"];
      $("#event-detail").attr("data-event-id", event["event_id"]).attr("data-team-event", event["team_event"]).attr("data-track", event["track_config_id"]);
      $("#event-detail .title").text(event["name"]);
      $("#event-detail .server").text(event["server_name"]);
      if (event["quali_start"] !== undefined) {
        $("#event-detail .quali .date").text(event["quali_start"]);
      }
      if (event["race_start"] !== undefined) {
        $("#event-detail .race .date").text(event["race_start"]);
      }

      var trackApi = "/ac/track/" + event["track_config_id"];
      getRequest("/api" + trackApi, LeaderboardPage.cb_updateTrackInfo);
      $("#track-preview img").attr("src", "/images" + trackApi + "/preview");

      getRequest("/api/ac/event/" + event["event_id"] + "/session/latest", LeaderboardPage.cb_updateSessionInfo);
    }
  }

  static cb_updateTrackInfo(data) {
    if (data["status"] === "success") {
      var track = data["track"];
      $("#track-condition .track-length .value").text((track["length"] / 1000).toFixed(2) + " KM");
      $("#track-preview .name").text(track["display_name"]);
      $("#track-preview .country").text(track["city"] + ", " + track["country"]);
    }
  }

  static cb_updateSessionGrip(data) {
    if (data["status"] == "success") {
      var session = data["session"]
      if (session["is_finished"] === 1) {
        if (LeaderboardPage.sessionLeaderboardIntervalHandler != -1) {
          clearInterval(LeaderboardPage.sessionLeaderboardIntervalHandler);
        }
        if (LeaderboardPage.sessionGripIntervalHandler != -1) {
          clearInterval(LeaderboardPage.sessionGripIntervalHandler);
        }
        var sessionOverText = session["type"] + " session is over";
        if (session["type"] !== "Race") {
          sessionOverText += ". Reloading in 5 secs";
          setTimeout(function() { window.location.reload(true); }, 5 * 1000);
        }
        $("#message").text(sessionOverText);
        $("#message").removeClass("hidden");

        return;
      }

      if (session["start_grip"] != -1) {
        $("#track-condition .start-grip .value").text((session["start_grip"] * 100).toFixed(1) + "%");
      }
      if (session["current_grip"] != -1) {
        $("#track-condition .current-grip .value").text((session["current_grip"] * 100).toFixed(1) + "%");
      }
    }
  }

  static cb_updateLeaderBoard(data) {
    if (data["status"] == "success") {
      var leaderboard = data["leaderboard"];
      var leaderboardHtml = "";
      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      var sessionType = $("#event-detail").attr("data-session");
      if (sessionType == "race") {
        leaderboard = RaceLeaderBoard.fromJSON(leaderboard);
      } else {
        leaderboard = QualiLeaderBoard.fromJSON(leaderboard);
      }

      var pos = 0;
      for (var entry of leaderboard.entries) {
        if (sessionType === "race") {
          leaderboardHtml += entry.toHTML(pos, leaderboard.bestLapIdx);
        } else {
          leaderboardHtml += entry.toHTML(pos, leaderboard.bestSec1Idx, leaderboard.bestSec2Idx, leaderboard.bestSec3Idx);
        }
        if (LeaderBoard.carList[entry.carId] === undefined) {
          pendingCarList.add(entry.carId);
        }
        if (LeaderBoard.driverList[entry.driverId] === undefined) {
          pendingDriverList.add(entry.driverId);
        }

        pos += 1;
      }

      $("#board-body").html(leaderboardHtml);
      if ($("#remaining span").hasClass("remain-laps")) {
        if (leaderboard.entries[0] !== undefined) {
          if (leaderboard.entries[0].status === LeaderBoardEntry.STATUS.FINISHED) {
            LeaderboardPage.setRemainingLaps(-1);
          } else {
            LeaderboardPage.setRemainingLaps(leaderboard.entries[0].totalLaps + 1)
          }
        } else {
          LeaderboardPage.setRemainingLaps(1);
        }
      }

      pendingCarList.forEach(function(car_id) {
        getRequest("/api/ac/car/" + car_id, Page.cb_updateCarName);
      });
      pendingDriverList.forEach(function(user_id) {
        getRequest("/api/ac/user/" + user_id, Page.cb_updateDriverName);
      });
    }
  }

  static cb_updateSessionInfo(data) {
    if (data["status"] == "success") {
      var session = data["session"];
      if (session["is_finished"] === 1) {
        $("#message").text("No Live session running for this event");
        $("#message").removeClass("hidden");
        return;
      }
      $("main").removeClass("hidden");

      $("#event-detail .active").removeClass("active");
      if (session["type"] === LeaderboardPage.SESSION_TYPE.RACE) {
        $("#event-detail .race .live").addClass("active");
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.PRACTICE) {
        $("#event-detail .practice .live").addClass("active");
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.QUALIFYING) {
        $("#event-detail .quali .live").addClass("active");
      }

      $("#track-condition .weather .value").text(Util.getWeatherDisplayName(session["weather"]));
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
        setRemainingTimeTimer(session["start_time"], session["duration_min"]);
      } else {
        $("#remaining span").addClass("remain-laps");
        $("#remaining").attr("data-laps", session["laps"]);
      }

      $("head title").text("SimView | Live " + session["type"] + " Session");
      $("#event-detail").attr("data-session", session["type"].toLocaleLowerCase());
      if (session["type"] == LeaderboardPage.SESSION_TYPE.RACE) {
        LeaderboardPage.setupRaceLeaderBoardHeader();
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.PRACTICE) {
        LeaderboardPage.setupPracticeLeaderBoardHeader();
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.QUALIFYING) {
        LeaderboardPage.setupQualiLeaderBoardHeader();
      }

      LeaderboardPage.sessionGripIntervalHandler = setInterval(function() {
        getRequest("/api/ac/session/" + session["session_id"], LeaderboardPage.cb_updateSessionGrip);
      }, 30 * 1000);

      var leaderboardApi = "/api/ac/session/" + session["session_id"] + "/leaderboard/" +
        session["type"].toLocaleLowerCase();
      getRequest(leaderboardApi, LeaderboardPage.cb_updateLeaderBoard);

      LeaderboardPage.sessionLeaderboardIntervalHandler = setInterval(function() {
        getRequest(leaderboardApi, LeaderboardPage.cb_updateLeaderBoard);
      }, 10 * 1000);

    }
  }

  static setupRaceLeaderBoardHeader() {
    var leaderboardHeader = `<tr>
      <td class="lb-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      <td class="lb-hr-car">Car</td>
      <td class="lb-hr-driver">Driver</td>
      <td class="lb-hr-laps">Laps</td>
      <td class="lb-hr-gap">Gap</td>
      <td class="lb-hr-interval">Int.</td>
      <td class="lb-hr-best-lap">Best</td>
      <td class="lb-hr-last-lap">Last</td>
      <td class="lb-hr-sec1">S1</td>
      <td class="lb-hr-sec2">S2</td>
      <td class="lb-hr-sec3">S3</td>
    </tr>`;
    $("#board-header").html(leaderboardHeader);
  }

  static setupQualiLeaderBoardHeader() {
    var leaderboardHeader = `<tr>
      <td class="lb-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      <td class="lb-hr-car">Car</td>
      <td class="lb-hr-driver">Driver</td>
      <td class="lb-hr-best-lap">Best</td>
      <td class="lb-hr-gap">Gap</td>
      <td class="lb-hr-interval">Int.</td>
      <td class="lb-hr-sec1">S1</td>
      <td class="lb-hr-sec2">S2</td>
      <td class="lb-hr-sec3">S3</td>
      <td class="lb-hr-laps">Laps</td>
    </tr>`;
    $("#board-header").html(leaderboardHeader);
  }

  static setupPracticeLeaderBoardHeader() {
    LeaderboardPage.setupQualiLeaderBoardHeader();
  }

  static setRemainingLaps(current_lap) {
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

  static setRemainingTime(start_time, duration_min) {
    var elapsedMS = Date.now() - Math.floor(start_time / 1000);
    var diffTime = duration_min * 60 - Math.floor(elapsedMS / 1000);
    var remainTime = Util.getTimeDiffString(diffTime);
    $("#remaining span").text(remainTime);

    var nextTimeout = 60000;
    if (diffTime < 60 * 60) {
      nextTimeout = 1000;
    }
    setTimeout(function() {
      LeaderboardPage.setRemainingTime(start_time, duration_min);
    }, nextTimeout);
  }
}

class EventsPage extends Page {
  static cb_updateAllEvents(data) {
    if (data["status"] == "success") {
      var eventHtml = ""
      for (var idx = 0; idx < data["events"].length; ++idx) {
        eventHtml += EventsPage.getEventHtml(data["events"][idx]);
      }
      $("#event-container").html(eventHtml);

      for (var idx = 0; idx < data["events"].length; ++idx) {
        getRequest("/api/ac/event/" + data["events"][idx]["event_id"] + "/session/latest", EventsPage.cb_updateActiveEvent);
      }
    }
  }

  static cb_updateActiveEvent(data) {
    if (data["status"] == "success") {
      var session = data["session"];
      if (session["is_finished"] === 0) {
        var sessionClass = "";
        if (session["type"] === LeaderboardPage.SESSION_TYPE.RACE) {
          sessionClass = "race";
        } else if (session["type"] === LeaderboardPage.SESSION_TYPE.PRACTICE) {
          sessionClass = "practice";
        } else if (session["type"] === LeaderboardPage.SESSION_TYPE.QUALIFYING) {
          sessionClass = "quali";
        }
        $("a[data-event-id=\"" + session["event_id"] + "\"] .event").addClass("live-event");
        var event = $("a[data-event-id=\"" + session["event_id"] + "\"] ." + sessionClass);
        event.find(".live").addClass("active");
      } else {
        var event = $("a[data-event-id=\"" + session["event_id"] + "\"]");
        event.find(".live").remove();
        event.removeAttr("href");
      }
    }
  }

  static getEventHtml(event) {
    return `<div class="single-event"><a data-event-id="${event["event_id"]}" href="${"/ac/event/" + event["event_id"] + "/live"}">
      <div class="event">
        <div class="header">
          <div class="title">${event["name"]}</div>
          <div class="server-container">
            <div class="server">${event["server_name"]}</div>
            ${(event["team_event"] ? "<div class=\"team\"></div>" : "")}
            <div class="clear-both"></div>
          </div>
        </div>
        <div class="time">
          <div class="practice">
            <div class="live"></div>
            <span class="tag">Practice</span>
            <span class="date">${(event["practice_start"] || "N/A")}</span>
          </div>
          <div class="quali">
            <div class="live"></div>
            <span class="tag">Qualification</span>
            <span class="date">${(event["quali_start"] || "N/A")}</span>
          </div>
          <div class="race">
            <div class="live"></div>
            <span class="tag">Race</span>
            <span class="date">${(event["race_start"] || "N/A")}</span>
          </div>
        </div>
        <div class="track">
          <div class="preview"><img src="/images/ac/track/${event["track_config_id"]}/preview"></div>
          <div class="clear-both"></div>
        </div>
        <div class="footer"></div>
      </div>
    </a></div>`;
  }
}

class LeaderBoard {
  static carList = {};
  static driverList = {};
  static carColorClass = [];
}

class QualiLeaderBoard {
  constructor() {
    this.entries = [];
    this.bestSec1Idx = -1;
    this.bestSec2Idx = -1;
    this.bestSec3Idx = -1;
  }

  addEntry(entry) {
    var idx = this.entries.length;
    this.entries.push(entry);
    if (entry.status === LeaderBoardEntry.STATUS.CONNECTED) {
      if (entry.bestLap.sec1 !== 0 && (this.bestSec1Idx == -1 ||
          entry.bestLap.sec1 < this.entries[this.bestSec1Idx].bestLap.sec1)) {
        this.bestSec1Idx = idx;
      }
      if (entry.bestLap.sec2 !== 0 && (this.bestSec2Idx == -1 ||
          entry.bestLap.sec2 < this.entries[this.bestSec2Idx].bestLap.sec2)) {
        this.bestSec2Idx = idx;
      }
      if (entry.bestLap.sec3 !== 0 && (this.bestSec3Idx == -1 ||
          entry.bestLap.sec3 < this.entries[this.bestSec3Idx].bestLap.sec3)) {
        this.bestSec3Idx = idx;
      }
    }
  }

  toHTML() {

  }

  static fromJSON(leaderboard) {
    var qualiLeaderBoard = new QualiLeaderBoard();
    for (var idx = 0; idx < leaderboard.length; ++idx) {
      var entry = leaderboard[idx];
      var bestLap = new Lap(entry["best_lap_time"], entry["sector_1"], entry["sector_2"]);
      var leaderBoardEntry = new QualiLeaderBoardEntry(entry["is_connected"], entry["is_finished"], entry["user_id"],
        entry["car_id"], bestLap, entry["gap"], entry["interval"], entry["valid_laps"]);

      qualiLeaderBoard.addEntry(leaderBoardEntry);
    }

    return qualiLeaderBoard;
  }
}

class LeaderBoardEntry {
  static STATUS = { CONNECTED: 0, DISCONNECTED: 1, FINISHED: 2 };

  static statusFromConnectedAndFinished(connected, finished) {
    if (finished === 1) {
      return LeaderBoardEntry.STATUS.FINISHED;
    } else if (connected === 1) {
      return LeaderBoardEntry.STATUS.CONNECTED;
    }
    return LeaderBoardEntry.STATUS.DISCONNECTED;
  }

  static getDriverStatusClass(status) {
    switch (status) {
      case LeaderBoardEntry.STATUS.FINISHED:
        return "status-chequered";
      case LeaderBoardEntry.STATUS.CONNECTED:
        return "status-green";
      case LeaderBoardEntry.STATUS.DISCONNECTED:
        return "status-red";
    }
  }
}

class QualiLeaderBoardEntry {
  constructor(connected, finished, driverId, carId, bestLap, gap, interval, totalLaps) {
    this.status = LeaderBoardEntry.statusFromConnectedAndFinished(connected, finished);
    this.driverId = driverId;
    this.carId = carId;
    this.bestLap = bestLap;
    this.gap = gap;
    this.interval = interval;
    this.totalLaps = totalLaps;
  }

  /**
   * Return weather this leaderboard entry is at top
   * @param {int} pos
   */
  isPurpleLap(pos) {
    return pos === 0 && this.status === LeaderBoardEntry.STATUS.CONNECTED && this.bestLap.lapTime !== 0;
  }

  /**
   * Return unordered list representing entry in QualiLeaderBoard page
   * All pos, bestSecXIdx count from 0
   * @param {int} pos
   * @param {int} bestSec1Idx
   * @param {int} bestSec2Idx
   * @param {int} bestSec3Idx
   */
  toHTML(pos, bestSec1Idx, bestSec2Idx, bestSec3Idx) {
    return `<tr data-pos="${pos + 1}">
      <td class="lb-pos">
        <span class="pos">${pos + 1}</span>
        <span class="status ${LeaderBoardEntry.getDriverStatusClass(this.status)}"></span>
      </td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}</td>
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')"">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}</td>
      <td class="lb-best-lap${(this.isPurpleLap(pos) ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="lb-sec1${(bestSec1Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec1)}</td>
      <td class="lb-sec2${(bestSec2Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec2)}</td>
      <td class="lb-sec3${(bestSec3Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec3)}</td>
      <td class="lb-laps">${this.totalLaps}</td>
    </tr>`;
  }
}

class RaceLeaderBoard {
  static prevLapList = {}

  constructor() {
    this.entries = [];
    this.bestLapIdx = -1;
  }

  addEntry(entry) {
    var idx = this.entries.length;
    this.entries.push(entry);
    if (entry.bestLapTime !== 0 && (this.bestLapIdx === -1 ||
        entry.bestLapTime < this.entries[this.bestLapIdx].bestLapTime)) {
      this.bestLapIdx = idx;
    }
  }

  toHTML() {

  }

  static fromJSON(leaderboard) {
    var raceLeaderBoard = new RaceLeaderBoard();
    for (var idx = 0; idx < leaderboard.length; ++idx) {
      var entry = leaderboard[idx];
      var lastLap = new Lap(entry["last_lap_time"], entry["sector_1"], entry["sector_2"]);
      var leaderBoardEntry = new RaceLeaderBoardEntry(entry["is_connected"], entry["is_finished"],
        entry["user_id"], entry["car_id"], entry["laps"], entry["gap"], entry["interval"], entry["best_lap_time"], lastLap);

      raceLeaderBoard.addEntry(leaderBoardEntry);

      if (lastLap.lapTime !== 0) {
        RaceLeaderBoard.prevLapList[leaderBoardEntry.driverId] = lastLap.lapTime;
      }
    }

    return raceLeaderBoard;
  }
}

class RaceLeaderBoardEntry {
  constructor(connected, finished, driverId, carId, totalLaps, gap, interval, bestLapTime, lastLap) {
    this.status = LeaderBoardEntry.statusFromConnectedAndFinished(connected, finished);
    this.driverId = driverId;
    this.carId = carId;
    this.totalLaps = totalLaps;
    this.gap = RaceLeaderBoardEntry.getGapFromBitmap(gap);
    this.interval = RaceLeaderBoardEntry.getGapFromBitmap(interval);
    this.bestLapTime = bestLapTime;
    this.lastLap = lastLap;
  }

  static getGapFromBitmap(gap) {
    if (gap !== undefined) {
      if ((gap & 1) === 0) {
        return gap >> 1;
      } else {
        return (gap >> 1) + " L";
      }
    }

    return gap;
  }

  /**
   * Return weather this leaderboard entry has the best lap in Race
   * @param {int} pos
   * @param {int} bestLapIdx
   */
  isPurpleLap(pos, bestLapIdx) {
    return pos === bestLapIdx && this.bestLapTime !== 0;
  }

  /**
   * pos count from 0
   * @param {int} pos
   */
  toHTML(pos, bestLapIdx) {
    return `<tr data-pos="${pos + 1}">
      <td class="lb-pos">
        <span class="pos">${pos + 1}</span>
        <span class="status ${LeaderBoardEntry.getDriverStatusClass(this.status)}"></span>
      </td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}</td>
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}</td>
      <td class="lb-laps">${this.totalLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="lb-best-lap${(this.isPurpleLap(pos, bestLapIdx) ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</td>
      <td class="lb-last-lap">${Lap.convertMSToDisplayTimeString(RaceLeaderBoard.prevLapList[this.driverId] !== undefined ? RaceLeaderBoard.prevLapList[this.driverId] : 0)}</td>
      <td class="lb-sec1">${Lap.convertMSToDisplayTimeString(this.lastLap.sec1)}</td>
      <td class="lb-sec2">${Lap.convertMSToDisplayTimeString(this.lastLap.sec2)}</td>
      <td class="lb-sec3">${Lap.convertMSToDisplayTimeString(this.lastLap.sec3)}</td>
    </tr>`;
  }
}

class Lap {
  static MILISECOND_SEPARATOR = ".";
  static SECOND_SEPARATOR = ":";
  static GAP_SYMBOL = "+";
  static NA_SYMBOL = "-";

  // time, sec1, sec2 are inetger representing time in milli second
  constructor(lapTime, sec1, sec2) {
    this.lapTime = lapTime;
    this.sec1 = sec1;
    this.sec2 = Lap.calculateSector2Time(lapTime, sec1, sec2);
    this.sec3 = Lap.calculateSector3Time(lapTime, sec1, this.sec2);
  }

  static calculateSector2Time(lapTime, sec1, sec2) {
    if (lapTime !== 0) {
      if (sec1 === 0) return 0;
      if (sec2 === 0) {
        return lapTime - sec1;
      } else {
        return sec2;
      }
    } else {
      return sec2;
    }
  }

  static calculateSector3Time(lapTime, sec1, sec2) {
    if (lapTime !== 0) {
      if (sec1 === 0) return 0;
      return lapTime - sec1 - sec2;
    } else {
      return 0;
    }
  }

  /**
   * For :
   * 1. 0 return empty string
   * 2. time greater than 60 min returns empty string
   * 3. return in MM:SS:SSS
   * @param {int} time
   */
  static convertMSToTimeString(time) {
    // Laptime in ms
    if (time === 0) return "";
    var min = "";
    var sec = "";
    var ms = "";

    ms = time % 1000;
    time = Math.floor(time / 1000);
    sec = time % 60;
    time = Math.floor(time / 60);
    min = time;
    if (min >= 60) {
      return "";
    }

    if (ms < 10) {
      ms = "00" + ms;
    } else if (ms < 100) {
      ms = "0" + ms;
    }

    if (min == 0) {
      return sec + Lap.MILISECOND_SEPARATOR + ms;
    }

    if (sec < 10) {
      sec = "0" + sec;
    }

    return min + Lap.SECOND_SEPARATOR + sec + Lap.MILISECOND_SEPARATOR + ms;
  }

  static convertMSToDisplayTimeString(time) {
    var timeStr = Lap.convertMSToTimeString(time);
    return timeStr === "" ? Lap.NA_SYMBOL : timeStr;
  }

  static convertToGapDisplayString(gap) {
    if (gap === undefined) return Lap.NA_SYMBOL;
    var gapString;
    if (typeof gap === "string") {
      gapString = gap;
    } else if (gap === 0) {
      gapString = "0.000";
    } else {
      gapString = Lap.convertMSToTimeString(gap);
    }

    return Lap.GAP_SYMBOL + gapString;
  }
}

class Util {
  static getWeatherDisplayName(weather) {
    weather = weather.split("_");
    if (weather[0] === "sol") {
      weather.shift();
    }
    weather.shift();
    return weather.join(" ");
  }

  static getTimeDiffString(diff) {
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

  static getCurrentEvent() {
    return window.location.toString().match("event/([0-9]+)/")[1];
  }

  static isLiveEventPage() {
    return window.location.toString().endsWith("/live");
  }

  static getCarColorClass(carId) {
    if (LeaderBoard.carList[carId] === undefined) return "";
    return "car-class-" + LeaderBoard.carColorClass.indexOf(LeaderBoard.carList[carId]["class"]);
  }
}

$(document).ready(function() {
  var page = $("body").attr("data-page");
  if (page == "lb-page") {
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), LeaderboardPage.cb_updateEventInfo);
  } else if (page == "events-page") {
    if (Util.isLiveEventPage()) {
      $("#link-live").addClass("active");
      $("title").text("SimView | Live Events");
      getRequest("/api/ac/events/live", EventsPage.cb_updateAllEvents);
    } else {
      $("#link-events").addClass("active");
      $("title").text("SimView | All Events")
      getRequest("/api/ac/events", EventsPage.cb_updateAllEvents);
    }
  }
});
