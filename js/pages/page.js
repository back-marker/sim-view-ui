class Page {
  static SESSION_TYPE = { PRACTICE: "Practice", QUALIFYING: "Qualifying", RACE: "Race" }
  static VERSION = "v0.12";

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
          <li class="${page === "live"? "active" : ""}" id="link-live"><a class="red" href="/">Live</a></li>
          <li class="${page === "events"? "active" : ""}" id="link-events"><a href="/events">Events</a></li>
          <li class="${page === "result"? "active" : ""}" id="link-result"><a href="/result">Result</a></li>
          <li class="${page === "bestlap"? "active" : ""}" id="link-bestlap"><a href="/bestlap">Best Laps</a></li>
          <li class="${page === "driver"? "active" : ""}" id="link-driver"><a href="/driver">Driver</a></li>
          <li id="logo"></li>
          <li id="version"><a href="https://www.racedepartment.com/downloads/simview.35249/" targer="_blank" rel="noreferrer noopener">${Page.VERSION}</a></li>
          <div class="clear-both"></div>
        </ul>`;
    $("#common-header").html(header);
  }
}
