class LeaderboardPage extends Page {

  static SESSION_TYPE = { PRACTICE: "Practice", QUALIFYING: "Qualifying", RACE: "Race" }
  static sessionFeedLastId = -1;

  static showMessage(msg) {
    $("#message").text(msg).removeClass("hidden");
  }

  static showTrackMissingMessage(msg) {
    $("#track-missing").text(msg).removeClass("hidden");
  }

  static setupLeaderboardAPI(websocketPort) {
    const hostName = window.location.hostname;
    const protocol = "ws";
    const leaderBoardUrl = `${protocol}://${hostName}:${websocketPort}/live`;
    const socket = new WebSocket(leaderBoardUrl);
    socket.binaryType = "arraybuffer";

    socket.addEventListener('open', function(event) {
      console.log("Connected to leaderboard API");
    });

    const showLeaderBoardNotConnectedMsg = function() {
      LeaderboardPage.showMessage("Cannot connect to leaderboard server");
    }

    socket.addEventListener('close', showLeaderBoardNotConnectedMsg);
    socket.addEventListener('error', showLeaderBoardNotConnectedMsg);

    socket.addEventListener('message', function(event) {
      if (event.data instanceof ArrayBuffer) {
        LeaderboardPage.cb_updateLeaderBoard(event.data);
      }
    });
  }

  static cb_updateEventInfo(data) {
    if (data["status"] === "success") {
      const event = data.event;
      DataStore.setEvent(event);

      $("#event-detail .title").text(event.name);
      $("#event-detail .server").text(event.server_name);

      var practiceDuration = Util.getPracticeDurationStr(event);
      var qualiDuration = Util.getQualiDurationStr(event);
      var raceDuration = Util.getRaceDurationStr(event);
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

      getRequest(`/api/ac/event/${event.event_id}/session/latest`, LeaderboardPage.cb_updateSessionInfo);

      var trackApi = `ac/track/${event.track_config_id}`;
      getRequest(`/api/${trackApi}`, LeaderboardPage.cb_updateTrackInfo);
      $("#track-preview img").attr("src", `/images/${trackApi}/preview`);

      getRequest(`/images/${trackApi}/map`, function(data) {
        $("#track-map-svg").html(data.childNodes[0].outerHTML);
        $("#track-map-svg svg").css(Util.getOptimalWidthAndHeightForMap("#track-map-svg svg"));
      }, LeaderboardPage.cb_missingTrackMap);
    }
  }

  static cb_missingTrackMap() {
    var trackName = $("#track-preview .name").text();
    if (trackName === "") {
      trackName = "this track"
    }
    LeaderboardPage.showTrackMissingMessage(`Live Track Map is missing for ${trackName}!`);
  }

  static cb_updateTrackInfo(data) {
    if (data["status"] === "success") {
      const track = data.track;
      $("#track-condition .track-length .value").text((track.length / 1000).toFixed(2) + " KM");
      $("#track-preview .name").text(track.display_name);
      $("#track-preview .country").text(track.city + ", " + track.country);
    }
  }

  static getGripDisplay(grip) {
    return (grip * 100).toFixed(1) + "%";
  }

  static updateSessionGrip(startGrip, currentGrip) {
    if (startGrip != -1) {
      $("#track-condition .start-grip .value").text(LeaderboardPage.getGripDisplay(startGrip));
    }
    if (currentGrip != -1) {
      $("#track-condition .current-grip .value").text(LeaderboardPage.getGripDisplay(currentGrip));
    }
  }

  static handleSessionFinish(sessionName, raceSession) {
    var sessionOverText = sessionName + " session is over";
    if (!raceSession || DataStore.isReverseGridEnabled()) {
      sessionOverText += ". Reloading in 5 secs";
      setTimeout(function() { window.location.reload(true); }, 5 * 1000);
    }
    LeaderboardPage.showMessage(sessionOverText);
  }

