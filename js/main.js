function getRequest(url, callback, failure) {
  $.ajax({
    type: "GET",
    url: url,
    crossDomain: true,
    success: function(data) { callback(data); },
    error: function() {
      if (failure === undefined) {
        console.log(arguments);
      } else {
        failure();
      }
    }
  });
}

function getRequestPromise(url, callback, failure) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      type: "GET",
      url: url,
      crossDomain: true,
      success: function(data) { callback(data); },
      error: function() {
        if (failure === undefined) {
          console.log(arguments);
        } else {
          failure();
        }
      },
      complete: resolve
    });
  });
}

function getRequestBinary(url, callback, failure) {
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.responseType = "arraybuffer";

  var onFailure = function() {
    if (failure === undefined) {
      console.log(arguments);
    } else {
      failure();
    }
  };

  req.onload = function() {
    if (req.status === 200) {
      var arrayBuffer = req.response;
      if (arrayBuffer) {
        callback(arrayBuffer);
      } else {
        onFailure();
      }
    } else {
      onFailure();
    }
  };

  req.onerror = onFailure;
  req.send(null);
}

$(document).ready(function() {
  var page = $("body").attr("data-page");
  if (page == "lb-page") {
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), LeaderboardPage.cb_updateEventInfo);

    $("#board-body").click(function(e) {
      if ($(e.target).hasClass("activate-overlay")) {
        LeaderboardPage.c_updateTeamDetailInOverlay($(e.target).attr("data-team-id"));
        $("#cover-preview").fadeIn();
      }
    });

    $("#cover-preview").click(function(e) {
      if ($(e.target).hasClass("cover-preview")) {
        $("#cover-preview").fadeOut(300, function() { $("#livery-preview img").remove(); });
      }
    });
  } else if (page == "events-page") {
    if (Page.isLiveEventPage()) {
      Page.setCommonHeaderHtml("live");
      $("#link-live").addClass("active");
      $("title").text("SimView | Live Events");
      getRequest("/api/ac/events/live", EventsPage.cb_updateAllEvents);
    } else {
      Page.setCommonHeaderHtml("events");
      $("#link-events").addClass("active");
      $("title").text("SimView | All Events")
      getRequest("/api/ac/events", EventsPage.cb_updateAllEvents);
    }
  } else if (page == "result-page") {
    Page.setCommonHeaderHtml("result");
    getRequest("/api/ac/event/" + Util.getCurrentEvent(), ResultPage.cb_updateEventInfo);
    $(".result-tabs").hide();
    $("#standings-tab").show();
    $("#result-main-tabs").click(function(e) {
      if (e.target.tagName === "UL") { return; }
      $("#result-main-tabs li.active").removeClass("active");
      e.target.classList.add("active");

      $(".result-tabs").hide();
      var tabToDisplay = e.target.getAttribute("data-tab") + "-tab";
      $("#" + tabToDisplay).fadeIn();
      ResultPage.renderTab(tabToDisplay);
    });

    $("#stints-tab").click(function(e) {
      var stintBar;
      if ($(e.target).hasClass('stint-driver')) {
        stintBar = $(e.target);
      } else if ($(e.target).parents('.stint-driver').length === 1) {
        stintBar = $(e.target).parents('.stint-driver');
      }

      if (stintBar === undefined) return;

      stintBar.find('.arrow-down').toggleClass('rotate-180-clock');
      const sessionId = $("#result-main").attr("data-session-id");
      const parentContainer = $(stintBar).parents(".driver-stints");
      const stintGroupId = parentContainer.attr("id");
      var url = "";
      if (Util.isCurrentTeamEvent()) {
        const teamID = stintBar.find('.stint-team-name').attr('data-team-id');
        url = `/api/ac/session/${sessionId}/result/stints/team/${teamID}`;
      } else {
        const userID = stintBar.find('.stint-driver-name').attr('data-driver-id');
        const carID = stintBar.find('.stint-driver-car').attr('data-car-id');
        url = `/api/ac/session/${sessionId}/result/stints/user/${userID}/car/${carID}`;
      }

      if (parentContainer.attr("data-loaded") !== "true") {
        getRequest(url, function(data) {
          parentContainer.attr("data-loaded", "true");
          ResultPage.cb_updateSingleStint(data, stintGroupId);
          stintBar.next().show();
        });
      } else {
        stintBar.next().slideToggle();
      }
    });
  } else if (page == "bestlap-page") {
    Page.setCommonHeaderHtml("bestlap");
    BestlapPage.updateEntriesSelection();
    getRequest("/api/ac/events", BestlapPage.cb_updateAllEvents);
    getRequest("/api/ac/tracks", BestlapPage.cb_updateAllTracks);
    getRequest("/api/ac/cars", BestlapPage.cb_updateAllCars);
    if (BestlapPage.cache_search_query.per_page !== undefined) {
      $("#bestlap-page #entries-param select").val(BestlapPage.cache_search_query.per_page);
    }

    $("#search-lap").click(function() {
      BestlapPage.enableFirstLapSelection();
      BestlapPage.cache_search_query = JSON.parse(JSON.stringify(BestlapPage.search_query));
      BestlapPage.searchBestLaps(1);
    });

    $("#page-buttons button").click(function() {
      BestlapPage.searchBestLaps($(this).attr("data-page"));
    });

    $("#selected-cars").click(function(e) {
      var carId = $(e.target).attr("data-car-id");
      if (carId !== undefined) {
        carId = Number.parseInt(carId);
        $(e.target).remove();
        var idx = BestlapPage.search_query.car_ids.indexOf(carId);
        if (idx > -1) {
          BestlapPage.search_query.car_ids.splice(idx, 1);
        }
      }
    });

    $("#bestlaps-body").click(BestlapPage.openAnalysisPageOnClick);
  } else if (page == "driver-page") {
    Page.setCommonHeaderHtml("driver");
    getRequest("/api/ac/users", DriverPage.cb_updateDriversList);
  } else if (page == "analysis-page") {
    Page.setCommonHeaderHtml("analysis");
    AnalysisPage.update();
  }

  $("#tab-map").hide();
  $("#map-section-tooltip").hide();
  $("#lb-tabs").click(function(e) {
    var target = $(e.target).attr("data-tab");
    if (target === "standings") {
      $("#tab-map").hide();
      $("#tab-standings").fadeIn();
      $("span[data-tab='standings']").addClass("active");
      $("span[data-tab='map']").removeClass("active");
    } else if (target === "map") {
      $("#tab-standings").hide();
      $("#tab-map").addClass("active").fadeIn();
      $("span[data-tab='map']").addClass("active");
      $("span[data-tab='standings']").removeClass("active");
    }
  });

  $("#bestlap-page #entries-param select").change(function() {
    var entries = Number.parseInt($(this).val());
    BestlapPage.search_query.per_page = entries;
  });
});
