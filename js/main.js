function getRequest(url, callback, failure) {
  $.ajax({
    type: "GET",
    url: url,
    crossDomain: true,
    success: function(data) { callback(data); },
    error: function() {
      if (failure === undefined) {
        console.log(arguments);
      } else {
        failure();
      }
    }
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
  static VERSION = "v0.9";

  static cb_updateTeamsName(data) {
    if (data["status"] === "success") {
      var teams = data["teams"];
      LeaderBoard.teamList = {};
      for (var idx = 0; idx < teams.length; ++idx) {
        var team = teams[idx];
        LeaderBoard.teamList[team["team_id"]] = team;
        $(".lb-team-no[data-team-id='" + team["team_id"] + "']").text(team["team_no"]);
        $(".lb-team[data-team-id='" + team["team_id"] + "']").text(team["name"]);
      }
    }
  }

  static cb_updateCarName(data) {
    if (data["status"] === "success") {
      var car = data["car"];
      LeaderBoard.carList[car["car_id"]] = { "name": car["display_name"], "class": car["car_class"], "ac_name": car["name"] };
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
        <li class="${page === "bestlap"? "active" : ""}" id="link-bestlap"><a href="/bestlap">Best Laps</a></li>
        <li class="${page === "driver"? "active" : ""}" id="link-driver"><a href="/driver">Driver</a></li>
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

      $("#event-detail").attr("data-event-id", event["event_id"]).attr("data-team-event", event["team_event"]).
      attr("data-use-number", event["use_number"]).attr("data-track", event["track_config_id"]).
      attr("data-livery-preview", event["livery_preview"]).attr("data-race-extra-laps", event["race_extra_laps"]).
      attr("data-race-wait-time", event["race_wait_time"]).attr("data-reverse-grid", event["reverse_grid_positions"]);

      $("#event-detail .title").text(event["name"]);
      $("#event-detail .server").text(event["server_name"]);

      var practiceDuration = EventsPage.getPracticeDurationStr(event);
      var qualiDuration = EventsPage.getQualiDurationStr(event);
      var raceDuration = EventsPage.getRaceDurationStr(event);
      if (practiceDuration === "-") {
        $("#event-detail .practice").addClass("disabled");
      } else {
        $("#event-detail .practice .date").text(practiceDuration);
      }
      if (qualiDuration === "-") {
        $("#event-detail .quali").addClass("disabled");
      } else {
        $("#event-detail .quali .date").text(qualiDuration);
      }
      if (raceDuration === "-") {
        $("#event-detail .race").addClass("disabled");
      } else {
        $("#event-detail .race .date").text(raceDuration);
      }

      var trackApi = "/ac/track/" + event["track_config_id"];
      getRequest("/api" + trackApi, LeaderboardPage.cb_updateTrackInfo);
      $("#track-preview img").attr("src", "/images" + trackApi + "/preview");

      getRequest("/images" + trackApi + "/map", function(data) {
        $("#track-map-svg").html(data.childNodes[0].outerHTML);
      }, LeaderboardPage.cb_missingTrackMap);
      getRequest("/api/ac/event/" + event["event_id"] + "/session/latest", LeaderboardPage.cb_updateSessionInfo);
    }
  }

  static cb_missingTrackMap() {
    var trackName = $("#track-preview .name").text();
    if (trackName === "") {
      trackName = "this track"
    }
    $("#track-missing").text(`Live Track Map is missing for ${trackName}!`).removeClass("hidden");
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
        if (session["type"] !== "Race" || $("#event-detail").attr("data-reverse-grid") !== undefined) {
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

      var pendingTeams = false;
      var pendingCarList = new Set();
      var pendingDriverList = new Set();

      var sessionType = $("#event-detail").attr("data-session");
      if (sessionType == "race") {
        leaderboard = RaceLeaderBoard.fromJSON(leaderboard);
      } else {
        leaderboard = QualiLeaderBoard.fromJSON(leaderboard);
      }

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();
      var pos = 0;
      for (var entry of leaderboard.entries) {
        if (sessionType === "race") {
          leaderboardHtml += entry.toHTML(pos, teamEvent, useTeamNumber, leaderboard.bestLapIdx);
        } else {
          leaderboardHtml += entry.toHTML(pos, teamEvent, useTeamNumber, leaderboard.bestSec1Idx, leaderboard.bestSec2Idx, leaderboard.bestSec3Idx);
        }

        if (teamEvent && LeaderBoard.teamList[entry.teamId] === undefined) {
          pendingTeams = true;
        }
        if (LeaderBoard.carList[entry.carId] === undefined) {
          pendingCarList.add(entry.carId);
        }
        if (entry.driverId !== undefined && LeaderBoard.driverList[entry.driverId] === undefined) {
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
      } else if (sessionType === "race" && leaderboard.entries[0] !== undefined) {
        if (leaderboard.entries[0].status === LeaderBoardEntry.STATUS.FINISHED) {
          $("#event-detail").attr("data-finished", "true");
        } else if ($("#event-detail").attr("data-total-laps") !== undefined) {
          if (leaderboard.entries[0].totalLaps > Number.parseInt($("#event-detail").attr("data-total-laps"))) {
            $("#event-detail").removeAttr("data-total-laps").removeAttr("data-race-extra-laps");
          }
        }
      }

      if (pendingTeams) {
        getRequest("/api/ac/event/" + Util.getCurrentEvent() + "/teams", Page.cb_updateTeamsName);
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

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();
      $("head title").text("SimView | Live " + session["type"] + " Session");
      $("#event-detail").attr("data-session", session["type"].toLocaleLowerCase());
      if (session["type"] == LeaderboardPage.SESSION_TYPE.RACE) {
        LeaderboardPage.setupRaceLeaderBoardHeader(teamEvent, useTeamNumber);
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.PRACTICE) {
        LeaderboardPage.setupPracticeLeaderBoardHeader(teamEvent, useTeamNumber);
      } else if (session["type"] === LeaderboardPage.SESSION_TYPE.QUALIFYING) {
        LeaderboardPage.setupQualiLeaderBoardHeader(teamEvent, useTeamNumber);
      }

      LeaderboardPage.sessionGripIntervalHandler = setInterval(function() {
        getRequest("/api/ac/session/" + session["session_id"], LeaderboardPage.cb_updateSessionGrip);
      }, 5 * 1000);

      var leaderboardApi = "/api/ac/session/" + session["session_id"] + "/leaderboard/" +
        session["type"].toLocaleLowerCase();
      getRequest(leaderboardApi, LeaderboardPage.cb_updateLeaderBoard);

      LeaderboardPage.sessionLeaderboardIntervalHandler = setInterval(function() {
        getRequest(leaderboardApi, LeaderboardPage.cb_updateLeaderBoard);
      }, 1 * 1000);

    }
  }

  static cb_updateTeamMembersInOverlay(data) {
      if (data["status"] == "success") {
        var driverList = data["members"];
        var driverListHtml = "";
        for (var idx = 0; idx < driverList.length; ++idx) {
          var driver = driverList[idx];
          driverListHtml += `<div class="driver">
            ${driver["country"]? `<span class="left driver-country">
              <img alt="N/A" src="${Util.getCountryFlagUrl(driver["country"])}">
            </span>` : ""}
            <span class="left driver-name">${driver["name"]}</span>
            </div>`;
      }
    }
    $("#drivers-list").html(driverListHtml);
  }

  static c_updateTeamDetailInOverlay(teamId) {
    var team = LeaderBoard.teamList[teamId];
    $("#team-car-class").removeClass();
    $("#team-car-class").addClass(Util.getCarColorClass(team["car_id"]));
    var car = LeaderBoard.carList[team["car_id"]];
    $("#team-car-class").text(car["class"]);
    $("#team-car").text(car["name"]);
    if (Util.isCurrentTeamEventUseNumber()) {
      $("#team-no").text("#" + team["team_no"]);
    }
    $("#team-name").text(team["name"]);
    if (Util.isCurrentTeamEventUseLiveryPreview()) {
      var previewFileUrl = `/images/ac/car/${car["ac_name"]}/livery/${team["livery_name"]}/preview`;
      $("#livery-preview").prepend(`<img alt="Livery Preview Not Available" src="${previewFileUrl}">`);
    }
    getRequest(`/api/ac/team/${teamId}/members`, LeaderboardPage.cb_updateTeamMembersInOverlay);
  }

  static setupRaceLeaderBoardHeader(teamEvent, useTeamNumber) {
      var leaderboardHeader = `<tr>
      <td class="lb-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      ${useTeamNumber === true? `<td class="lb-hr-team-no">No.</td>` : ""}
      ${teamEvent === true? `<td class="lb-hr-team">Team</td>` : ""}
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

  static setupQualiLeaderBoardHeader(teamEvent, useTeamNumber) {
    var leaderboardHeader = `<tr>
      <td class="lb-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      ${useTeamNumber === true? `<td class="lb-hr-team-no">No.</td>` : ""}
      ${teamEvent === true? `<td class="lb-hr-team">Team</td>` : ""}
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

  static setupPracticeLeaderBoardHeader(teamEvent, useTeamNumber) {
    LeaderboardPage.setupQualiLeaderBoardHeader(teamEvent, useTeamNumber);
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
    var raceWait = Number.parseInt($("#event-detail").attr("data-race-wait-time"));
    var remainTime;
    var waitForGreen = (elapsedMS <= raceWait * 1000) && $("#event-detail").attr("data-session") === "race";
    if (waitForGreen) {
      remainTime = "- " + Util.getTimeDiffString(raceWait - Math.floor(elapsedMS / 1000)) + " -";
    } else {
      var diffTime = duration_min * 60 - Math.floor(elapsedMS / 1000);
      if ($("#event-detail").attr("data-session") === "race") {
        diffTime += raceWait;
      }
      if (diffTime < 0 && $("#event-detail").attr("data-session") === "race") {
        if ($("#event-detail").attr("data-finished") !== undefined) {
          remainTime = "Finished";
        } else if($("#event-detail").attr("data-race-extra-laps") === "1") {
          remainTime = "+1 Lap";
          $("#event-detail").attr("data-total-laps", $("#board-body [data-pos='1'] .lb-laps").text())
        } else {
          remainTime = "Last Lap";
        }
      } else {
        remainTime = Util.getTimeDiffString(diffTime);
      }
    }
    $("#remaining span").text(remainTime);

    var nextTimeout = 60000;
    if (waitForGreen || diffTime < 60 * 60) {
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
      if (data["events"].length === 0) {
        if (Util.isLiveEventPage()) {
          $("#event-missing").text("No live events running");
        } else {
          $("#event-missing").text("No Events stored");
        }
        $("#event-missing").removeClass("hidden");
        return;
      }
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

  static getPracticeDurationStr(event) {
    return event["practice_duration"] === -1? "-" : Util.getMinuteTimeDiffString(event["practice_duration"]);
  }

  static getQualiDurationStr(event) {
    return event["quali_duration"] === -1? "-" : Util.getMinuteTimeDiffString(event["quali_duration"]);
  }

  static getRaceDurationStr(event) {
    var raceDuration = "-";
    if (event["race_duration"] !== -1) {
      if (event["race_duration_type"] === 0) {
        raceDuration = Util.getMinuteTimeDiffString(event["race_duration"]);
      } else {
        raceDuration = event["race_duration"] + "Laps"
      }

      if (event["race_extra_laps"] !== 0) {
        raceDuration += " | +" +  event["race_extra_laps"];
      }
      if (event["reverse_grid_positions"] !== 0) {
        raceDuration += " | RG (" + (event["reverse_grid_positions"] === -1? "All" : event["reverse_grid_positions"]) + ")";
      }
    }

    return raceDuration;
  }

  static getEventHtml(event) {
    var practiceDuration = EventsPage.getPracticeDurationStr(event);
    var qualiDuration = EventsPage.getQualiDurationStr(event);
    var raceDuration = EventsPage.getRaceDurationStr(event);

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
            <div class="practice ${practiceDuration === "-"? "disabled": ""}">
              <div class="live"></div>
              <span class="tag">Practice</span>
              <span class="date">${practiceDuration}</span>
            </div>
            <div class="quali ${qualiDuration === "-"? "disabled": ""}">
              <div class="live"></div>
              <span class="tag">Qualification</span>
              <span class="date">${qualiDuration}</span>
            </div>
            <div class="race ${raceDuration === "-"? "disabled": ""}">
              <div class="live"></div>
              <span class="tag">Race</span>
              <span class="date">${raceDuration}</span>
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
  static teamList = {};
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
      var leaderBoardEntry = new QualiLeaderBoardEntry(entry["is_connected"], entry["is_loaded"], entry["is_finished"],
       entry["team_id"], entry["user_id"], entry["car_id"], bestLap, entry["gap"], entry["interval"], entry["pos_x"], entry["pos_z"], entry["valid_laps"]);

      qualiLeaderBoard.addEntry(leaderBoardEntry);
    }

    return qualiLeaderBoard;
  }
}

class LeaderBoardEntry {
  static STATUS = { CONNECTED: 0, DISCONNECTED: 1, FINISHED: 2, LOADING: 3 };

  static statusFromConnectedAndFinished(connected, loaded, finished) {
    if (finished === 1) {
      return LeaderBoardEntry.STATUS.FINISHED;
    } else if (connected === 1) {
      if (loaded === 1) {
        return LeaderBoardEntry.STATUS.CONNECTED;
      } else {
        return LeaderBoardEntry.STATUS.LOADING;
      }
    }
    return LeaderBoardEntry.STATUS.DISCONNECTED;
  }

  static getDriverStatusClass(status) {
    switch (status) {
      case LeaderBoardEntry.STATUS.FINISHED:
        return "status-chequered";
      case LeaderBoardEntry.STATUS.CONNECTED:
        return "status-green";
      case LeaderBoardEntry.STATUS.LOADING:
        return "status-yellow";
      case LeaderBoardEntry.STATUS.DISCONNECTED:
        return "status-red";
    }
  }
}

class QualiLeaderBoardEntry {
  constructor(connected, loaded, finished, teamId, driverId, carId, bestLap, gap, interval, posX, posZ, totalLaps) {
    this.status = LeaderBoardEntry.statusFromConnectedAndFinished(connected, loaded, finished);
    this.teamId = teamId
    this.driverId = driverId;
    this.carId = carId;
    this.bestLap = bestLap;
    this.gap = gap;
    this.posX = posX;
    this.posZ = posZ;
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
  toHTML(pos, teamEvent, useTeamNumber, bestSec1Idx, bestSec2Idx, bestSec3Idx) {
    TrackMap.syncDriverMapStatus(pos, this.status, this.teamId, this.driverId, this.carId, teamEvent, useTeamNumber, this.posX, this.posZ);

    return `<tr data-pos="${pos + 1}">
      <td class="lb-pos">
        <span class="pos">${pos + 1}</span>
        <span class="status ${LeaderBoardEntry.getDriverStatusClass(this.status)}"></span>
      </td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
        ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
      ${teamEvent? `<td class="lb-team activate-overlay" data-team-id="${this.teamId}">${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
      <td class="lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">
        ${(this.driverId !== undefined && LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : ""}</td>
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
      var leaderBoardEntry = new RaceLeaderBoardEntry(entry["is_connected"], entry["is_loaded"], entry["is_finished"], entry["team_id"],
        entry["user_id"], entry["car_id"], entry["laps"], entry["gap"], entry["interval"], entry["pos_x"], entry["pos_z"], entry["best_lap_time"], lastLap);

      raceLeaderBoard.addEntry(leaderBoardEntry);

      if (lastLap.lapTime !== 0) {
        RaceLeaderBoard.prevLapList[leaderBoardEntry.driverId] = lastLap.lapTime;
      }
    }

    return raceLeaderBoard;
  }
}

class RaceLeaderBoardEntry {
  constructor(connected, loaded, finished, teamId, driverId, carId, totalLaps, gap, interval, posX, posZ, bestLapTime, lastLap) {
    this.status = LeaderBoardEntry.statusFromConnectedAndFinished(connected, loaded, finished);
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.totalLaps = totalLaps;
    this.gap = Util.getGapFromBitmap(gap);
    this.interval = Util.getGapFromBitmap(interval);
    this.posX = posX;
    this.posZ = posZ;
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
  toHTML(pos, teamEvent, useTeamNumber, bestLapIdx) {
    TrackMap.syncDriverMapStatus(pos, this.status, this.teamId, this.driverId, this.carId, teamEvent, useTeamNumber, this.posX, this.posZ);

    return `<tr data-pos="${pos + 1}">
      <td class="lb-pos">
        <span class="pos">${pos + 1}</span>
        <span class="status ${LeaderBoardEntry.getDriverStatusClass(this.status)}"></span>
      </td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
        ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
      ${teamEvent? `<td class="lb-team activate-overlay" data-team-id="${this.teamId}">${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
      <td class="lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}">
        ${(this.driverId !== undefined && LeaderBoard.driverList[this.driverId] !== undefined) ? LeaderBoard.driverList[this.driverId] : ""}</td>
      <td class="lb-laps">${this.totalLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="lb-best-lap${(this.isPurpleLap(pos, bestLapIdx) ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</td>
      <td class="lb-last-lap">${Lap.convertMSToDisplayTimeString(RaceLeaderBoard.prevLapList[this.driverId] !== undefined? RaceLeaderBoard.prevLapList[this.driverId] : 0)}</td>
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
  static NEGATIVE_GAP_SYMBOL = "-";

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
    } else if (gap < 0) {
      return Lap.NEGATIVE_GAP_SYMBOL + Lap.convertMSToTimeString(-gap);
    } else {
      gapString = Lap.convertMSToTimeString(gap);
    }

    return Lap.GAP_SYMBOL + gapString;
  }

  static convertToGapPercentDisplayString(gap) {
    if (gap === undefined) return Lap.NA_SYMBOL;
    var gapString;
    if (typeof gap === "string") {
      gapString = gap;
    } else if (gap === 0) {
      gapString = "0.00";
    } else if (gap < 0) {
      return Lap.NEGATIVE_GAP_SYMBOL + (-gap * 100).toFixed(2);
    } else {
      gapString = (gap * 100).toFixed(2);
    }

    return Lap.GAP_SYMBOL + gapString + "%";
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

  static getMinuteTimeDiffString(diff) {
    return Util.getTimeDiffString(diff * 60);
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

  static getPluralSuffix(count) {
    return count === 1? "" : "s";
  }

  static getTimeAgoString(secs) {
    if (secs < 0) {
      return "Unknown";
    }
    else if (secs >= 0 && secs < 60) {
      return "Online";
    }

    var min = Math.floor(secs / 60);
    if (min < 60) {
      return min + " min" + Util.getPluralSuffix(min);
    }
    var hr = Math.floor(min / 60);
    if (hr < 24) {
      return hr + " hour" + Util.getPluralSuffix(hr);
    }
    var days = Math.floor(hr / 24);
    if (days < 7) {
      return days + " day" + Util.getPluralSuffix(days);
    }
    var weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return weeks + " week" + Util.getPluralSuffix(weeks);
    }
    return "+1 Month"
  }

  static isSuccessResponse(data) {
    return data["status"] === "success";
  }

  static getCountryFlagUrl(code, size = 32) {
    return `https://www.countryflags.io/${code}/flat/${size}.png`;
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

  static getBestLapCarColorClass(carId) {
    var idx = BestlapPage.searched_car_class_list.indexOf(BestlapPage.CARS_LIST[carId]["car_class"]);
    if (idx > -1) return "car-class-" + idx;
    return "";
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

  static isCurrentTeamEvent() {
    return $("#event-detail").attr("data-team-event") === "1";
  }

  static isCurrentTeamEventUseNumber() {
    return $("#event-detail").attr("data-use-number") === "1";
  }

  static isCurrentTeamEventUseLiveryPreview() {
    return $("#event-detail").attr("data-livery-preview") === "1";
  }

  static isLiveTrackMapAvailable() {
    return $("#track-map svg").length == 1;
  }
}

class TrackMap {
  static DRIVER_CIRCLE_RADIUS = 5;
  static DEFAULT_DRIVER_CIRCLE_COLOR = "#22b4e1";

  static getEntityUniqueId(teamId, driverId, carId, teamEvent) {
    if (teamEvent) {
      return "team_" + teamId;
    } else {
      return "user_" + driverId + "_car_" + carId;
    }
  }

  static getEntityDisplayName(pos, teamId, driverId, teamEvent, useTeamNumber) {
    var name = "N/A";
    if (teamEvent && LeaderBoard.teamList[teamId] !== undefined) {
      if (useTeamNumber) {
        name = "#" + LeaderBoard.teamList[teamId]["team_no"];
      } else {
        name = LeaderBoard.teamList[teamId]["name"].substr(0, 3).toUpperCase();
      }
    } else if (!teamEvent && LeaderBoard.driverList[driverId] !== undefined){
      name = LeaderBoard.driverList[driverId].substr(0, 3).toUpperCase();
    }

    return (pos + 1) + ": " + name;
  }

  static addDriver(uniqueId, displayColorClass) {
    if ($("#track-map svg #" + uniqueId).length !== 0) return;
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.id= uniqueId;
    $("#track-map svg").append(circle);
    var scale = Number.parseFloat($("#track-map svg").attr("data-scale"));
    $("#track-map #" + uniqueId).attr("r", TrackMap.DRIVER_CIRCLE_RADIUS * scale).attr("fill", TrackMap.DEFAULT_DRIVER_CIRCLE_COLOR);

    $("#track-map").append(`<span class="map-driver-names" id="name_${uniqueId}">N/A</span>`);
  }

  static syncDriverMapStatus(pos, status, teamId, driverId, carId, teamEvent, useTeamNumber, posX, posZ) {
    if(!Util.isLiveTrackMapAvailable()) {
      return;
    }
    var uniqueId = TrackMap.getEntityUniqueId(teamId, driverId, carId, teamEvent);
    var displayName = TrackMap.getEntityDisplayName(pos, teamId, driverId, teamEvent, useTeamNumber);
    var displayColorClass = Util.getCarColorClass(carId);

    if (status !== LeaderBoardEntry.STATUS.DISCONNECTED) {
      TrackMap.addDriver(uniqueId);
      TrackMap.updateDriverPosition(uniqueId, displayName, displayColorClass, posX, posZ);
    } else {
      TrackMap.removeDriver(uniqueId);
    }
  }

  static updateDriverPosition(uniqueId, displayName, displayColorClass, posX, posZ) {
    // Update driver circle position
    var offsetX = Number.parseFloat($("#track-map-svg svg").attr("data-x-offset"));
    var offsetY = Number.parseFloat($("#track-map-svg svg").attr("data-y-offset"));
    if (posX === 0 && posZ === 0) { offsetX = 20; offsetY = 20; }
    $("#track-map #" + uniqueId).attr("cx", posX + offsetX).attr("cy", posZ + offsetY).addClass("svg-" + displayColorClass);

    // Update driver name tooltip position
    var viewBox = $("#track-map svg").attr("viewBox");
    var actualWidth = Number.parseInt(viewBox.split(" ")[2]);
    var actualHeight = Number.parseInt(viewBox.split(" ")[3]);
    var htmlX = 10 + $("#track-map svg").width() * (posX + offsetX) / actualWidth;
    var htmlY =-13 + $("#track-map svg").height() * (posZ + offsetY) / actualHeight;
    $("#track-map #name_" + uniqueId).css({ "top": htmlY + "px", "left": htmlX + "px" });
    $("#track-map #name_" + uniqueId).text(displayName).addClass(displayColorClass);
  }

  static removeDriver(uniqueId) {
    $("#track-map #" + uniqueId).remove();
    $("#track-map #name_" + uniqueId).remove();
  }
}

class ResultSectorTabEntry {
  constructor(teamId, driverId, carId, bestSectorTime, gap, interval) {
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.bestSectorTime = bestSectorTime;
    this.gap = gap;
    this.interval = interval;
  }

  static fromJSON(data) {
    return new ResultSectorTabEntry(data["team_id"], data["user_id"], data["car_id"], data["best_sector_time"], data["gap"], data["interval"]);
  }

  toHTML(pos, teamEvent, useTeamNumber) {
    return `<tr>
      <td class="sec-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent === true? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}"}>
        ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"] : ""}</td>` : ""}
      ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"] : ""}</td>` : ""}
      <td class="lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
        </span>
      </td>
      ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
        ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
      <td class="sec-sec">${Lap.convertMSToDisplayTimeString(this.bestSectorTime)}</td>
      <td class="sec-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="sec-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
    </tr>`;
  }
}

class QualiResultStandingTabEntry {
  constructor(teamId, driverId, carId, bestLapTime, validLaps, gap, interval, finishAt) {
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.bestLapTime = bestLapTime;
    this.validLaps = validLaps;
    this.gap = gap;
    this.interval = interval;
    if (finishAt === 0) {
      this.finishAt = "N/A";
    } else {
      this.finishAt = (new Date(finishAt / 1000)).toLocaleString();
    }
  }

  static fromJSON(data) {
    return new QualiResultStandingTabEntry(data["team_id"], data["user_id"], data["car_id"], data["best_lap_time"],
      data["valid_laps"], data["gap"], data["interval"], data["lap_finish_time"]);
  }

  toHTML(pos, teamEvent, useTeamNumber) {
    return `<tr>
      <td class="st-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">
        ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
      ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
        </span>
      </td>
      ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
        ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
      <td class="lb-best-lap">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</td>
      <td class="st-valid-laps">${this.validLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="st-finish-at">${this.finishAt}</td>
    </tr>`;
  }

  static getHeaderHtml(teamEvent, useTeamNumber) {
    return `<tr>
      <td class="st-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      ${useTeamNumber? `<td class="lb-hr-team-no">No.</td>` : ""}
      ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
      <td class="lb-hr-car">Car</td>
      ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
      <td class="lb-hr-best-lap">Best</td>
      <td class="st-hr-valid-laps">V. Laps</td>
      <td class="lb-hr-gap">Gap</td>
      <td class="lb-hr-interval">Int.</td>
      <td class="st-hr-finish-at">Finish At</td>
    </tr>`;
  }
}

class RaceResultStandingTabEntry {
  constructor(teamId, driverId, carId, laps, validLaps, gap, interval, totalTime) {
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.laps = laps;
    this.validLaps = validLaps;
    this.gap = Util.getGapFromBitmap(gap);
    this.interval = Util.getGapFromBitmap(interval);
    this.totalTime = totalTime;
  }

  static fromJSON(data) {
    return new RaceResultStandingTabEntry(data["team_id"], data["user_id"], data["car_id"], data["laps"],
      data["valid_laps"], data["gap"], data["interval"], data["total_time"]);
  }

  toHTML(pos, teamEvent, useTeamNumber) {
    return `<tr>
      <td class="st-pos">${pos}</td>
      <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">
        ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
      ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
        ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
      <td class="lb-car" data-car-id="${this.carId}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
        </span>
      </td>
      ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
        ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
      <td class="lb-laps">${this.laps}</td>
      <td class="st-valid-laps">${this.validLaps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="st-total">${Lap.convertMSToDisplayTimeString(this.totalTime)}</td>
    </tr>`;
  }

  static getHeaderHtml(teamEvent, useTeamNumber) {
    return `<tr>
      <td class="st-hr-pos">Pos</td>
      <td class="lb-hr-car-class">Class</td>
      ${useTeamNumber? `<td class="lb-hr-team-no">No.</td>` : ""}
      ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
      <td class="lb-hr-car">Car</td>
      ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
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
      this.finishAt = (new Date(finishAt / 1000)).toLocaleString();
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
  constructor(driverId, totalLaps, validLaps, bestLapTime, avgLapTime, avgLapGap, lapList) {
    this.driverId = driverId;
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

    return new ResultSingleStintEntry(data["user_id"], data["total_laps"], data["valid_laps"], data["best_lap_time"],
      data["avg_lap_time"], data["avg_lap_gap"], lapList);
  }

  toHTML(pos, teamEvent) {
    var stintHtml = `<div class="driver-stint">
      <div class="stint-summary">
        <ul>
          <li><span class="st-tag">Stint</span><span class="st-value">${pos}</span></li>
          ${teamEvent? `<li><span class="st-tag">Driver</span><span class="st-value lb-driver" data-driver-id="${this.driverId}">
            ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}
          </span></li>`:""}
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
  constructor(teamId, driverId, carId, stintList) {
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.stintList = stintList;
  }

  static fromJSON(data) {
    var stints = [];
    for (var idx = 0; idx < data["stints"].length; ++idx) {
      stints.push(ResultSingleStintEntry.fromJSON(data["stints"][idx]));
    }

    return new ResultStintTabEntry(data["team_id"], data["user_id"], data["car_id"], stints);
  }

  toHTML(teamEvent, useTeamNumber) {
    var allStints = `<div class="driver-stints" ${useTeamNumber? `data-team-id="${this.teamId}"` : `data-driver-id="${this.driverId}"`}>
      <div class="stint-driver">
        ${useTeamNumber? `<div class="left lb-team-no" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"] : ""}
        </div><div class="left">|</div>` : ""}
        ${teamEvent? `<div class="left stint-team-name lb-team ellipsis" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"] : ""}</div>` :
        `<div class="left stint-driver-name lb-driver ellipsis" data-driver-id="${this.driverId}">
          ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}
        </div>`}
        <div class="left">|</div>
        <div class="left stint-driver-class lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
        </div>
        <div class="left">|</div>
        <div class="left stint-driver-car lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}"}>
          <span class="car-name car-badge ellipsis" style="background: url('/images/ac/car/${this.carId}/badge')">
            ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
          </span>
        </div>
        <div class="right"><span class="arrow-up"></span></div>
        <div class="clear-both"></div>
      </div>`;
    var stintsHtml = "";
    for (var idx = 0; idx < this.stintList.length; ++idx) {
      stintsHtml += this.stintList[idx].toHTML(idx + 1, teamEvent);
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
      $("#event-detail").attr("data-event-id", event["event_id"]).attr("data-team-event", event["team_event"]).
      attr("data-use-number", event["use_number"]).attr("data-track", event["track_config_id"]);
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
      $("#session-summary .start .value").text((new Date(parseInt(session["start_time"]) / 1000)).toLocaleString());
      var finishTime = session["finish_time"];
      if (session["is_finished"] === 0) {
        finishTime = 0;
      }
      var finishTimeStr = "-";
      if (finishTime !== 0) {
        finishTimeStr = (new Date(finishTime / 1000)).toLocaleString();
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

      var pendingTeams = false;
      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      var sessionType = $("select[name='select-session'] option:selected").text().toLowerCase().split(' ')[0];
      if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() || sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
        $("#standings-header").html(QualiResultStandingTabEntry.getHeaderHtml(teamEvent, useTeamNumber));
      } else {
        $("#standings-header").html(RaceResultStandingTabEntry.getHeaderHtml(teamEvent, useTeamNumber));
      }

      var standingsHtml = "";
      for (var idx = 0; idx < standings.length; ++idx) {
        if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() || sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
          standingsHtml += QualiResultStandingTabEntry.fromJSON(standings[idx]).toHTML(idx + 1, teamEvent, useTeamNumber);
        } else {
          standingsHtml += RaceResultStandingTabEntry.fromJSON(standings[idx]).toHTML(idx + 1, teamEvent, useTeamNumber);
        }

        if (teamEvent && LeaderBoard.teamList[standings[idx]["team_id"]] === undefined) {
          pendingTeams = true;
        }
        if (LeaderBoard.carList[standings[idx]["car_id"]] === undefined) {
          pendingCarList.add(standings[idx]["car_id"]);
        }
        if (standings[idx]["user_id"] !== undefined && LeaderBoard.driverList[standings[idx]["user_id"]] === undefined) {
          pendingDriverList.add(standings[idx]["user_id"]);
        }
      }

      $("#standings-body").html(standingsHtml);

      if (pendingTeams) {
        getRequest("/api/ac/event/" + Util.getCurrentEvent() + "/teams", Page.cb_updateTeamsName);
      }
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

      var pendingTeams = false;
      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      for (var sectorIdx = 1; sectorIdx <= 3; ++sectorIdx) {
        $("#sec-header-" + sectorIdx).html(ResultPage.getSectorsResultHeaderHtml(teamEvent, useTeamNumber, sectorIdx));
        var sectorList = sectors["sector" + sectorIdx];
        var sectorHtml = "";
        for (var idx = 0; idx < sectorList.length; ++idx) {
          var entry = ResultSectorTabEntry.fromJSON(sectorList[idx]);
          sectorHtml += entry.toHTML(idx + 1, teamEvent, useTeamNumber);

          if (teamEvent && LeaderBoard.teamList[entry.teamId] === undefined) {
            pendingTeams = true;
          }
          if (LeaderBoard.carList[entry.carId] === undefined) {
            pendingCarList.add(entry.carId);
          }
          if (entry.driverId !== undefined && LeaderBoard.driverList[entry.driverId] === undefined) {
            pendingDriverList.add(entry.driverId);
          }
        }

        $("#sec-body-" + sectorIdx).html(sectorHtml);
      }

      if (pendingTeams) {
        getRequest("/api/ac/event/" + Util.getCurrentEvent() + "/teams", Page.cb_updateTeamsName);
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

      var pendingTeams = false;
      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      var stintsHtml = "";
      for (var idx = 0; idx < stints.length; ++idx) {
        var stint = ResultStintTabEntry.fromJSON(stints[idx]);
        stintsHtml += stint.toHTML(teamEvent, useTeamNumber);

        if (teamEvent && LeaderBoard.teamList[stint.teamId] === undefined) {
          pendingTeams = true;
        }
        if (LeaderBoard.carList[stint.carId] === undefined) {
          pendingCarList.add(stint.carId);
        }
        if (!teamEvent && LeaderBoard.driverList[stint.driverId] === undefined) {
          pendingDriverList.add(stint.driverId);
        } else if(teamEvent) {
          stint.stintList.forEach(function(singleStint){
            if (LeaderBoard.driverList[singleStint.driverId] === undefined){
              pendingDriverList.add(singleStint.driverId);
            }});
        }
      }

      $("#stints-tab").html(stintsHtml);

      if (pendingTeams) {
        getRequest("/api/ac/event/" + Util.getCurrentEvent() + "/teams", Page.cb_updateTeamsName);
      }
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

  static getSectorsResultHeaderHtml(teamEvent, useTeamNumber, sector_idx) {
    return `<tr>
        <td class="sec-hr-pos">Pos</td>
        <td class="sec-hr-car-class">Class</td>
        ${useTeamNumber? `<td class="lb-hr-team-no">No.</td>` : ""}
        ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
        <td class="sec-hr-car">Car</td>
        ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
        <td class="sec-hr-sec">BS ${sector_idx}</td>
        <td class="sec-hr-gap">Gap</td>
        <td class="sec-hr-interval">Int.</td>
      </tr>`;
  }
}

class BestlapPage extends Page {
  static EVENTS_LIST = []
  static TRACKS_LIST = []
  static CARS_LIST = {}
  static search_query = { per_page: 10, page_no: 1, car_ids: []}
  static cache_search_query = {};
  static searched_car_class_list = [];

  static cb_updateAllEvents(data) {
    if (data["status"] === "success") {
      var events = data["events"];
      BestlapPage.EVENTS_LIST = events;
      var eventHtml = `<option value="0">Select Event</option>`;
      for (var idx = 0; idx < events.length; ++idx) {
        eventHtml += `<option value="${events[idx]["event_id"]}">${events[idx]["name"]}</option>`
      }
      $("#event-param select").html(eventHtml).change(function() {
        var eventId = $(this).val();
        BestlapPage.search_query.by_event = true;
        BestlapPage.search_query.by_track = false;
        BestlapPage.search_query.event_id = eventId;
        BestlapPage.search_query.car_ids = [];

        $("#track-param select").val("0");
        $("#search-lap").attr("disabled", "disabled");
        getRequest("/api/ac/event/" + eventId + "/cars", BestlapPage.cb_updateEventCars);
      });
    }
  }

  static cb_updateEventCars(data) {
    if (data["status"] === "success") {
      var cars = data["cars"];
      var carsHtml = "";
      for (var idx = 0; idx < cars.length; ++idx) {
        BestlapPage.search_query.car_ids.push(cars[idx]["car_id"]);
        carsHtml += `<span class="selected-car" data-car-id="${cars[idx]["car_id"]}">${cars[idx]["display_name"]}</span>`;
      }
      $("#selected-cars").html(carsHtml);
    }
    $("#search-lap").removeAttr("disabled");
  }

  static cb_updateAllTracks(data) {
    if (data["status"] === "success") {
      var tracks = data["tracks"];
      BestlapPage.TRACKS_LIST = tracks;
      var trackHtml = `<option value="0">Select Track</option>`;
      for (var idx = 0; idx < tracks.length; ++idx) {
        trackHtml += `<option value="${tracks[idx]["track_config_id"]}">${tracks[idx]["display_name"]}</option>`
      }
      $("#track-param select").html(trackHtml).change(function() {
        var trackId = $(this).val();
        BestlapPage.search_query.by_event = false;
        BestlapPage.search_query.by_track = true;
        BestlapPage.search_query.track_id = trackId;
        $("#event-param select").val("0");
      });
    }
  }

  static cb_updateAllCars(data) {
    if (data["status"] === "success") {
      var cars = data["cars"];
      var carsHtml = `<option value="0">Select Cars</option>`;
      for (var idx = 0; idx < cars.length; ++idx) {
        BestlapPage.CARS_LIST[cars[idx]["car_id"]] = cars[idx];
        carsHtml += `<option value="${cars[idx]["car_id"]}">${cars[idx]["display_name"]}</option>`
      }
      $("#cars-param select").html(carsHtml).change(function() {
        var carId = $(this).val();
        if (BestlapPage.search_query.car_ids.indexOf(carId) === -1) {
          BestlapPage.search_query.car_ids.push(carId);
          var carName = $("#cars-param select option:selected").text();
          $("#selected-cars").append(`<span class="selected-car" data-car-id="${carId}">${carName}</span>`);
        }
        $("#cars-param select").val("0");
      });
    }
  }

  static searchBestLaps(pageId) {
    if(BestlapPage.cache_search_query.car_ids.length === 0) {
      $("#message").text("Select a Car to view laps").show();
      return;
    }
    $("#message").hide();
    $("#bestlaps tbody").html("");
    var url = "/api/ac/bestlap/";
    if (BestlapPage.cache_search_query.by_event) {
      url += "event/" + BestlapPage.cache_search_query.event_id;
    } else if (BestlapPage.cache_search_query.by_track) {
      url += "track/" + BestlapPage.cache_search_query.track_id;
    }
    url += "/cars/" + BestlapPage.cache_search_query.car_ids.join(",");
    url += "/page/" + pageId;
    for (var idx = 0; idx < BestlapPage.cache_search_query.car_ids.length; ++idx) {
      var carClass = BestlapPage.CARS_LIST[BestlapPage.cache_search_query.car_ids[idx]]["car_class"];
      if (BestlapPage.searched_car_class_list.indexOf(carClass) == -1) {
        BestlapPage.searched_car_class_list.push(carClass);
      }
    }
    getRequest(url, BestlapPage.cb_updateBestLapResult);
  }

  static updatePaginationButton(buttons) {
    var disabled = "disabled";

    if (buttons["first"]) {
      $("#page-first button").removeAttr(disabled);
    } else {
      $("#page-first button").attr(disabled, disabled);
    }
    if (buttons["prev"]) {
      $("#page-prev button").removeAttr(disabled).attr("data-page", buttons["page"] - 1);
    } else {
      $("#page-prev button").attr(disabled, disabled);
    }

    $("#page-current").text(buttons["page"]);

    if (buttons["next"]) {
      $("#page-next button").removeAttr(disabled).attr("data-page", buttons["page"] + 1);
    } else {
      $("#page-next button").attr(disabled, disabled);
    }
    if(buttons["last"]) {
      $("#page-last button").removeAttr(disabled);
    } else {
      $("#page-last button").attr(disabled, disabled);
    }
  }

  static cb_updateBestLapResult(data) {
    if (data["status"] === "success") {
      var response = data["bestlaps"];
      var bestlaps = response["laps"];
      if(bestlaps.length === 0) {
        $("#message").text("No laps found for this combination").show();
        return;
      }
      var offset = (response["page"] - 1) * response["per_page"];
      var lapsHtml = "";
      var driverList = [];
      BestlapPage.updatePaginationButton(response);

      for (var idx = 0; idx < bestlaps.length; ++idx) {
        var lapEntry = BestLapEntry.fromJSON(bestlaps[idx]);
        driverList.push(lapEntry.driverId);
        lapsHtml += lapEntry.toHTML(offset + idx);
      }
      $("#bestlaps tbody").html(lapsHtml);
      for (var idx = 0; idx < driverList.length; ++idx) {
        getRequest("/api/ac/user/" + driverList[idx], Page.cb_updateDriverName);
      }
    }
  }
}

class BestLapEntry {
  constructor(lapId, driverId, carId, bestLap, gap, gapPer, grip, avgSpeed, maxSpeed, finishedAt) {
    this.lapId = lapId;
    this.driverId = driverId;
    this.carId = carId;
    this.bestLap = bestLap;
    this.gap = gap;
    this.gapPer = gapPer;
    this.grip = grip;
    this.avgSpeed = avgSpeed;
    this.maxSpeed = maxSpeed;
    this.finishedAt = (new Date(finishedAt / 1000)).toLocaleString();
  }

  static fromJSON(data) {
    var lap = new Lap(data["time"], data["sector_1"], data["sector_2"], data["sector_3"]);
    return new BestLapEntry(data["lap_id"], data["user_id"], data["car_id"], lap, data["gap"],
      data["gap_per"], data["grip"], data["avg_speed"], data["max_speed"], data["finished_at"]);
  }

  toHTML(pos) {
    return `<tr>
      <td class="lb-pos">${pos + 1}</td>
      <td class="lb-car-class ${Util.getBestLapCarColorClass(this.carId)}">${BestlapPage.CARS_LIST[this.carId]["car_class"]}</td>
      <td class="lb-car">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
        ${BestlapPage.CARS_LIST[this.carId]["display_name"]}
      </td>
      <td class="lb-driver" data-driver-id="${this.driverId}"></td>
      <td class="lb-best-lap">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-gap">${Lap.convertToGapPercentDisplayString(this.gapPer)}</td>
      <td class="lb-sec1">${Lap.convertMSToDisplayTimeString(this.bestLap.sec1)}</td>
      <td class="lb-sec2">${Lap.convertMSToDisplayTimeString(this.bestLap.sec2)}</td>
      <td class="lb-sec3">${Lap.convertMSToDisplayTimeString(this.bestLap.sec3)}</td>
      <td class="lb-grip">${(this.grip * 100).toFixed(2)}</td>
      <td class="lb-max">${this.maxSpeed}</td>
      <td class="lb-finish-time">${this.finishedAt}</td>
    </tr>`;
  }
}

class DriverPage extends Page {
  static CHART_WIDTH = 720;
  static CHART_HEIGHT = 400;

  static cb_updateDriversList(data) {
    if (Util.isSuccessResponse(data)) {
      var drivers = data["users"];
      var selectHtml = `<option value="0">SELECT DRIVER</option>`;
      drivers.forEach(function(driver) {
        selectHtml += `<option data-country="${driver.country || ""}" value="${driver.user_id}">${driver.name}</option>`;
      });
      $("#driver-param select").html(selectHtml).change(function() {
        var driverId = $(this).val();
        var selected = $("#driver-param select option:selected");

        $(".ds-driver-name").text(selected.text());

        var country = selected.attr("data-country");
        if (country !== undefined && country !== "") {
          $(".ds-driver-country").html(`<img alt="Flag" src="${Util.getCountryFlagUrl(country)}">`);
        } else {
          $(".ds-driver-country img").remove();
        }

        getRequest(`/api/ac/user/${driverId}/summary`, DriverPage.cb_updateDriverSummary);
      });
    }
  }

  static cb_updateDriverSummary(data) {
    if (Util.isSuccessResponse(data)) {
      var driver = data["driver"];
      $("#basic-info .ds-car-events .ds-value").text(driver["total_events"]);
      $("#basic-info .ds-total-distance .ds-value").text(driver["total_distance_driven_km"] + " KM");
      $("#basic-info .ds-laps .ds-value").text(driver["total_laps"]);
      $("#basic-info .ds-valid-laps .ds-value").text(driver["total_valid_laps"]);

      var eventHtml = '';
      driver["events"].forEach(function(event){
        eventHtml += `<tr>
        <td class="ds-event">${event["event_name"]}</td>
        <td class="ds-track">${event["track_name"]}</td>
        <td class="ds-team">${event["team_name"] === undefined? "-" : event["team_name"]}</td>
        <td class="ds-distance">${event["distance_driven_km"]} KM</td>
        <td class="ds-laps">${event["total_laps"]}</td>
        <td class="ds-valid-laps">${event["total_valid_laps"]}</td>
        <td class="ds-last-seen">${Util.getTimeAgoString(event["time_ago_sec"])} ago</td>
        </tr>`;
      });

      $("#driver-events tbody").html(eventHtml);
      DriverPage.createDriverTopCombosChart("tracks", "ds-top-tracks-chart", "Top driven tracks", driver["top_tracks"], "track_name", "distance_driven");
      DriverPage.createDriverTopCombosChart("cars", "ds-top-cars-chart", "Top driven cars", driver["top_cars"], "car_name", "distance_driven");
    }
  }

  static createDriverTopCombosChart(container, canvas_id, chart_label, data, label_key, value_key) {
    $("#" + canvas_id).remove();
    $(`#top-${container} .canvas-container`).append(`<canvas id="${canvas_id}" width="${DriverPage.CHART_WIDTH}" height="${DriverPage.CHART_HEIGHT}"></canvas>`);
    var canvas = document.getElementById(canvas_id);
    var ctx = canvas.getContext('2d');

    var scaleLabelColor = '#a8a8a8';
    var mainGridLineColor = '#a8a8a87a';

    var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(function(e){ return e[label_key]; }),
          datasets: [{
            label: chart_label,
            data: data.map(function(e) { return e[value_key]; }),
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(75, 192, 192, 0.2)',
              'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            yAxes: [{
              position: (container === "cars"? "right" : "left"),
              gridLines: {
                drawOnChartArea: false,
                color: mainGridLineColor
              },
              scaleLabel: {
                display: true,
                labelString: 'Distance in KM',
                fontColor: scaleLabelColor
              },
              ticks: {
                beginAtZero: true,
                fontColor: scaleLabelColor,
                fontSize: 14
              }
            }],
            xAxes: [{
              gridLines: {
                drawOnChartArea: false,
                color: mainGridLineColor
              },
              ticks: {
                fontColor: scaleLabelColor,
                fontSize: 14
              }
            }],
          },
          legend: {
            display: false
          }
        }
    });
  }
}

function showMapSectionTooltip(e, sectionName) {
$("#map-section-tooltip").text(sectionName).css({
  left: e.pageX + 10 + "px",
  top: e.pageY + 10 + "px"}).show();
}

function hideMapSectionTooltip() {
  $("#map-section-tooltip").hide();
}

$(document).ready(function() {
  var page = $("body").attr("data-page");
  if (page == "lb-page") {
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), LeaderboardPage.cb_updateEventInfo);

    $("#board-body").click(function(e) {
      if ($(e.target).hasClass("activate-overlay")) {
        LeaderboardPage.c_updateTeamDetailInOverlay($(e.target).attr("data-team-id"));
        $("#cover-preview").fadeIn();
      }
    });

    $("#cover-preview").click(function(e) {
      if ($(e.target).hasClass("cover-preview")) {
        $("#cover-preview").fadeOut(300, function() { $("#livery-preview img").remove(); });
      }
    });
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
  } else if (page == "bestlap-page") {
    Page.setCommonHeaderHtml("bestlap");
    getRequest("/api/ac/events", BestlapPage.cb_updateAllEvents);
    getRequest("/api/ac/tracks", BestlapPage.cb_updateAllTracks);
    getRequest("/api/ac/cars", BestlapPage.cb_updateAllCars);
    $("#search-lap").click(function() {
      BestlapPage.cache_search_query = JSON.parse(JSON.stringify(BestlapPage.search_query));
      BestlapPage.searchBestLaps(1);
    });

    $("#page-buttons button").click(function() {
      BestlapPage.searchBestLaps($(this).attr("data-page"));
    });

    $("#selected-cars").click(function(e) {
      var carId = $(e.target).attr("data-car-id");
      if (carId !== undefined) {
        carId = Number.parseInt(carId);
        $(e.target).remove();
        var idx = BestlapPage.search_query.car_ids.indexOf(carId);
        if (idx > -1) {
          BestlapPage.search_query.car_ids.splice(idx, 1);
        }
      }
    });
    $("#message").hide();
  } else if (page == "driver-page") {
    Page.setCommonHeaderHtml("driver");
    getRequest("/api/ac/users", DriverPage.cb_updateDriversList);
  }

  $("#tab-map").hide();
  $("#map-section-tooltip").hide();
  $("#lb-tabs").click(function(e) {
    var target = $(e.target).attr("data-tab");
    if (target === "standings") {
      $("#tab-map").hide();
      $("#tab-standings").fadeIn();
      $("span[data-tab='standings']").addClass("active");
      $("span[data-tab='map']").removeClass("active");
    } else if (target === "map") {
      $("#tab-standings").hide();
      $("#tab-map").addClass("active").fadeIn();
      $("span[data-tab='map']").addClass("active");
      $("span[data-tab='standings']").removeClass("active");
    }
  });
});
