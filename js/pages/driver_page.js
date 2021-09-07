class DriverPage extends Page {
  static CHART_WIDTH = 720;
  static CHART_HEIGHT = 400;

  static cb_updateDriversList(data) {
    if (Util.isSuccessResponse(data)) {
      var drivers = data["users"];
      var selectHtml = `<option value="0">SELECT DRIVER</option>`;
      drivers.forEach(function(driver) {
        selectHtml += `<option data-country="${driver.country || ""}" value="${driver.user_id}">${driver.name}</option>`;
      });
      $("#driver-param select").html(selectHtml).change(function() {
        var driverId = $(this).val();
        var selected = $("#driver-param select option:selected");

        $(".ds-driver-name").text(selected.text());

        var country = selected.attr("data-country");
        if (country !== undefined && country !== "") {
          $(".ds-driver-country").html(`<img alt="Flag" src="${Util.getCountryFlagUrl(country)}">`);
        } else {
          $(".ds-driver-country img").remove();
        }

        getRequest(`/api/ac/user/${driverId}/summary`, DriverPage.cb_updateDriverSummary);
      });
    }
  }

  static cb_updateDriverSummary(data) {
    if (Util.isSuccessResponse(data)) {
      var driver = data["driver"];
      $("#basic-info .ds-car-events .ds-value").text(driver["total_events"]);
      $("#basic-info .ds-total-distance .ds-value").text(driver["total_distance_driven_km"] + " KM");
      $("#basic-info .ds-laps .ds-value").text(driver["total_laps"]);
      $("#basic-info .ds-valid-laps .ds-value").text(driver["total_valid_laps"]);

      var eventHtml = '';
      driver["events"].forEach(function(event) {
        eventHtml += `<tr>
          <td class="ds-event">${event["event_name"]}</td>
          <td class="ds-track">${event["track_name"]}</td>
          <td class="ds-team">${event["team_name"] === undefined? "-" : event["team_name"]}</td>
          <td class="ds-distance">${event["distance_driven_km"]} KM</td>
          <td class="ds-laps">${event["total_laps"]}</td>
          <td class="ds-valid-laps">${event["total_valid_laps"]}</td>
          <td class="ds-last-seen">${Util.getTimeAgoString(event["time_ago_sec"])} ago</td>
          </tr>`;
      });

      $("#driver-events tbody").html(eventHtml);
      DriverPage.createDriverTopCombosChart("tracks", "ds-top-tracks-chart", "Top driven tracks", driver["top_tracks"], "track_name", "distance_driven");
      DriverPage.createDriverTopCombosChart("cars", "ds-top-cars-chart", "Top driven cars", driver["top_cars"], "car_name", "distance_driven");
    }
  }

  static createDriverTopCombosChart(container, canvas_id, chart_label, data, label_key, value_key) {
    $("#" + canvas_id).remove();
    $(`#top-${container} .canvas-container`).append(`<canvas id="${canvas_id}" width="${DriverPage.CHART_WIDTH}" height="${DriverPage.CHART_HEIGHT}"></canvas>`);
    var canvas = document.getElementById(canvas_id);
    var ctx = canvas.getContext('2d');

    var scaleLabelColor = '#a8a8a8';
    var mainGridLineColor = '#a8a8a87a';

    var myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(function(e) { return e[label_key]; }),
        datasets: [{
          label: chart_label,
          data: data.map(function(e) { return e[value_key]; }),
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(255, 159, 64, 0.2)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          yAxes: [{
            position: (container === "cars" ? "right" : "left"),
            gridLines: {
              drawOnChartArea: false,
              color: mainGridLineColor
            },
            scaleLabel: {
              display: true,
              labelString: 'Distance in KM',
              fontColor: scaleLabelColor
            },
            ticks: {
              beginAtZero: true,
              fontColor: scaleLabelColor,
              fontSize: 14
            }
          }],
          xAxes: [{
            gridLines: {
              drawOnChartArea: false,
              color: mainGridLineColor
            },
            ticks: {
              fontColor: scaleLabelColor,
              fontSize: 14
            }
          }],
        },
        legend: {
          display: false
        }
      }
    });
  }
}