  static setRemainingTimeTimer(elapsed_ms, duration_min) {
    LeaderboardPage.setRemainingTime(elapsed_ms, duration_min);
    setTimeout(function() {
      LeaderboardPage.setRemainingTime(elapsed_ms + 1000, duration_min);
    }, 1000);
  }

  static cb_updateLeaderBoard(buffer) {
    var leaderboardHtml = "";
    if (DataStore.isSessionFinished()) {
      return;
    }

    var pendingTeamList = new Set();
    var pendingCarList = new Set();
    var pendingDriverList = new Set();

    var sessionType = $("#event-detail").attr("data-session");
    const raceSession = sessionType === "race";
    const leaderboard = LeaderBoardFactory.create(buffer, raceSession);
    if (leaderboard.sessionID !== DataStore.getSessionID()) {
      // Do not render leaderboard
      DataStore.setSessionFinish();
      LeaderboardPage.handleSessionFinish(sessionType, raceSession);
      return;
    }

    var teamEvent = Util.isCurrentTeamEvent();
    var useTeamNumber = Util.isCurrentTeamEventUseNumber();
    var pos = 0;
    for (const entry of leaderboard.entries) {
      if (raceSession) {
        leaderboardHtml += entry.toRaceHTML(pos, teamEvent, useTeamNumber, leaderboard.bestLapIdx);
      } else {
        leaderboardHtml += entry.toQualiHTML(pos, teamEvent, useTeamNumber);
      }

      if (teamEvent && !DataStore.containsTeam(entry.id.teamID)) {
        pendingTeamList.add(entry.id.teamID);
      }
      if (!DataStore.containsCar(entry.id.carID)) {
        pendingCarList.add(entry.id.carID);
      }
      if (entry.id.userID !== 0 && !DataStore.containsUser(entry.id.userID)) {
        pendingDriverList.add(entry.id.userID);
      }

      pos += 1;
    }

    $("#board-body").html(leaderboardHtml);
    if ($("#remaining span").hasClass("remain-laps")) {
      if (leaderboard.entries[0] !== undefined) {
        if (leaderboard.entries[0].isFinished) {
          LeaderboardPage.setRemainingLaps(-1);
        } else {
          LeaderboardPage.setRemainingLaps(leaderboard.entries[0].laps + 1)
        }
      } else {
        LeaderboardPage.setRemainingLaps(1);
      }
    } else if (raceSession && leaderboard.entries[0] !== undefined) {
      if (leaderboard.entries[0].isFinished) {
        $("#event-detail").attr("data-finished", "true");
      } else if ($("#event-detail").attr("data-total-laps") !== undefined) {
        if (leaderboard.entries[0].laps > Number.parseInt($("#event-detail").attr("data-total-laps"))) {
          $("#event-detail").removeAttr("data-total-laps");
        }
      }
    }

    Page.updateTeamAndDriversAndCarsName(pendingTeamList, pendingCarList, pendingDriverList);

    SessionFeed.updateFeedTimestamp();
    $("#feeds").append(leaderboard.getFeedHTML());
    $("#feeds").scrollTop($("#feeds").prop("scrollHeight"));

    LeaderboardPage.updateSessionGrip(leaderboard.startGrip, leaderboard.currentGrip);
  }

