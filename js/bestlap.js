class BestlapPage extends Page {
  static CACHE_KEY = "best_lap_page_cache_query"
  static EVENTS_LIST = []
  static TRACKS_LIST = []
  static CARS_LIST = {}
  static search_query = BestlapPage.getSearchQueryFromCache() || { per_page: 10, page_no: 1, car_ids: [] };
  static cache_search_query = BestlapPage.getFromLocalCache();
  static searched_car_class_list = [];

  static getSearchQueryFromCache() {
    var parsed = JSON.parse(localStorage.getItem(BestlapPage.CACHE_KEY));
    if (parsed !== null) {
      parsed.car_ids = [];
    }
    return parsed;
  }

  static getFromLocalCache() {
    $("#message").hide();
    const cacheQuery = JSON.parse(localStorage.getItem(BestlapPage.CACHE_KEY));
    if (cacheQuery === undefined || cacheQuery == null) return {};
    return cacheQuery;
  }

  static validEventId(eventID) {
    if (eventID === undefined) return false;
    return ($(`#event-param option[value=${eventID}]`).length !== 0);
  }

  static validTrackId(trackID) {
    if (trackID === undefined) return false;
    return ($(`#track-param option[value=${trackID}]`).length !== 0);
  }

  static validCarIds(carIDs) {
    if (carIDs === undefined) return false;
    for (const carID of carIDs) {
      if ($(`#cars-param option[value=${carID}]`).length === 0) return false;
    }
    return true;
  }

  static cb_updateAllEvents(data) {
    if (data["status"] === "success") {
      const events = data.events;
      BestlapPage.EVENTS_LIST = events;
      var eventHtml = `<option value="0">Select Event</option>`;
      for (const event of events) {
        eventHtml += `<option value="${event.event_id}">${event.name}</option>`
      }
      $("#event-param select").html(eventHtml).change(function() {
        var eventId = Number.parseInt($(this).val());
        BestlapPage.search_query.by_event = true;
        BestlapPage.search_query.by_track = false;
        BestlapPage.search_query.event_id = eventId;
        BestlapPage.search_query.car_ids = [];

        $("#track-param select").val("0");
        $("#search-lap").attr("disabled", "disabled");
        getRequest("/api/ac/event/" + eventId + "/cars", BestlapPage.cb_updateEventCars);
      });

      if (BestlapPage.cache_search_query.by_event === true &&
        BestlapPage.validEventId(BestlapPage.cache_search_query.event_id)) {
        $("#event-param select").val(BestlapPage.cache_search_query.event_id);
      }
    }
  }

  static updateEntriesSelection() {
    $("#entries-param select").html(`<option value="0">Entries</option>
      <option value="10" selected="selected">10</option>
      <option value="20">20</option>
      <option value="30">30</option>
      <option value="40">40</option>
      <option value="50">50</option>`);
  }

  static cb_updateEventCars(data) {
    if (data["status"] === "success") {
      const cars = data.cars;
      var carsHtml = "";
      for (const car of cars) {
        BestlapPage.search_query.car_ids.push(car.car_id);
        carsHtml += `<span class="selected-car" data-car-id="${car.car_id}">${car.display_name}</span>`;
      }
      $("#selected-cars").html(carsHtml);
    }
    $("#search-lap").removeAttr("disabled");
  }

  static cb_updateAllTracks(data) {
    if (data["status"] === "success") {
      const tracks = data.tracks;
      BestlapPage.TRACKS_LIST = tracks;
      var trackHtml = `<option value="0">Select Track</option>`;
      for (const track of tracks) {
        trackHtml += `<option value="${track.track_config_id}">${track.display_name}</option>`
      }
      $("#track-param select").html(trackHtml).change(function() {
        var trackId = Number.parseInt($(this).val());
        BestlapPage.search_query.by_event = false;
        BestlapPage.search_query.by_track = true;
        BestlapPage.search_query.track_id = trackId;
        $("#event-param select").val("0");
      });

      if (BestlapPage.cache_search_query.by_track === true &&
        BestlapPage.validTrackId(BestlapPage.cache_search_query.track_id)) {
        $("#track-param select").val(BestlapPage.cache_search_query.track_id);
      }
    }
  }

  static cb_updateAllCars(data) {
    if (data["status"] === "success") {
      const cars = data.cars;
      var carsHtml = `<option value="0">Select Cars</option>`;
      for (const car of cars) {
        BestlapPage.CARS_LIST[car.car_id] = car;
        carsHtml += `<option value="${car.car_id}">${car.display_name}</option>`
      }
      $("#cars-param select").html(carsHtml).change(function() {
        var carId = Number.parseInt($(this).val());
        if (BestlapPage.search_query.car_ids.indexOf(carId) === -1) {
          BestlapPage.search_query.car_ids.push(carId);
          var carName = $("#cars-param select option:selected").text();
          $("#selected-cars").append(`<span class="selected-car" data-car-id="${carId}">${carName}</span>`);
        }
        $("#cars-param select").val("0");
      });

      if (BestlapPage.validCarIds(BestlapPage.cache_search_query.car_ids) &&
        BestlapPage.cache_search_query.car_ids.length !== 0) {
        BestlapPage.cache_search_query.car_ids.forEach(function(id) { $("#cars-param select").val(id).change(); });

        if (Object.entries(BestlapPage.cache_search_query).length) {
          BestlapPage.searchBestLaps(1);
        }
      } else if (BestlapPage.cache_search_query.car_ids !== undefined &&
        BestlapPage.cache_search_query.car_ids.length !== 0) {
        $("#message").text("Last selected combo is not valid anymore. Try new search").show();
        localStorage.removeItem(BestlapPage.CACHE_KEY);
      }
    }
  }

  static searchBestLaps(pageId) {
    if (BestlapPage.cache_search_query.car_ids === undefined ||
      BestlapPage.cache_search_query.car_ids.length === 0) {
      $("#message").text("Select a Car to view laps").show();
      return;
    }

    $("#bestlaps tbody").html("");
    var url = "/api/ac/bestlap/";
    if (BestlapPage.cache_search_query.by_event) {
      url += "event/" + BestlapPage.cache_search_query.event_id;
    } else if (BestlapPage.cache_search_query.by_track) {
      url += "track/" + BestlapPage.cache_search_query.track_id;
    } else {
      $("#message").text("Selection of combo is invalid. Either of Event or Track has to be selected").show();
      return;
    }

    if (BestlapPage.lapSelected == undefined) {
      $("#message").hide();
    }

    url += "/cars/" + BestlapPage.cache_search_query.car_ids.join(",");
    url += "/page/" + pageId;
    url += "/entries/" + BestlapPage.cache_search_query.per_page;
    for (var idx = 0; idx < BestlapPage.cache_search_query.car_ids.length; ++idx) {
      var carClass = BestlapPage.CARS_LIST[BestlapPage.cache_search_query.car_ids[idx]]["car_class"];
      if (BestlapPage.searched_car_class_list.indexOf(carClass) == -1) {
        BestlapPage.searched_car_class_list.push(carClass);
      }
    }
    if (pageId === 1) {
      localStorage.setItem(BestlapPage.CACHE_KEY, JSON.stringify(BestlapPage.cache_search_query));
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
    if (buttons["last"]) {
      $("#page-last button").removeAttr(disabled);
    } else {
      $("#page-last button").attr(disabled, disabled);
    }
  }

  static cb_updateBestLapResult(data) {
    if (data["status"] === "success") {
      var response = data["bestlaps"];
      var bestlaps = response["laps"];
      if (bestlaps.length === 0) {
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
      getRequest("/api/ac/users/" + driverList.join(','), Page.cb_updateDriversName);
    }
  }

  static disableLapFirstLapSelection(target, lapID) {
    if (target !== undefined) {
      $(target).parent().addClass("selected-lap-checkbox");
    }
    if (lapID !== undefined) {
      BestlapPage.lapSelected = lapID;
      $("#message").text("Select other lap to compare with").show();
    }
    $("#bestlaps-body").removeClass("active-compare-lap-selection");
  }

  static enableFirstLapSelection() {
    BestlapPage.lapSelected = undefined;
    $("#message").text("").hide();
    $(".selected-lap-checkbox .compare-lap-checkbox").prop("checked", false);
    $(".selected-lap-checkbox").removeClass("selected-lap-checkbox");
    $("#bestlaps-body").addClass("active-compare-lap-selection");
  }

  static openAnalysisPageOnClick(e) {
    const lapID = $(e.target).parents("tr").attr("data-lap-id");
    if ($(e.target).hasClass("compare-lap-checkbox")) {
      if ($(e.target).is(":checked")) {
        BestlapPage.disableLapFirstLapSelection(e.target, lapID);
      } else {
        BestlapPage.enableFirstLapSelection();
      }
    } else if (lapID) {
      if (BestlapPage.lapSelected !== undefined) {
        if (BestlapPage.lapSelected !== lapID) {
          // Open compare page
          window.open(`/analysis/compare/lap1/${BestlapPage.lapSelected}/lap2/${lapID}`, "_blank");
          BestlapPage.enableFirstLapSelection();
        }
      } else {
        window.open(`/analysis/lap/${lapID}`, "_blank");
      }
    }
  }
}

class BestLapEntry {
  constructor(lapId, driverId, carId, bestLap, gap, gapPer, grip, tyre, avgSpeed, maxSpeed,
    carBest, classBest, sec1CarBest, sec1ClassBest, sec2CarBest, sec2ClassBest, sec3CarBest, sec3ClassBest, finishedAt) {
    this.lapId = lapId;
    this.driverId = driverId;
    this.carId = carId;
    this.bestLap = bestLap;
    this.gap = gap;
    this.gapPer = gapPer;
    this.grip = grip;
    this.tyre = Util.getTyreStr(tyre);
    this.avgSpeed = avgSpeed;
    this.maxSpeed = maxSpeed;
    this.carBest = carBest;
    this.classBest = classBest;
    this.sec1CarBest = sec1CarBest;
    this.sec2CarBest = sec2CarBest;
    this.sec3CarBest = sec3CarBest;
    this.sec1ClassBest = sec1ClassBest;
    this.sec2ClassBest = sec2ClassBest;
    this.sec3ClassBest = sec3ClassBest;
    this.finishedAt = (new Date(finishedAt / 1000)).toLocaleString();
  }

  static fromJSON(data) {
    var lap = new Lap(data.time, data.sector_1, data.sector_2, data.sector_3);
    return new BestLapEntry(data.lap_id, data.user_id, data.car_id, lap, data.gap,
      data.gap_per, data.grip, data.tyre, data.avg_speed, data.max_speed, data.car_best, data.class_best,
      data.sector_1_car_best, data.sector_1_class_best, data.sector_2_car_best, data.sector_2_class_best,
      data.sector_3_car_best, data.sector_3_class_best, data.finished_at);
  }

  getLapStatus(classBest, carBest) {
    if (classBest === 1) {
      return "purple-sec";
    } else if (carBest === 1) {
      return "green-sec";
    }
    return "yellow-sec";
  }

  toHTML(pos) {
    const selectedLap = BestlapPage.lapSelected !== undefined && this.lapId === Number.parseInt(BestlapPage.lapSelected);
    return `<tr data-lap-id="${this.lapId}">
        <td class="lb-pos"><span>
        <span class="compare-lap-checkbox-container ${selectedLap? "selected-lap-checkbox" : ""}">
        <input class="compare-lap-checkbox" type="checkbox" ${selectedLap? "checked" : ""}>
        </span></span>${pos + 1}</td>
        <td class="lb-car-class ${Util.getBestLapCarColorClass(this.carId)}">${BestlapPage.CARS_LIST[this.carId]["car_class"]}</td>
        <td class="lb-car">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
          ${BestlapPage.CARS_LIST[this.carId]["display_name"]}
        </td>
        <td class="lb-driver" data-driver-id="${this.driverId}"></td>
        <td class="lb-best-lap"><span class="${this.getLapStatus(this.classBest, this.carBest)}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</span></td>
        <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="lb-gap">${Lap.convertToGapPercentDisplayString(this.gapPer)}</td>
        <td class="lb-sec1"><span class="${this.getLapStatus(this.sec1ClassBest, this.sec1CarBest)}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec1)}</span></td>
        <td class="lb-sec2"><span class="${this.getLapStatus(this.sec2ClassBest, this.sec2CarBest)}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec2)}</span></td>
        <td class="lb-sec3"><span class="${this.getLapStatus(this.sec3ClassBest, this.sec3CarBest)}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec3)}</span></td>
        <td class="lb-tyre">${this.tyre}</td>
        <td class="lb-grip">${(this.grip * 100).toFixed(2)} %</td>
        <td class="lb-max">${this.maxSpeed} km/h</td>
        <td class="lb-finish-time">${this.finishedAt}</td>
      </tr>`;
  }
}
