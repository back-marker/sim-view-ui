class Page {
  static SESSION_TYPE = { PRACTICE: "Practice", QUALIFYING: "Qualifying", RACE: "Race" }
  static VERSION = "v1.1.2";

  static isLiveEventPage() {
    return window.location.pathname === "/";
  }

  static cb_updateTeamsName(data) {
    if (data["status"] === "success") {
      for (const team of data.teams) {
        DataStore.addTeam(team.team_id, team);
        $(`.lb-team-no[data-team-id="${team.team_id}"]`).text(team.team_no);
        $(`.lb-team[data-team-id="${team.team_id}"]`).text(team.name);
      }
    }
  }

  static cb_updateCarsName(data) {
    if (data["status"] === "success") {
      for (const car of data.cars) {
        DataStore.addCar(car.car_id, car);
        $(`.lb-car[data-car-id="${car.car_id}"] .car-name`).text(car.display_name);
        $(`.lb-car-class[data-car-id="${car.car_id}"]`).text(car.car_class).addClass(DataStore.getCarColorClass(car.car_id));
      }
    }
  }

  static cb_updateDriversName(data) {
    if (data["status"] === "success") {
      for (const user of data.users) {
        $(`.lb-driver[data-driver-id="${user.user_id}"]`).text(user.name);
        DataStore.addUser(user.user_id, user);
      }
    }
  }

  static updateTeamAndDriversAndCarsName(pendingTeamList, pendingCarList, pendingDriverList) {
    if (pendingTeamList.size !== 0) {
      getRequest("/api/ac/teams/" + Array.from(pendingTeamList).join(','), Page.cb_updateTeamsName);
    }
    if (pendingCarList.size !== 0) {
      getRequest("/api/ac/cars/" + Array.from(pendingCarList).join(','), Page.cb_updateCarsName)
    }
    if (pendingDriverList.size !== 0) {
      getRequest("/api/ac/users/" + Array.from(pendingDriverList).join(','), Page.cb_updateDriversName);
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