  static cb_updateSessionInfo(data) {
    if (data["status"] == "success") {
      const session = data.session;
      if (session.is_finished) {
        LeaderboardPage.showMessage("No Live session running for this event");
        return;
      }
      $("main").removeClass("hidden");

      $("#event-detail .active").removeClass("active");
      if (session.type === Page.SESSION_TYPE.RACE) {
        $("#event-detail .race .live").addClass("active");
      } else if (session.type === Page.SESSION_TYPE.PRACTICE) {
        $("#event-detail .practice .live").addClass("active");
      } else if (session.type === Page.SESSION_TYPE.QUALIFYING) {
        $("#event-detail .quali .live").addClass("active");
      }

      $("#track-condition .weather .value").text(Util.getWeatherDisplayName(session.weather));
      $("#track-condition .air-temp .temp-val").text(session.air_temp);
      $("#track-condition .road-temp .temp-val").text(session.road_temp);
      if (session.start_grip != -1) {
        $("#track-condition .start-grip .value").text(LeaderboardPage.getGripDisplay(session.start_grip));
      }
      if (session["current_grip"] != -1) {
        $("#track-condition .current-grip .value").text(LeaderboardPage.getGripDisplay(session.current_grip));
      }
      $("#remaining").attr("data-session-start", session.start_time);
      if (session.duration_min != 0) {
        $("#remaining").attr("data-session-type", "time");
        $("#remaining span").addClass("remain-time");
        LeaderboardPage.setRemainingTimeTimer(session.elapsed_ms, session.duration_min);
      } else {
        $("#remaining span").addClass("remain-laps");
        $("#remaining").attr("data-laps", session.laps);
      }

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();
      $("head title").text("SimView | Live " + session.type + " Session");
      $("#event-detail").attr("data-session", session.type.toLocaleLowerCase());
      if (session.type == Page.SESSION_TYPE.RACE) {
        LeaderboardPage.setupRaceLeaderBoardHeader(teamEvent, useTeamNumber);
      } else if (session.type === Page.SESSION_TYPE.PRACTICE) {
        LeaderboardPage.setupPracticeLeaderBoardHeader(teamEvent, useTeamNumber);
      } else if (session.type === Page.SESSION_TYPE.QUALIFYING) {
        LeaderboardPage.setupQualiLeaderBoardHeader(teamEvent, useTeamNumber);
      }

      DataStore.setSessionID(session.session_id);
      LeaderboardPage.setupLeaderboardAPI(session.http_port);
    }
  }

  static cb_updateTeamMembersInOverlay(data) {
      if (data["status"] == "success") {
        const driverList = data.members;
        var driverListHtml = "";
        for (const driver of driverList) {
          driverListHtml += `<div class="driver">
              ${driver.country? `<span class="left driver-country">
                <img alt="N/A" src="${Util.getCountryFlagUrl(driver.country)}">
              </span>` : ""}
              <span class="left driver-name">${driver.name}</span>
              </div>`;
        }
      }
      $("#drivers-list").html(driverListHtml);
    }

    static c_updateTeamDetailInOverlay(teamId) {
      const team = DataStore.getTeam(teamId);
      $("#team-car-class").removeClass();
      $("#team-car-class").addClass(DataStore.getCarColorClass(team.car_id));

      const car = DataStore.getCar(team.car_id);
      $("#team-car-class").text(car.car_class);
      $("#team-car").text(car.display_name);
      if (Util.isCurrentTeamEventUseNumber()) {
        $("#team-no").text("#" + team.team_no);
      }
      $("#team-name").text(team.name);
      if (Util.isCurrentTeamEventUseLiveryPreview()) {
        const previewFileUrl = `/images/ac/car/${car.name}/livery/${team.livery_name}/preview`;
        $("#livery-preview").prepend(`<img alt="Livery Preview Not Available" src="${previewFileUrl}">`);
      }
      getRequest(`/api/ac/team/${teamId}/members`, LeaderboardPage.cb_updateTeamMembersInOverlay);
    }

