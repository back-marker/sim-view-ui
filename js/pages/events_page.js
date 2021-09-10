class EventsPage extends Page {
  static showEventMissingMessage(msg) {
    $("#event-missing").text(msg).removeClass("hidden");
  }

  static cb_updateAllEvents(data) {
    if (data["status"] == "success") {
      if (data.events.length === 0) {
        if (Page.isLiveEventPage()) {
          EventsPage.showEventMissingMessage("No live events running");
        } else {
          EventsPage.showEventMissingMessage("No Events stored");
        }
        return;
      }

      var eventHtml = ""
      for (const event of data.events) {
        eventHtml += EventsPage.getEventHtml(event);
      }
      $("#event-container").html(eventHtml);

      for (const event of data.events) {
        getRequest(`/api/ac/event/${event.event_id}/session/latest`, EventsPage.cb_updateActiveEvent);
      }
    }
  }

  static cb_updateActiveEvent(data) {
    if (data["status"] == "success") {
      const session = data.session;
      if (session.is_finished === 0) {
        var sessionClass = "";
        if (session.type === Page.SESSION_TYPE.RACE) {
          sessionClass = "race";
        } else if (session.type === Page.SESSION_TYPE.PRACTICE) {
          sessionClass = "practice";
        } else if (session.type === Page.SESSION_TYPE.QUALIFYING) {
          sessionClass = "quali";
        }

        $(`a[data-event-id="${session.event_id}"] .event`).addClass("live-event");
        var event = $(`a[data-event-id="${session.event_id}"] .${sessionClass}`);
        event.find(".live").addClass("active");
      } else {
        var event = $(`a[data-event-id="${session.event_id}"]`);
        event.find(".live").remove();
        event.attr("href", `/ac/event/${session.event_id}/result`);
      }
    }
  }

  static getEventHtml(event) {
    var practiceDuration = Util.getPracticeDurationStr(event);
    var qualiDuration = Util.getQualiDurationStr(event);
    var raceDuration = Util.getRaceDurationStr(event);

    return `<div class="single-event">
        <a data-event-id="${event.event_id}" href="${"/ac/event/" + event.event_id + (Page.isLiveEventPage()? "/live" : "/result")}">
          <div class="event">
            <div class="header">
              <div class="title">${event.name}</div>
              <div class="server-container">
                <div class="server">${event.server_name}</div>
                ${(event.team_event ? "<div class=\"team\"></div>" : "")}
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
              <div class="preview"><img src="/images/ac/track/${event.track_config_id}/preview"></div>
              <div class="clear-both"></div>
            </div>
            <div class="footer"></div>
          </div>
        </a></div>`;
  }
}
