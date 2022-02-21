class AnalysisPage extends Page {
  static DRIVER_CIRCLE_RADIUS = 8;
  static DRIVER_CIRCLE_COLOR = "#EF2D56";
  static LAP_TELEMETRY_VERSION = 1;

  static update(lapID) {
    getRequest(`/api/ac/lap/summary/${lapID}`, AnalysisPage.cb_updateLapSummary);
    getRequestBinary(`/api/ac/lap/telemetry/${lapID}`, AnalysisPage.cb_updateLapTelemetry,
      AnalysisPage.cb_telemetryMissing);
  }

  static cb_updateLapSummary(data) {
    if (data["status"] === "success") {
      const details = data.summary;

      $("#lap-time").text(Lap.convertMSToDisplayTimeString(details.lap.time));

      getRequest(`/api/ac/user/${details.user_id}`, function(data) {
        $("#driver-name").text(data.user.name);
      });
      getRequest(`/api/ac/car/${details.car_id}`, function(data) {
        $("#car-class").text(data.car.car_class);
        $("#car-name span").text(data.car.display_name).css({ "background": `url('/images/ac/car/${data.car.car_id}/badge')` });
      });

      $("#track-name").text(`${details.track_name} [ ${details.track_length}m ]`);
      $("#event-name").html(`<a target="_blank" href="/ac/event/${details.event_id}/result">${details.event_name}</a>`);

      $("#metadata-columnar-container .session-type .value").text(details.session_type);
      $("#metadata-columnar-container .weather .value").text(Util.getWeatherDisplayName(details.weather));
      $("#metadata-columnar-container .air-temp .temp-val").text(details.air_temp);
      $("#metadata-columnar-container .road-temp .temp-val").text(details.road_temp);
      $("#metadata-columnar-container .grip .value").text((details.lap.grip * 100.0).toFixed(2) + "%");
      $("#metadata-columnar-container .tyre .value").text(`(${details.lap.tyre})`);
      $("#metadata-columnar-container .max-speed .value").text(`${details.lap.max_speed} KM/HR`);
      $("#metadata-columnar-container .sector1 .value").text(Lap.convertMSToDisplayTimeString(details.lap.sector_1));
      $("#metadata-columnar-container .sector2 .value").text(Lap.convertMSToDisplayTimeString(details.lap.sector_2));
      $("#metadata-columnar-container .sector3 .value").text(Lap.convertMSToDisplayTimeString(details.lap.sector_3));

      getRequest(`/images/ac/track/${details.track_config_id}/map`, function(data) {
        $("#lap-track-map").html(data.childNodes[0].outerHTML);

        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const uniqueID = "nsp-indicator";
        circle.id = uniqueID;
        $("#lap-track-map svg").append(circle);
        var scale = Number.parseFloat($("#lap-track-map svg").attr("data-scale"));
        $("#lap-track-map #" + uniqueID).attr("r", AnalysisPage.DRIVER_CIRCLE_RADIUS * scale).attr("fill", AnalysisPage.DRIVER_CIRCLE_COLOR);
      });
    }
  }

  static cb_updateLapTelemetry(data) {
    const telemetryBinary = AnalysisPage.getTelemetryFromBinary(data);
    if (telemetryBinary === undefined) return;

    const telemetry = telemetryBinary.telemetry;
    const trackLength = telemetryBinary.track_length;

    AnalysisPage.renderLapNSPGraphs(telemetry, trackLength);

    AnalysisPage.updatePositionInTrackMap = function(nsp) {
      if (nsp < 0.0 || nsp > 1.0) { return; }

      var idx = 0;
      for (; idx < telemetry.length; ++idx) {
        if (telemetry[idx].nsp >= nsp) { break; }
      }
      const dataPoint = telemetry[Math.min(idx, telemetry.length - 1)];

      const posX = dataPoint.position_x;
      const posZ = dataPoint.position_z;

      var offsetX = Number.parseFloat($("#lap-track-map svg").attr("data-x-offset"));
      var offsetY = Number.parseFloat($("#lap-track-map svg").attr("data-y-offset"));
      if (posX === 0 && posZ === 0) {
        offsetX = 20;
        offsetY = 20;
      }

      $("#lap-track-map #" + "nsp-indicator").attr("cx", posX + offsetX).attr("cy", posZ + offsetY);
    }
  }

  static cb_telemetryMissing(data) {
    $("#lap-track-map").remove();
    $("#lap-graphs").html("<div id='message'>No telemetry data available</div>");
  }

  static getTelemetryFromBinary(data) {
    var buffer = new DataView(data);
    var offset = 0;
    var telemetry = [];
    var lastGear = 1;

    var version = buffer.getInt32(offset, true);
    if (version !== AnalysisPage.LAP_TELEMETRY_VERSION) {
      return undefined;
    }

    var trackLength = buffer.getInt32(offset + 4, true);
    offset += 8;
    while (offset < buffer.byteLength) {
      const nsp = buffer.getFloat32(offset, true);
      var gear = buffer.getUint8(offset + 4, true);
      const speed = buffer.getFloat32(offset + 5, true);
      const pX = buffer.getFloat32(offset + 9, true);
      const pZ = buffer.getFloat32(offset + 13, true);

      if (gear == 1) {
        gear = lastGear;
      } else {
        lastGear = gear;
      }
      --gear;
      telemetry.push({ "nsp": nsp, "gear": gear, "speed": speed, position_x: pX, position_z: pZ });

      offset += 17;
    }

    return { "telemetry": telemetry, "track_length": trackLength };
  }

  static renderLapNSPGraphs(telemetry, trackLength) {
    const config = {
      "axisTitleColor": "#bbb",
      "axisTitleFontSize": 14,
      "gridLineColor": "#424242",
      "crossHairColor": "#EF2D56",
      "zoomboxBackgroundColor": "rgba(66,133,244,0.2)",
      "zoomboxBorderColor": "#48F"
    };

    AnalysisPage.renderSpeedGraph(telemetry, trackLength, config);
    AnalysisPage.renderGearGraph(telemetry, trackLength, config);
  }

  static renderSpeedGraph(telemetry, trackLength, config) {
    const speedLineColor = "#32D296";

    const speedData = {
      datasets: [{
        label: 'Speed (km/hr)',
        data: telemetry.map(function(e) { return { x: e.nsp * trackLength, y: e.speed }; }),
        fill: false,
        backgroundColor: speedLineColor,
        borderColor: speedLineColor,
        lineTension: 0,
        pointRadius: 0,
        showLine: true,
        interpolate: true
      }]
    };

    const speedChartTooltipCallback = {
      title: function(a, d) {
        AnalysisPage.updatePositionInTrackMap(a[0].element.x.toFixed(0) / trackLength);
        return a[0].element.x.toFixed(0);
      },
      label: function(d) {
        return "Speed" + ": " + d.element.y.toFixed(2) + " km/hr";
      }
    }

    return AnalysisPage.createChart("lap-graph1-canvas", speedData, false, true, "Speed in km / hr", config, speedChartTooltipCallback);
  }

  static renderGearGraph(telemetry, trackLength, config) {
    const gearLineColor = "#E38D59";

    const gearData = {
      datasets: [{
        label: 'Gear',
        data: telemetry.map(function(e) { return { x: e.nsp * trackLength, y: e.gear }; }),
        fill: false,
        backgroundColor: gearLineColor,
        borderColor: gearLineColor,
        lineTension: 0,
        pointRadius: 0,
        showLine: true,
        interpolate: true
      }]
    };

    const gearChartTooltipCallback = {
      title: function(a, d) {
        return a[0].element.x.toFixed(0);
      },
      label: function(d) {
        return d.chart.data.datasets[d.datasetIndex].label + ": " + d.element.y.toFixed(0);
      }
    }

    return AnalysisPage.createChart("lap-graph2-canvas", gearData, true, false, "Gear", config, gearChartTooltipCallback);
  }

  static createChart(canvasID, dataset, stepped, smooth, yAxisTitle, config, tooltipCallback) {
    const nspAxisOption = {
      title: {
        display: true,
        text: 'Distance in meters [m]',
        color: config.axisTitleColor,
        font: {
          size: config.axisTitleFontSize
        }
      },
      grid: {
        color: config.gridLineColor
      },
      ticks: {
        color: config.axisTitleColor
      }
    };

    const yAxisOption = {
      beginAtZero: true,
      title: {
        display: true,
        text: yAxisTitle,
        color: config.axisTitleColor,
        font: {
          size: config.axisTitleFontSize
        }
      },
      grid: {
        color: config.gridLineColor
      },
      ticks: {
        precision: 0,
        color: config.axisTitleColor
      }
    };
    if (yAxisTitle == "Gear") {
      yAxisOption.ticks.padding = 10;
      const gearArray = dataset.datasets[0].data.map(function(e) { return e.y; });
      yAxisOption.max = Math.max(...gearArray) + 1;
      yAxisOption.ticks.callback = function(value, index, ticks) {
        if (value === 0) {
          return "N";
        } else if (value === -1) {
          return "R";
        }
        return value;
      }
    }

    const canvasCtx = document.getElementById(canvasID).getContext('2d');
    const chart = new Chart(canvasCtx, {
      type: 'scatter',
      data: dataset,
      options: {
        stepped: stepped,
        scales: {
          y: yAxisOption,
          x: nspAxisOption
        },
        cubicInterpolationMode: (smooth) ? "monotone" : "default",
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            animation: false,
            mode: 'interpolate',
            intersect: false,
            callbacks: tooltipCallback
          },
          crosshair: {
            line: {
              color: config.crossHairColor,
              width: 2
            },
            sync: {
              enabled: true,
              group: 1,
            },
            zoom: {
              enabled: true,
              zoomboxBackgroundColor: config.zoomboxBackgroundColor,
              zoomboxBorderColor: config.zoomboxBorderColor,
              zoomButtonText: 'Reset Zoom',
              zoomButtonClass: 'reset-zoom',
            }
          }
        }
      }
    });

    return chart;
  }
}
