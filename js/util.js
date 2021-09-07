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
    return count === 1 ? "" : "s";
  }

  static getSectionNameFromNSP(nsp) {
    var sectionName = ""
    $("#track-map-svg .map-section").each(function(idx, e) {
      var nspStart = $(e).attr("data-nsp-start");
      var nspEnd = $(e).attr("data-nsp-end");
      if (nspStart <= nsp && nsp < nspEnd) {
        sectionName = $(e).attr("data-section-name");
      }
    });

    return sectionName;
  }

  static getTimeAgoString(secs) {
    if (secs < 0) {
      return "Unknown";
    } else if (secs >= 0 && secs < 60) {
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
    return window.location.pathname === "/";
  }

  static getCarColorClass(carId) {
    // TODO: Remove leaderboard dependency
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

  static getOptimalWidthAndHeightForMap(svg_selector) {
    var viewbox = $(svg_selector).attr("viewBox");
    var width = Number.parseInt(viewbox.split(" ")[2]);
    var height = Number.parseInt(viewbox.split(" ")[3]);
    var maxWidth = Number.parseInt($(svg_selector).css("max-width"));
    var maxHeight = Number.parseInt($(svg_selector).css("max-height"));
    var k = Math.min(maxWidth / width, maxHeight / height);

    return { "width": (width * k) + "px", "height": (height * k) + "px" };
  }
}
