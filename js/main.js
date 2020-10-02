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
  static SESSION_TYPE = { PRACTICE: "Practice", QUALIFYING: "Qualifying", RACE: "Race" }
  static VERSION = "v0.5";

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

  static setCommonHeaderHtml(page) {
    var header = `<ul>
        <li class="${page === "live"? "active" : ""}" id="link-live"><a class="red" href="/live">Live</a></li>
        <li class="${page === "events"? "active" : ""}" id="link-events"><a href="/">Events</a></li>
        <li class="${page === "result"? "active" : ""}" id="link-result"><a href="/result">Result</a></li>
        <li><a href="https://www.racedepartment.com/downloads/simview.35249/" targer="_blank" rel="noreferrer noopener">SimView ${Page.VERSION}</a></li>
        <div class="clear-both"></div>
      </ul>`;
    $("#common-header").html(header);
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
        event.attr("href", "/ac/event/" + session["event_id"] + "/result");
      }
    }
  }

  static getEventHtml(event) {
    return `<div class="single-event">
      <a data-event-id="${event["event_id"]}" href="${"/ac/event/" + event["event_id"] + (Util.isLiveEventPage()? "/live" : "/result")}">
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
      var bestLap = new Lap(entry["best_lap_time"], entry["sector_1"], entry["sector_2"], entry["sector_3"]);
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
      var lastLap = new Lap(entry["last_lap_time"], entry["sector_1"], entry["sector_2"], entry["sector_3"]);
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
    this.gap = Util.getGapFromBitmap(gap);
    this.interval = Util.getGapFromBitmap(interval);
    this.bestLapTime = bestLapTime;
    this.lastLap = lastLap;
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
  constructor(lapTime, sec1, sec2, sec3) {
    this.lapTime = lapTime;
    this.sec1 = sec1;
    this.sec2 = sec2;
    this.sec3 = sec3;
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
    var solWeather = false;
    if (weather[0] === "sol") {
      weather.shift();
      solWeather = true;
    }
    weather.shift();
    return weather.join(" ") + (solWeather ? " (Sol)" : "");
  }

  static getTimeDiffString(diff) {
    // Diff in secs
    if (diff < 0) {
      return "--";
    } else if (diff < 60) {
      return diff + "S";
    } else if (diff < 60 * 60) {
      if (diff % 60 === 0) {
        return Math.floor(diff / 60) + "M";
      }
      return Math.floor(diff / 60) + "M " + (diff % 60) + "S";
    } else {
      diff = Math.floor(diff / 60);
      if (diff % 60 === 0) {
        return Math.floor(diff / 60) + "H";
      }
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
}

class ResultSectorTabEntry {
  constructor(driverId, carId, bestSectorTime, gap, interval) {
    this.driverId = driverId;
    this.carId = carId;
    this.bestSectorTime = bestSectorTime;
    this.gap = gap;
    this.interval = interval;
  }

  static fromJSON(data) {
    return new ResultSectorTabEntry(data["user_id"], data["car_id"], data["best_sector_time"], data["gap"], data["interval"]);
  }

  toHTML(pos) {
    return `<tr>
      <td class="sec-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}</td>
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')"">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}</td>
      <td class="sec-sec">${Lap.convertMSToDisplayTimeString(this.bestSectorTime)}</td>
      <td class="sec-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="sec-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      </tr>`;
  }
}

class QualiResultStandingTabEntry {
  constructor(driverId, carId, bestLapTime, validLaps, gap, interval, finishAt) {
    this.driverId = driverId;
    this.carId = carId;
    this.bestLapTime = bestLapTime;
    this.validLaps = validLaps;
    this.gap = gap;
    this.interval = interval;
    if (finishAt === 0) {
      this.finishAt = "N/A";
    } else {
      this.finishAt = (new Date(finishAt / 1000)).toUTCString();
    }
  }

  static fromJSON(data) {
    return new QualiResultStandingTabEntry(data["user_id"], data["car_id"], data["best_lap_time"],
      data["valid_laps"], data["gap"], data["interval"], data["lap_finish_time"]);
  }

  toHTML(pos) {
    return `<tr>
      <td class="st-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}</td>
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')"">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}</td>
      <td class="lb-best-lap">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</td>
      <td class="st-valid-laps">${this.validLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="st-finish-at">${this.finishAt}</td>
    </tr>`;
  }

  static getHeaderHtml() {
    return `<tr>
      <td class="st-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      <td class="lb-hr-car">Car</td>
      <td class="lb-hr-driver">Driver</td>
      <td class="lb-hr-best-lap">Best</td>
      <td class="st-hr-valid-laps">V. Laps</td>
      <td class="lb-hr-gap">Gap</td>
      <td class="lb-hr-interval">Int.</td>
      <td class="st-hr-finish-at">Finish At</td>
    </tr>`;
  }
}

class RaceResultStandingTabEntry {
  constructor(driverId, carId, laps, validLaps, gap, interval, totalTime) {
    this.driverId = driverId;
    this.carId = carId;
    this.laps = laps;
    this.validLaps = validLaps;
    this.gap = Util.getGapFromBitmap(gap);
    this.interval = Util.getGapFromBitmap(interval);
    this.totalTime = totalTime;
  }

  static fromJSON(data) {
    return new RaceResultStandingTabEntry(data["user_id"], data["car_id"], data["laps"],
      data["valid_laps"], data["gap"], data["interval"], data["total_time"]);
  }

  toHTML(pos) {
    return `<tr>
      <td class="st-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}</td>
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')"">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}</td>
      <td class="lb-laps">${this.laps}</td>
      <td class="st-valid-laps">${this.validLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="st-total">${Lap.convertMSToDisplayTimeString(this.totalTime)}</td>
    </tr>`;
  }

  static getHeaderHtml() {
    return `<tr>
      <td class="st-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      <td class="lb-hr-car">Car</td>
      <td class="lb-hr-driver">Driver</td>
      <td class="lb-hr-laps">Laps</td>
      <td class="st-hr-valid-laps">V. Laps</td>
      <td class="lb-hr-gap">Gap</td>
      <td class="lb-hr-interval">Int.</td>
      <td class="st-total">Total</td>
    </tr>`;
  }
}

class ResultSingleStintLapEntry {
  constructor(lapTime, sec1, sec2, sec3, grip, avgSpeed, maxSpeed, cuts, crashes, carCrashes, finishAt, isBestLap) {
    this.lapTime = lapTime;
    this.sec1 = sec1;
    this.sec2 = sec2;
    this.sec3 = sec3;
    this.grip = (grip <= 0 ? "-" : (grip * 100.0).toFixed(2));
    this.avgSpeed = (avgSpeed === 0 ? "-" : avgSpeed + " Km/Hr");
    this.maxSpeed = maxSpeed + " Km/Hr";
    this.cuts = cuts;
    this.crashes = crashes;
    this.carCrashes = carCrashes;
    if (finishAt === 0) {
      this.finishAt = "N/A";
    } else {
      this.finishAt = (new Date(finishAt / 1000)).toUTCString();
    }
    this.isBestLap = isBestLap;
  }

  static fromJSON(data) {
    return new ResultSingleStintLapEntry(data["lap_time"], data["sector_1"], data["sector_2"],
      data["sector_3"], data["grip"], data["avg_speed"], data["max_speed"], data["cuts"], data["crashes"], data["car_crashes"],
      data["finish_at"], data["best_lap"]);
  }

  toHTML(pos) {
    var lapType = "";
    if (!this.isValid()) {
      lapType = "invalid-lap"
    } else if (this.isBestLap) {
      lapType = "best-lap";
    }

    return `<tr class="${lapType}">
        <td class="st-no">${pos}</td>
        <td class="st-time">${Lap.convertMSToDisplayTimeString(this.lapTime)}</td>
        <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec1)}</td>
        <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec2)}</td>
        <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec3)}</td>
        <td class="st-grip">${this.grip}</td>
        <td class="st-avg">${this.avgSpeed}</td>
        <td class="st-max">${this.maxSpeed}</td>
        <td class="st-cuts">${this.cuts}</td>
        <td class="st-crashes">${this.crashes}</td>
        <td class="st-car-crashes">${this.carCrashes}</td>
        <td class="st-finish-time">${this.finishAt}</td>
      </tr>`;
  }

  isValid() {
    return this.cuts === 0 && this.crashes === 0 && this.carCrashes === 0;
  }

  static getHeaderHtml() {
    return `<tr>
        <td class="st-hr-no">No.</td>
        <td class="st-hr-time">Time</td>
        <td class="st-hr-sec">S1</td>
        <td class="st-hr-sec">S2</td>
        <td class="st-hr-sec">S3</td>
        <td class="st-hr-grip">Grip %</td>
        <td class="st-hr-avg">Avg. Speed</td>
        <td class="st-hr-max">Max. Speed</td>
        <td class="st-hr-cuts">Cuts</td>
        <td class="st-hr-crashes">Crashes</td>
        <td class="st-hr-car-crashes">Car crashes</td>
        <td class="st-hr-finish-time">Finish At</td>
      </tr>`;
  }
}

class ResultSingleStintEntry {
  constructor(totalLaps, validLaps, bestLapTime, avgLapTime, avgLapGap, lapList) {
    this.totalLaps = totalLaps;
    this.validLaps = validLaps;
    this.bestLapTime = bestLapTime;
    this.avgLapTime = avgLapTime;
    this.avgLapGap = avgLapGap;
    this.lapList = lapList;
  }

  static fromJSON(data) {
    var lapList = [];
    for (var idx = 0; idx < data["laps"].length; ++idx) {
      lapList.push(ResultSingleStintLapEntry.fromJSON(data["laps"][idx]));
    }

    return new ResultSingleStintEntry(data["total_laps"], data["valid_laps"], data["best_lap_time"],
      data["avg_lap_time"], data["avg_lap_gap"], lapList);
  }

  toHTML(pos) {
    var stintHtml = `<div class="driver-stint">
      <div class="stint-summary">
        <ul>
          <li><span class="st-tag">Stint</span><span class="st-value">${pos}</span></li>
          <li><span class="st-tag">Valid Laps</span><span class="st-value">${this.validLaps}</span></li>
          <li><span class="st-tag">Laps</span><span class="st-value">${this.totalLaps}</span></li>
          <li><span class="st-tag">Best Lap</span><span class="st-value">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</span></li>
          <li><span class="st-tag">Avg. Lap</span><span class="st-value">
            ${Lap.convertMSToDisplayTimeString(this.avgLapTime)} ( ${Lap.convertToGapDisplayString(this.avgLapGap)} )
          </span></li>
          <div class="clear-both"></div>
        </ul>
      </div>`;

    stintHtml += `<div class="stint-laps">
      <table>
        <thead class="hr-stint-laps">`;
    stintHtml += ResultSingleStintLapEntry.getHeaderHtml();
    stintHtml += `</thead>
      <tbody class="bd-stint-laps">`;
    var lapsHtml = "";
    for (var idx = 0; idx < this.lapList.length; ++idx) {
      lapsHtml += this.lapList[idx].toHTML(idx + 1);
    }
    stintHtml += lapsHtml;
    stintHtml += `</tbody>
          </table>
        </div>
      </div>`;

    return stintHtml;
  }
}

class ResultStintTabEntry {
  constructor(driverId, carId, stintList) {
    this.driverId = driverId;
    this.carId = carId;
    this.stintList = stintList;
  }

  static fromJSON(data) {
    var stints = [];
    for (var idx = 0; idx < data["stints"].length; ++idx) {
      stints.push(ResultSingleStintEntry.fromJSON(data["stints"][idx]));
    }

    return new ResultStintTabEntry(data["user_id"], data["car_id"], stints);
  }

  toHTML() {
    var allStints = `<div class="driver-stints" data-driver-id="${this.driverId}">
      <div class="stint-driver">
        <div class="left stint-driver-name lb-driver" data-driver-id="${this.driverId}">
          ${((LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : "")}
        </div>
        <div class="left">|</div>
        <div class="left stint-driver-class lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">
          ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["class"] : "")}
        </div>
        <div class="left">|</div>
        <div class="left stint-driver-car lb-car" data-car-id="${this.carId}">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')"">
            ${((LeaderBoard.carList[this.carId] !== undefined) ? LeaderBoard.carList[this.carId]["name"] : "")}
          </span>
        </div>
        <div class="right"><span class="arrow-up"></span></div>
        <div class="clear-both"></div>
      </div>`;
    var stintsHtml = "";
    for (var idx = 0; idx < this.stintList.length; ++idx) {
      stintsHtml += this.stintList[idx].toHTML(idx + 1);
    }
    allStints += `<div class="stints-container">${stintsHtml}</div>` +
      `</div>`;

    return allStints;
  }
}

class ResultPage extends Page {
  static cb_updateEventInfo(data) {
    if (data["status"] == "success") {
      var event = data["event"];
      $("#event-detail .title").text(event["name"]);
      $("#event-detail .server").text(event["server_name"]);
      $("#track-detail img").attr("src", "/images/ac/track/" + event["track_config_id"] + "/preview");
      $("title").text("SimView | Result | " + event["name"]);

      getRequest("/api/ac/track/" + event["track_config_id"], ResultPage.cb_updateTrackInfo);
      getRequest("/api/ac/event/" + event["event_id"] + "/sessions", ResultPage.cb_updateAllSessions);
    }
  }

  static cb_updateTrackInfo(data) {
    if (data["status"] == "success") {
      var track = data["track"];
      $("#track-detail .name").text(track["display_name"]);
      $("#track-detail img").attr("alt", track["display_name"]);
      $("#track-detail .city").text(track["city"]);
      $("#track-detail .country").text(track["country"]);
      $("#track-detail .length").text((track["length"] / 1000).toFixed(2) + " KM");
    }
  }

  static cb_updateSessionDetail(data) {
    if (data["status"] === "success") {
      var session = data["session"];
      $("#message").addClass("hidden-opacity");
      if (session["is_finished"] === 0) {
        $("#message").html("The results data may not be final as session is still running <a href='/ac/event/" + session["event_id"] + "/live'>[Go Live]</a>").removeClass("hidden-opacity");
      }
      $("#session-summary .weather .value").text(Util.getWeatherDisplayName(session["weather"]));
      $("#session-summary .air-temp .temp-val").text(session["air_temp"]);
      $("#session-summary .road-temp .temp-val").text(session["road_temp"]);
      if (session["start_grip"] != -1) {
        $("#session-summary .start-grip .value").text((session["start_grip"] * 100).toFixed(1) + "%");
      }
      if (session["current_grip"] != -1) {
        $("#session-summary .final-grip .value").text((session["current_grip"] * 100).toFixed(1) + "%");
      }
      $("#session-summary .start .value").text((new Date(parseInt(session["start_time"]) / 1000)).toUTCString());
      var finishTime = parseInt(session["finish_time"]);
      if (session["is_finished"] === 0) {
        finishTime = 0;
      }
      var finishTimeStr = "-";
      if (finishTime !== 0) {
        finishTimeStr = (new Date(finishTime / 1000)).toUTCString();
      }
      $("#session-summary .finish .value").text(finishTimeStr);
      if (session["laps"] === 0) {
        $("#session-summary .duration .value").text(Util.getTimeDiffString(session["duration_min"] * 60));
      } else {
        $("#session-summary .duration .value").text(session["laps"] + " L");
      }
    }
  }

  static cb_updateStandingsTab(data) {
    if (data["status"] === "success") {
      var standings = data["standings"];
      var pendingCarList = new Set();
      var pendingDriverList = new Set();

      var sessionType = $("select[name='select-session'] option:selected").text().toLowerCase().split(' ')[0];
      if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() || sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
        $("#standings-header").html(QualiResultStandingTabEntry.getHeaderHtml());
      } else {
        $("#standings-header").html(RaceResultStandingTabEntry.getHeaderHtml());
      }
      var standingsHtml = "";
      for (var idx = 0; idx < standings.length; ++idx) {
        if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() || sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
          standingsHtml += QualiResultStandingTabEntry.fromJSON(standings[idx]).toHTML(idx + 1);
        } else {
          standingsHtml += RaceResultStandingTabEntry.fromJSON(standings[idx]).toHTML(idx + 1);
        }

        if (LeaderBoard.carList[standings[idx]["car_id"]] === undefined) {
          pendingCarList.add(standings[idx]["car_id"]);
        }
        if (LeaderBoard.driverList[standings[idx]["user_id"]] === undefined) {
          pendingDriverList.add(standings[idx]["user_id"]);
        }
      }
      $("#standings-body").html(standingsHtml);

      pendingCarList.forEach(function(car_id) {
        getRequest("/api/ac/car/" + car_id, Page.cb_updateCarName);
      });
      pendingDriverList.forEach(function(user_id) {
        getRequest("/api/ac/user/" + user_id, Page.cb_updateDriverName);
      });
    }
  }

  static cb_updateSectorsTab(data) {
    if (data["status"] === "success") {
      var sectors = data["sectors"];
      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      for (var sectorIdx = 1; sectorIdx <= 3; ++sectorIdx) {
        $("#sec-header-" + sectorIdx).html(ResultPage.getSectorsResultHeaderHtml(sectorIdx));
        var sectorList = sectors["sector" + sectorIdx];
        var sectorHtml = "";
        for (var idx = 0; idx < sectorList.length; ++idx) {
          var entry = ResultSectorTabEntry.fromJSON(sectorList[idx]);
          sectorHtml += entry.toHTML(idx + 1);
          if (LeaderBoard.carList[entry.carId] === undefined) {
            pendingCarList.add(entry.carId);
          }
          if (LeaderBoard.driverList[entry.driverId] === undefined) {
            pendingDriverList.add(entry.driverId);
          }
        }
        $("#sec-body-" + sectorIdx).html(sectorHtml);
      }

      pendingCarList.forEach(function(car_id) {
        getRequest("/api/ac/car/" + car_id, Page.cb_updateCarName);
      });
      pendingDriverList.forEach(function(user_id) {
        getRequest("/api/ac/user/" + user_id, Page.cb_updateDriverName);
      });
    }
  }

  static cb_updateStintsTab(data) {
    if (data["status"] === "success") {
      var stints = data["stints"];
      var pendingCarList = new Set();
      var pendingDriverList = new Set();

      var stintsHtml = "";
      for (var idx = 0; idx < stints.length; ++idx) {
        var stint = ResultStintTabEntry.fromJSON(stints[idx]);
        stintsHtml += stint.toHTML();

        if (LeaderBoard.carList[stint.carId] === undefined) {
          pendingCarList.add(stint.carId);
        }
        if (LeaderBoard.driverList[stint.driverId] === undefined) {
          pendingDriverList.add(stint.driverId);
        }
      }
      $("#stints-tab").html(stintsHtml);

      pendingCarList.forEach(function(car_id) {
        getRequest("/api/ac/car/" + car_id, Page.cb_updateCarName);
      });
      pendingDriverList.forEach(function(user_id) {
        getRequest("/api/ac/user/" + user_id, Page.cb_updateDriverName);
      });
    }
  }

  static cb_updateAllSessions(data) {
    if (data["status"] == "success") {
      var sessions = data["sessions"];
      var practiceCount = 0;
      var qualificationCount = 0;
      var raceCount = 0;
      for (var idx = 0; idx < sessions.length; ++idx) {
        var session = sessions[idx];
        if (session["type"] === Page.SESSION_TYPE.PRACTICE) {
          practiceCount++;
        } else if (session["type"] === Page.SESSION_TYPE.QUALIFYING) {
          qualificationCount++;
        } else if (session["type"] === Page.SESSION_TYPE.RACE) {
          raceCount++;
        }
      }

      $("#session-count .practice .value").text(practiceCount);
      $("#session-count .qualification .value").text(qualificationCount);
      $("#session-count .race .value").text(raceCount);

      $("select[name='select-session']").html(ResultPage.getResultSidebarHtml(sessions, practiceCount,
        qualificationCount, raceCount)).change(function() {
        var sessionId = $(this).val();
        var sessionType = $("option[value='" + sessionId + "'").attr("data-session-type");
        getRequest("/api/ac/session/" + sessionId, ResultPage.cb_updateSessionDetail);
        getRequest("/api/ac/session/" + sessionId + "/result/sectors", ResultPage.cb_updateSectorsTab);
        getRequest("/api/ac/session/" + sessionId + "/result/stints", ResultPage.cb_updateStintsTab);
        getRequest("/api/ac/session/" + sessionId + "/" + sessionType + "/result/standings",
          ResultPage.cb_updateStandingsTab);
      });
    }
  }

  static getResultSidebarHtml(sessions, practiceCount, qualificationCount, raceCount) {
    var sidebarHtml = "<option value='0'>Select Session</option>";
    var practiceIdx = practiceCount;
    var qualificationIdx = qualificationCount;
    var raceIdx = raceCount;
    for (var idx = 0; idx < sessions.length; ++idx) {
      var session = sessions[idx];
      var sessionText;
      if (session["type"] === Page.SESSION_TYPE.PRACTICE) {
        sessionText = Page.SESSION_TYPE.PRACTICE;
        if (practiceCount > 1) {
          sessionText += " " + practiceIdx;
          practiceIdx--;
        }
      } else if (session["type"] === Page.SESSION_TYPE.QUALIFYING) {
        sessionText = Page.SESSION_TYPE.QUALIFYING;
        if (qualificationCount > 1) {
          sessionText += " " + qualificationIdx;
          qualificationIdx--;
        }
      } else if (session["type"] === Page.SESSION_TYPE.RACE) {
        sessionText = Page.SESSION_TYPE.RACE;
        if (raceCount > 1) {
          sessionText += " " + raceIdx;
          raceIdx--;
        }
      }
      if (session["is_finished"] === 0) {
        sessionText += " [ LIVE ]";
      }
      sidebarHtml += `<option data-session-finish="${session["is_finished"]}" data-session-type="${session["type"].toLowerCase()}" value="${session["session_id"]}">${sessionText}</option>`;
    }

    return sidebarHtml;
  }

  static getSectorsResultHeaderHtml(sector_idx) {
    return `<tr>
        <td class="sec-hr-pos">Pos</td>
        <td class="sec-hr-car-class">Class</td>
        <td class="sec-hr-car">Car</td>
        <td class="sec-hr-driver">Driver</td>
        <td class="sec-hr-sec">BS ${sector_idx}</td>
        <td class="sec-hr-gap">Gap</td>
        <td class="sec-hr-interval">Int.</td>
      </tr>`;
  }
}

$(document).ready(function() {
  var page = $("body").attr("data-page");
  if (page == "lb-page") {
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), LeaderboardPage.cb_updateEventInfo);
  } else if (page == "events-page") {
    if (Util.isLiveEventPage()) {
      Page.setCommonHeaderHtml("live");
      $("#link-live").addClass("active");
      $("title").text("SimView | Live Events");
      getRequest("/api/ac/events/live", EventsPage.cb_updateAllEvents);
    } else {
      Page.setCommonHeaderHtml("events");
      $("#link-events").addClass("active");
      $("title").text("SimView | All Events")
      getRequest("/api/ac/events", EventsPage.cb_updateAllEvents);
    }
  } else if (page == "result-page") {
    Page.setCommonHeaderHtml("result");
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), ResultPage.cb_updateEventInfo);
    $(".result-tabs").hide();
    $("#standings-tab").show();
    $("#result-main-tabs").click(function(e) {
      if (e.target.tagName === "UL") { return; }
      $("#result-main-tabs li.active").removeClass("active");
      e.target.classList.add("active");

      $(".result-tabs").hide();
      var tabToDisplay = "#" + e.target.getAttribute("data-tab") + "-tab";
      $(tabToDisplay).fadeIn();
    });

    $("#stints-tab").click(function(e) {
      var stintBar;
      if ($(e.target).hasClass('stint-driver')) {
        stintBar = $(e.target);
      } else if ($(e.target).parents('.stint-driver').length === 1) {
        stintBar = $(e.target).parents('.stint-driver');
      }
      if (stintBar !== undefined) {
        stintBar.next().slideToggle();
        stintBar.find('.arrow-up').toggleClass('rotate-180-clock');
      }
    });

  }
});
