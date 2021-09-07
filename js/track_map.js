// Methods to be used by SVG
function showMapSectionTooltip(e, sectionName) {
  $("#map-section-tooltip").text(sectionName).css({
    left: e.pageX + 10 + "px",
    top: e.pageY + 10 + "px"
  }).show();
}

function hideMapSectionTooltip() {
  $("#map-section-tooltip").hide();
}

class TrackMap {
  static DRIVER_CIRCLE_RADIUS = 5;
  static DEFAULT_DRIVER_CIRCLE_COLOR = "#22b4e1";
  static DRIVER_NAME_CHARACTER_LIMIT = 3;
  static COLLISION_INDICATOR_TIMEOUT = 10 * 1000;
  static carClasses = [];

  static getEntityUniqueId(teamId, driverId, carId, teamEvent) {
    if (teamEvent) {
      return "team_" + teamId;
    } else {
      return "user_" + driverId + "_car_" + carId;
    }
  }

  static getEntityDisplayName(teamId, driverId, teamEvent, useTeamNumber) {
    var name = "N/A";
    if (teamEvent && LeaderBoard.teamList[teamId] !== undefined) {
      if (useTeamNumber) {
        name = "#" + LeaderBoard.teamList[teamId]["team_no"];
      } else {
        name = LeaderBoard.teamList[teamId]["name"].substr(0, TrackMap.DRIVER_NAME_CHARACTER_LIMIT);
      }
    } else if (!teamEvent && LeaderBoard.driverList[driverId] !== undefined) {
      name = LeaderBoard.driverList[driverId].substr(0, TrackMap.DRIVER_NAME_CHARACTER_LIMIT);
    }

    return name.toUpperCase();
  }

  static getEntityFullDisplayName(teamId, driverId, teamEvent, useTeamNumber) {
    var name = "N/A";
    if (teamEvent && LeaderBoard.teamList[teamId] !== undefined) {
      name = LeaderBoard.teamList[teamId]["name"];
    } else if (!teamEvent && LeaderBoard.driverList[driverId] !== undefined) {
      name = LeaderBoard.driverList[driverId];
    }

    return name;
  }

  static removeCollisionCar(id) {
    $("#name_" + id + " .driver-pos").removeClass("collision-indicator").removeAttr("data-clear-handle");
  }

  static setCollisionCar(collisionTime, teamId, driverId, carId, teamEvent) {
    collisionTime /= 1000;
    if (Date.now() - collisionTime >= TrackMap.COLLISION_INDICATOR_TIMEOUT) {
      return;
    }
    var id = this.getEntityUniqueId(teamId, driverId, carId, teamEvent);
    var elem = $("#name_" + id + " .driver-pos");

    if (elem.hasClass("pit-indicator")) return;

    elem.removeClass("offtrack-indicator");
    if (!elem.hasClass("collision-indicator")) {
      elem.addClass("collision-indicator");
    } else {
      clearTimeout(Number.parseInt(elem.attr("data-clear-handle")));
    }
    var handle = setTimeout(function() { TrackMap.removeCollisionCar(id) }, TrackMap.COLLISION_INDICATOR_TIMEOUT);
    elem.attr("data-clear-handle", handle);
  }

  static addDriver(uniqueId, carClassName) {
    if ($("#track-map svg #" + uniqueId).length !== 0) return;

    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.id = uniqueId;
    $("#track-map svg").append(circle);
    var scale = Number.parseFloat($("#track-map svg").attr("data-scale"));
    $("#track-map #" + uniqueId).attr("r", TrackMap.DRIVER_CIRCLE_RADIUS * scale).attr("fill", TrackMap.DEFAULT_DRIVER_CIRCLE_COLOR).attr("data-car-class", carClassName);

    var driverPosAndName = `<div class="map-driver-names" data-car-class="${carClassName}" id="name_${uniqueId}">
        <span class="driver-pos">-</span>
        <span class="display-name">N/A</span>
        <span class="full-display-name ${carClassName}">N/A</span>
        </div>`
    $("#track-map-svg").append(driverPosAndName);
  }

  static setPitStatus(id) {
    var elem = $("#name_" + id + " .driver-pos");
    if (!elem.hasClass("pit-indicator")) {
      elem.addClass("pit-indicator");
    }
  }

  static removePitStatus(id) {
    var elem = $("#name_" + id + " .driver-pos");
    elem.removeClass("pit-indicator");
  }

  static setOfftrackStatus(id) {
    var elem = $("#name_" + id + " .driver-pos");
    if (!elem.hasClass("collision-indicator") && !elem.hasClass("offtrack-indicator")) {
      elem.addClass("offtrack-indicator");
    }
  }

  static removeOfftrackStatus(id) {
    var elem = $("#name_" + id + " .driver-pos");
    elem.removeClass("offtrack-indicator");
  }

