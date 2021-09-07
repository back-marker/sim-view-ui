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
    if (Util.isLiveEventPage()) {
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
      var tabToDisplay = "#" + e.target.getAttribute("data-tab") + "-tab";
      $(tabToDisplay).fadeIn();
    });

    $("#stints-tab").click(function(e) {
      var stintBar;
      if ($(e.target).hasClass('stint-driver')) {
        stintBar = $(e.target);
      } else if ($(e.target).parents('.stint-driver').length === 1) {
        stintBar = $(e.target).parents('.stint-driver');
      }
      if (stintBar !== undefined) {
        stintBar.next().slideToggle();
        stintBar.find('.arrow-up').toggleClass('rotate-180-clock');
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
    $("#message").hide();
  } else if (page == "driver-page") {
    Page.setCommonHeaderHtml("driver");
    getRequest("/api/ac/users", DriverPage.cb_updateDriversList);
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