    static setupRaceLeaderBoardHeader(teamEvent, useTeamNumber) {
        var leaderboardHeader = `<tr>
        <td class="lb-hr-status"><a class="tooltip" title="Connection status">C</a></td>
        <td class="lb-hr-pos"><a class="tooltip" title="Overall position">POS</a></td>
        <td class="lb-hr-car-class">Class</td>
        ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team number">No.</a></td>` : ""}
        ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
        <td class="lb-hr-car">Car</td>
        <td class="lb-hr-driver">${teamEvent? `<a class="tooltip" title="Current driver">Driver</a>` : `Driver`}</td>
        <td class="lb-hr-laps"><a class="tooltip" title="Total laps">Laps</a></td>
        <td class="lb-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
        <td class="lb-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        <td class="lb-hr-best-lap"><a class="tooltip" title="Best lap">Best</a></td>
        <td class="lb-hr-tyre"><a class="tooltip" title="Current tyre">T</a></td>
        <td class="lb-hr-last-lap"><a class="tooltip" title="Last lap">Last</a></td>
        <td class="lb-hr-sec1"><a class="tooltip" title="Sector 1 time of current lap">S1</a></td>
        <td class="lb-hr-sec2"><a class="tooltip" title="Sector 2 time of current lap">S2</a></td>
        <td class="lb-hr-sec3"><a class="tooltip" title="Sector 3 time of current lap">S3</a></td>
      </tr>`;
      $("#board-header").html(leaderboardHeader);
    }

    static setupQualiLeaderBoardHeader(teamEvent, useTeamNumber) {
      var leaderboardHeader = `<tr>
        <td class="lb-hr-status"><a class="tooltip" title="Connection status">C</a></td>
        <td class="lb-hr-pos"><a class="tooltip" title="Overall position">POS</a></td>
        <td class="lb-hr-car-class">Class</td>
        ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team number">No.</a></td>` : ""}
        ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
        <td class="lb-hr-car">Car</td>
        <td class="lb-hr-driver">${teamEvent? `<a class="tooltip" title="Current driver">Driver</a>` : `Driver`}</td>
        <td class="lb-hr-best-lap"><a class="tooltip" title="Best lap">Best</a></td>
        <td class="lb-hr-tyre"><a class="tooltip" title="Current tyre">T</a></td>
        <td class="lb-hr-last-lap"><a class="tooltip" title="Last lap">Last</a></td>
        <td class="lb-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
        <td class="lb-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        <td class="lb-hr-sec1"><a class="tooltip" title="Sector 1 time of best lap">S1</a></td>
        <td class="lb-hr-sec2"><a class="tooltip" title="Sector 2 time of best lap">S2</a></td>
        <td class="lb-hr-sec3"><a class="tooltip" title="Sector 3 time of best lap">S3</a></td>
        <td class="lb-hr-laps"><a class="tooltip" title="Total valid laps">Laps</a></td>
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
          remainLapsText = "Final Lap";
        } else {
          remainLapsText = current_lap + " / " + totalLap;
        }
      }
      $("#remaining span").text(remainLapsText);
    }

    static setRemainingTime(elapsed_ms, duration_min) {
      const raceSession = $("#event-detail").attr("data-session") === "race";
      var remainTime;
      var waitForGreen = (elapsed_ms < 0) && raceSession;
      if (waitForGreen) {
        remainTime = "-- " + Util.getTimeDiffString(Math.floor(-elapsed_ms / 1000)) + " --";
      } else {
        var leftTime = Math.floor((duration_min * 60000 - elapsed_ms) / 1000);
        if (leftTime < 0 && raceSession) {
          if ($("#event-detail").attr("data-finished") !== undefined) {
            remainTime = "Finished";
          } else if(DataStore.extraLapEnabled()) {
            remainTime = "+1 Lap";
            $("#event-detail").attr("data-total-laps", $("#board-body [data-pos='1'] .lb-laps").text())
          } else {
            remainTime = "Final Lap";
          }
        } else {
          remainTime = Util.getTimeDiffString(leftTime);
        }
      }
      $("#remaining span").text(remainTime);

      var nextTimeout = 60000;
      if (waitForGreen || leftTime < 60 * 60) {
        nextTimeout = 1000;
      }
      setTimeout(function() {
        LeaderboardPage.setRemainingTime(elapsed_ms + nextTimeout, duration_min);
      }, nextTimeout);
    }
  }