  static syncDriverMapStatus(pos, connectionStatus, id, teamEvent, useTeamNumber, telemetry, trackStatus) {
    if (!Util.isLiveTrackMapAvailable()) {
      return;
    }
    var uniqueId = id.getUniqueID();
    var displayName = TrackMap.getEntityDisplayName(id.teamID, id.userID, teamEvent, useTeamNumber);
    var fullDisplayName = TrackMap.getEntityFullDisplayName(id.teamID, id.userID, teamEvent, useTeamNumber);
    var displayColorClass = Util.getCarColorClass(id.carID);
    var carClassName = LeaderBoard.carList[id.carID] === undefined ? "" : LeaderBoard.carList[id.carID]["class"];
    carClassName = carClassName.toLowerCase();

    if (connectionStatus !== LeaderBoardEntry.CONNECTION_STATUS.DISCONNECTED) {
      TrackMap.addDriver(uniqueId, carClassName);
      TrackMap.updateDriverPosition(uniqueId, pos + 1, displayName, fullDisplayName, displayColorClass, carClassName, telemetry.posX, telemetry.posZ);
      if (trackStatus == LeaderBoardEntry.TRACK_STATUS.PIT_LANE) {
        TrackMap.removeOfftrackStatus(uniqueId);
        TrackMap.removeCollisionCar(uniqueId);
        TrackMap.setPitStatus(uniqueId);
      } else {
        TrackMap.removePitStatus(uniqueId);
      }
      if (trackStatus == LeaderBoardEntry.TRACK_STATUS.OFF_TRACK) {
        TrackMap.removePitStatus(uniqueId);
        TrackMap.setOfftrackStatus(uniqueId);
      } else {
        TrackMap.removeOfftrackStatus(uniqueId);
      }
    } else {
      TrackMap.removeDriver(uniqueId);
    }
  }

  static hideCarOfClassType(carClassName) {
    $("#track-map [data-car-class=" + carClassName.toLowerCase() + "]").addClass("hidden");
  }

  static showCarOfClassType(carClassName) {
    $("#track-map [data-car-class=" + carClassName.toLowerCase() + "]").removeClass("hidden");
  }

  static toggleCarClasses(carClassName) {
    if ($("input[name=" + carClassName + "_toggle]").prop("checked") === true) {
      TrackMap.hideCarOfClassType(carClassName);
    } else {
      TrackMap.showCarOfClassType(carClassName);
    }
  }

  static updateDriverPosition(uniqueId, driverPos, displayName, fullDisplayName, displayColorClass, carClassName, posX, posZ) {
    if (carClassName !== "" && TrackMap.carClasses.indexOf(carClassName) === -1) {
      TrackMap.carClasses.push(carClassName);
      $("#track-class-control").append(`<div>
          <input type="checkbox" name="${carClassName}_toggle" value="${carClassName}" onClick="TrackMap.toggleCarClasses('${carClassName}')">
          <label class="${displayColorClass}" for="${carClassName}_toggle">Hide ${carClassName.toUpperCase()}</label><br>
        </div>`);
    }
    // Update driver circle position
    var offsetX = Number.parseFloat($("#track-map-svg svg").attr("data-x-offset"));
    var offsetY = Number.parseFloat($("#track-map-svg svg").attr("data-y-offset"));
    if (posX === 0 && posZ === 0) {
      offsetX = 20;
      offsetY = 20;
    }
    $("#track-map #" + uniqueId).attr("cx", posX + offsetX).attr("cy", posZ + offsetY).attr("data-car-class", carClassName).addClass("svg-" + displayColorClass);

    // Update driver name tooltip position
    var viewBox = $("#track-map svg").attr("viewBox");
    var actualWidth = Number.parseInt(viewBox.split(" ")[2]);
    var actualHeight = Number.parseInt(viewBox.split(" ")[3]);
    var htmlX = 10 + $("#track-map svg").width() * (posX + offsetX) / actualWidth;
    var htmlY = -13 + $("#track-map svg").height() * (posZ + offsetY) / actualHeight;
    $("#track-map #name_" + uniqueId).css({ "top": htmlY + "px", "left": htmlX + "px" }).attr("data-car-class", carClassName);

    var displayColorClassBG = "";
    if (displayColorClass != "") {
      displayColorClassBG = displayColorClass + "-bg";
    }

    $("#track-map #name_" + uniqueId + " .driver-pos").text(driverPos).addClass(displayColorClassBG);
    $("#track-map #name_" + uniqueId + " .display-name").text(displayName).addClass(displayColorClass);
    $("#track-map #name_" + uniqueId + " .full-display-name").text(fullDisplayName).addClass(displayColorClass);
  }

  static removeDriver(uniqueId) {
    $("#track-map #" + uniqueId).remove();
    $("#track-map #name_" + uniqueId).remove();
  }
}
