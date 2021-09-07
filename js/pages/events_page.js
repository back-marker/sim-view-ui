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
        // TODO: Remove leaderboard page dependency
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
    return event["practice_duration"] === -1 ? "-" : Util.getMinuteTimeDiffString(event["practice_duration"]);
  }

  static getQualiDurationStr(event) {
    return event["quali_duration"] === -1 ? "-" : Util.getMinuteTimeDiffString(event["quali_duration"]);
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
        raceDuration += " | +" + event["race_extra_laps"];
      }
      if (event["reverse_grid_positions"] !== 0) {
        raceDuration += " | RG (" + (event["reverse_grid_positions"] === -1 ? "All" : event["reverse_grid_positions"]) + ")";
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
