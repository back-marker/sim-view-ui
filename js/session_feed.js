class SessionFeed {
  static updateFeedTimestamp() {
    $("#feeds .single-feed .feed-time").each(function(idx, e) {
      $(e).text(SessionFeed.getFeedTimestamp(Number.parseInt($(e).attr("data-timestamp-ms"))));
    });
  }

  static getFeedTimestamp(millis) {
    var timeAgoSec = Util.getTimeAgoString(Date.now() / 1000 - millis / 1000);
    if (timeAgoSec === "Online") {
      timeAgoSec = "Just now";
    } else {
      timeAgoSec += " ago";
    }

    return timeAgoSec;
  }

  static getFeedTypeString(type, detail) {
    if (type === 0) {
      return "CRASH";
    } else if (type === 7) {
      return "CHAT";
    } else if (type === 10) {
      return "-";
    } else {
      return DataStore.getCarClass(detail.car_id);
    }
  }

  static getFeedTypeColorClass(type, detail) {
    if (type === 0) {
      return "speed-status-red-bg";
    } else if (type === 7) {
      return "chat-hr-color-bg";
    } else {
      return DataStore.getCarColorClass(detail.car_id) + "-bg";
    }
  }

  static prepareMessage(strings, ...parts) {
    var msg = strings[0];
    strings.slice(1).forEach(function(elem, idx) {
      switch (parts[idx][0]) {
        case "user":
          if (parts[idx].length === 3 && parts[idx][2] !== undefined) {
            // Team name also should be in feed
            const team = DataStore.getTeam(parts[idx][2]);
            msg += `<span class="feed-team">${team.name}</span>`;
            msg += " [ "
          }
          const user = DataStore.getUser(parts[idx][1]);
          msg += `<span class="feed-driver">${(user? user.name : "N/A")}</span>`;
          if (parts[idx].length === 3 && parts[idx][2] !== undefined) {
            msg += " ]";
          }
          msg += elem;
          break;

        case "car":
          const car = DataStore.getCar(parts[idx][1]);
          msg += `<span class="feed-car ${DataStore.getCarColorClass(parts[idx][1])}">${(car? car.display_name : "N/A")}</span>` + elem;
          break;

        case "team":
          const team = DataStore.getTeam(parts[idx][1]);
          msg += `<span class="feed-team">${team.name}</span>` + elem;
          break;

        case "speed":
          var status = "green";
          var speed = parts[idx][1];
          if (speed > 50 && speed <= 100) {
            status = "yellow";
          } else if (speed > 100) {
            status = "red";
          }
          msg += `<span class="speed-status-${status}-bg">${parts[idx][1]} Km/Hr</span>` + elem;
          break;

        case "nsp":
          var sectionName = Util.getSectionNameFromNSP(parts[idx][1]);
          if (sectionName !== "") {
            msg += "near <span class='feed-map-section-name'>" + sectionName + "</span>";
          }
          break;

        case "pit_time":
          msg += `<span class="pit-stop-time-bg">${Lap.convertMSToTimeString(parts[idx][1])}</span>` + elem;
          break;

        case "personal_lap_time":
          msg += `<span class="green-sec">${Lap.convertMSToTimeString(parts[idx][1])}</span>` + elem;
          break;

        case "session_lap_time":
          msg += `<span class="purple-sec">${Lap.convertMSToTimeString(parts[idx][1])}</span>` + elem;
          break;

        case "msg":
          msg += `<span class="feed_user_msg">${parts[idx][1]}</span>` + elem;
          break;
        default:
          msg += parts[idx][1] + elem;
      }
    });

    return msg;
  }

  static getFeedMsg(feedTime, type, detail) {
    switch (type) {
      case 0:
        // Update map to show collided car
        var teamEvent = Util.isCurrentTeamEvent();
        TrackMap.setCollisionCar(feedTime, detail["team_id_1"], detail["user_id_1"], detail["car_id_1"], teamEvent);
        TrackMap.setCollisionCar(feedTime, detail["team_id_2"], detail["user_id_2"], detail["car_id_2"], teamEvent);
        return this.getCollisionCarMsg(detail);
      case 1:
        TrackMap.setCollisionCar(feedTime, detail["team_id"], detail["user_id"], detail["car_id"], teamEvent);
        return this.getCollisionEnv(detail);
      case 2:
        return this.getUserConnectedMsg(detail);
      case 3:
        return this.getUserDisconnectedMsg(detail);
      case 4:
        return this.getStintBestLapMsg(detail);
      case 5:
        return this.getSessionClassBestLapMsg(detail);
      case 6:
        return this.getTeamDriverChange(detail);
      case 7:
        return this.getUserChatMsg(detail);
      case 10:
        return this.getPositionChangeMsg(detail);
      case 11:
        return this.getPitEntryMsg(detail);
      case 12:
        return this.getPitExitMsg(detail);
      case 13:
        return this.getOfftrackMsg(detail);
      case 14:
        return this.getRejoinsTrackMsg(detail);
      case 15:
        return this.getPitTeleportMsg(detail);
      default:
        return "-"
    }
  }

  static getCollisionCarMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id_1"], detail["team_id_1"]]} and ${["user", detail["user_id_2"], detail["team_id_2"]]} involved in collision ${["nsp", detail["nsp"]]}`
  }

  static getCollisionEnv(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} collided with wall at ${["speed", detail["speed"]]} ${["nsp", detail["nsp"]]}`;
  }

  static getUserConnectedMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} joined to drive ${["car", detail["car_id"]]}`;
  }

  static getUserDisconnectedMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} disconnected, was driving ${["car", detail["car_id"]]}`;
  }

  static getStintBestLapMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} sets stint best lap of ${["personal_lap_time", detail["lap_time"]]}`;
  }

  static getSessionClassBestLapMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} sets session best lap of ${["session_lap_time", detail["lap_time"]]}`;
  }

  static getTeamDriverChange(detail) {
    return this.prepareMessage `${["team", detail["team_id_1"]]} team swapped ${["user", detail["user_id_1"]]} with ${["user", detail["user_id_2"]]} driver`
  }

  static getUserChatMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]}: ${["msg", detail["msg"]]}`
  }

  static getPositionChangeMsg(detail) {
    if (detail["pos_change"] > 0) {
      return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} gained ${["pos_gain", detail["pos_change"]]} position, now at ${["pos_gain", "P" + (detail["final_pos"] + 1)]}`;
    } else if (detail["pos_change"] < 0) {
      return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} lose ${["pos_lose", -detail["pos_change"]]} position, now at ${["pos_lose", "P" + (detail["final_pos"] + 1)]}`;
    }
  }

  static getPitEntryMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} entered pit lane`;
  }

  static getPitExitMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} exits pit. Estimated pit stop time ${["pit_time", detail["pit_time"]]}`;
  }

  static getOfftrackMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} went offtrack ${["nsp", detail["nsp"]]}`;
  }

  static getRejoinsTrackMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} rejoins track with speed ${["speed", detail["speed"]]} ${["nsp", detail["nsp"]]}`;
  }

  static getPitTeleportMsg(detail) {
    return this.prepareMessage `${["user", detail["user_id"], detail["team_id"]]} teleported to pit`;
  }
}
