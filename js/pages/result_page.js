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
        } else if (teamEvent) {
          stint.stintList.forEach(function(singleStint) {
            if (LeaderBoard.driverList[singleStint.driverId] === undefined) {
              pendingDriverList.add(singleStint.driverId);
            }
          });
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
          <td class="sec-hr-pos"><a class="tooltip" title="Overall position">Pos</a></td>
          <td class="sec-hr-car-class">Class</td>
          ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team no">No.</a></td>` : ""}
          ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
          <td class="sec-hr-car">Car</td>
          ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
          <td class="sec-hr-sec"><a class="tooltip" title="Best sector ${sector_idx} time">BS ${sector_idx}</a></td>
          <td class="sec-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
          <td class="sec-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        </tr>`;
    }
  }