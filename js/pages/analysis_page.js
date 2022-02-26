class AnalysisPage extends Page {
  static DRIVER_CIRCLE_RADIUS = 16;
  static DRIVER_CIRCLE_COLOR = "#FEC606";
  static LAP_TELEMETRY_VERSION = 1;
  static RACING_LINE_DEFAULT_STROKE_WIDTH = 2;
  static SIDE_LINE_DEFAULT_STROKE_WIDTH = 1;
  static RACING_LINE_DEFAULT_COLOR = "#ff5757";
  static compareLap = true;
  static lapTimes = [0, 0];
  static graphConfig = {
    "axisTitleColor": "#bbb",
    "axisTitleFontSize": 14,
    "gridLineColor": "#424242",
    "crossHairColor": AnalysisPage.DRIVER_CIRCLE_COLOR,
    "zoomboxBackgroundColor": "rgba(66,133,244,0.2)",
    "zoomboxBorderColor": "#48F",
    "showLegend": AnalysisPage.compareLap,
    "yAxisBeginAtZero": false,
    "lineColors": ["#71BA51", "#36a2eb"]
  };

  static update(lapID) {
    if (AnalysisPage.compareLap) {
      AnalysisPage.updateCompareLapSummary(7, 1258);
      $("#main-graphs").addClass("compare-lap");
    } else {
      $("#main-graphs").addClass("single-lap");
      $("#lap-metadata-2").remove();
      $("#lap-data-2").remove();
      getRequest(`/api/ac/lap/summary/${lapID}`, AnalysisPage.cb_updateLapSummary, AnalysisPage.cb_lapMissing);
    }

    var preX;
    var preY;
    var sumDX = 0;
    var sumDY = 0;
    var mousedown = false;
    var scale = 1;

    $("#zoom-slider-input").on("input", function(e) {
      const zoomValue = Number.parseInt(e.target.value);
      const newScale = ((7 * zoomValue + 92) / 99).toFixed(2);
      if (newScale < 1) newScale = 1;
      if (newScale > 8) newScale = 8;
      scale = newScale;
      if (scale == 1) {
        sumDX = 0;
        sumDY = 0;
      }
      AnalysisPage.zoomAndPanInMapGraph(scale, sumDX, sumDY);
    });


    $("#racing-line-svg").mousedown(function(e) {
      mousedown = true;
      preX = e.clientX;
      preY = e.clientY;
    }).mouseup(function() {
      mousedown = false;
    }).mousemove(function(e) {
      if (mousedown) {
        var curX = e.clientX;
        var curY = e.clientY;
        var dX = curX - preX;
        var dY = curY - preY;
        sumDX += dX;
        sumDY += dY;
        preX = curX;
        preY = curY;

        AnalysisPage.zoomAndPanInMapGraph(scale, sumDX, sumDY);
      }
    });
  }

  static updateLapSummary(lapIndex, details) {
    const lapData = `#lap-data-${lapIndex}`;
    $(`${lapData} .lap-time`).text(Lap.convertMSToDisplayTimeString(details.lap.time));
    AnalysisPage.lapTimes[lapIndex - 1] = Lap.convertMSToDisplayTimeString(details.lap.time);

    getRequest(`/api/ac/user/${details.user_id}`, function(data) {
      $(`${lapData} .lap-driver-name`).text(data.user.name);
    });
    getRequest(`/api/ac/car/${details.car_id}`, function(data) {
      $(`${lapData} .car-class`).text(data.car.car_class);
      $(`${lapData} .car-name span`).text(data.car.display_name).css({ "background": `url('/images/ac/car/${data.car.car_id}/badge')` });
    });

    const lapMetadata = `#lap-metadata-${lapIndex}`;
    $(`${lapMetadata} .event-name`).html(`<a target="_blank" href="/ac/event/${details.event_id}/result">${details.event_name}</a>`);
    $(`${lapMetadata} .metadata-columnar-container .session-type .value`).text(details.session_type);
    $(`${lapMetadata} .metadata-columnar-container .weather .value`).text(Util.getWeatherDisplayName(details.weather));
    $(`${lapMetadata} .metadata-columnar-container .air-temp .temp-val`).text(details.air_temp);
    $(`${lapMetadata} .metadata-columnar-container .road-temp .temp-val`).text(details.road_temp);
    $(`${lapMetadata} .metadata-columnar-container .grip .value`).text((details.lap.grip * 100.0).toFixed(2) + "%");
    $(`${lapMetadata} .metadata-columnar-container .tyre .value`).text(`(${details.lap.tyre})`);
    $(`${lapMetadata} .metadata-columnar-container .max-speed .value`).text(`${details.lap.max_speed} KM/HR`);
    $(`${lapMetadata} .metadata-columnar-container .sector1 .value`).text(Lap.convertMSToDisplayTimeString(details.lap.sector_1));
    $(`${lapMetadata} .metadata-columnar-container .sector2 .value`).text(Lap.convertMSToDisplayTimeString(details.lap.sector_2));
    $(`${lapMetadata} .metadata-columnar-container .sector3 .value`).text(Lap.convertMSToDisplayTimeString(details.lap.sector_3));
    $(`${lapMetadata} .metadata-columnar-container .track .value`).text(details.track_name);
    $(`${lapMetadata} .metadata-columnar-container .track-length .value`).text(`${details.track_length} m`);
  }

  static setupNspIndicatorTrackMap(data) {
    $("#lap-track-map").append(data.childNodes[0].outerHTML);
    $("#lap-track-map .map-section").remove();
    $("#lap-track-map #sidelane1").remove();
    $("#lap-track-map #sidelane2").remove();
  }

  static setupRacingLineTrackMap(data) {
    $("#racing-line-svg").html(data.childNodes[0].outerHTML);
    $("#racing-line-svg .map-section").remove();
    $("#racing-line-svg #fastlane").remove();
    $("#racing-line-svg #pitlane").remove();
    $("#racing-line-svg #finishline").remove();
    $("#zoom-slider-input").val(0);
  }

  static addNspIndicatorInTrackMap() {
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const uniqueID = "nsp-indicator";
    circle.id = uniqueID;
    $("#lap-track-map svg").append(circle);
    var scale = Number.parseFloat($("#lap-track-map svg").attr("data-scale"));
    $("#lap-track-map #" + uniqueID).attr("r",
      AnalysisPage.DRIVER_CIRCLE_RADIUS * scale).attr("fill", AnalysisPage.DRIVER_CIRCLE_COLOR);
  }

  static cb_updateLapSummary(data) {
    if (data["status"] === "success") {
      const details = data.summary;
      AnalysisPage.updateLapSummary(1, details);

      getRequest(`/images/ac/track/${details.track_config_id}/map`, function(data) {
        AnalysisPage.setupNspIndicatorTrackMap(data);
        AnalysisPage.setupRacingLineTrackMap(data);
        AnalysisPage.addNspIndicatorInTrackMap();

        getRequestBinary(`/api/ac/lap/telemetry/${details.lap.stint_lap_id}`, AnalysisPage.cb_updateLapTelemetry,
          AnalysisPage.cb_telemetryMissing);
      });
    }
  }

  static updateCompareLapSummary(lap1ID, lap2ID) {
    getRequest(`/api/ac/lap/summary/${lap1ID}`, function(lap1Data) {
      getRequest(`/api/ac/lap/summary/${lap2ID}`, function(lap2Data) {

        const summary1 = lap1Data.summary;
        const summary2 = lap2Data.summary;
        if (summary1.track_config_id !== summary2.track_config_id) {
          AnalysisPage.tackDoesNotMatch();
          return;
        }
        AnalysisPage.updateLapSummary(1, summary1);
        AnalysisPage.updateLapSummary(2, summary2);

        getRequest(`/images/ac/track/${summary1.track_config_id}/map`, function(data) {
          AnalysisPage.setupNspIndicatorTrackMap(data);
          AnalysisPage.setupRacingLineTrackMap(data);
          AnalysisPage.addNspIndicatorInTrackMap();

          getRequestBinary(`/api/ac/lap/telemetry/${lap1ID}`, function(telemetry1) {
            getRequestBinary(`/api/ac/lap/telemetry/${lap2ID}`, function(telemetry2) {
              const telemetryBinary1 = AnalysisPage.getTelemetryFromBinary(telemetry1);
              const telemetryBinary2 = AnalysisPage.getTelemetryFromBinary(telemetry2);
              if (telemetryBinary1 === undefined || telemetryBinary2 === undefined) {
                AnalysisPage.cannotProcessTelemetry()
                return;
              }

              const btelemetry1 = telemetryBinary1.telemetry;
              const trackLength = telemetryBinary1.track_length;
              const btelemetry2 = telemetryBinary2.telemetry;

              AnalysisPage.updateCompareLapTelemetry(btelemetry1, btelemetry2, trackLength);
            }, AnalysisPage.cb_telemetryMissing)
          }, AnalysisPage.cb_telemetryMissing);
        });
      }, AnalysisPage.cb_lapMissing);
    }, AnalysisPage.cb_lapMissing);
  }

  static updatePositionInTrackMap(nsp, telemetry) {
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

  static cb_updateLapTelemetry(data) {
    const telemetryBinary = AnalysisPage.getTelemetryFromBinary(data);
    if (telemetryBinary === undefined) return;

    const telemetry = telemetryBinary.telemetry;
    const trackLength = telemetryBinary.track_length;

    AnalysisPage.renderLapNSPGraphs([telemetry], trackLength, AnalysisPage.graphConfig);
    AnalysisPage.renderRacingLine(telemetry, 1, AnalysisPage.graphConfig);

    AnalysisPage.updatePositionInTrackMap(0, telemetry);
  }

  static updateCompareLapTelemetry(btelemetry1, btelemetry2, trackLength) {
    AnalysisPage.renderLapNSPGraphs([btelemetry1, btelemetry2], trackLength, AnalysisPage.graphConfig);
    AnalysisPage.renderRacingLine(btelemetry1, 1, AnalysisPage.graphConfig);
    AnalysisPage.renderRacingLine(btelemetry2, 2, AnalysisPage.graphConfig);
    AnalysisPage.updatePositionInTrackMap(0, btelemetry1);
  }

  static zoomAndPanInMapGraph(scale, dX, dY) {
    if (scale < 1) return;

    $("#racing-line-svg svg").attr("transform", `scale(${scale})translate(${dX},${dY})`);

    const strokeWidth = (AnalysisPage.SIDE_LINE_DEFAULT_STROKE_WIDTH / scale).toFixed(2);
    $("#racing-line-svg svg #racingline").css("stroke-width", strokeWidth *
      AnalysisPage.RACING_LINE_DEFAULT_STROKE_WIDTH);
    $("#racing-line-svg svg #sidelane1").css("stroke-width", strokeWidth);
    $("#racing-line-svg svg #sidelane2").css("stroke-width", strokeWidth);
  }

  static renderRacingLine(telemetry, lapIndex, config) {
    var offsetX = Number.parseFloat($("#lap-track-map svg").attr("data-x-offset"));
    var offsetY = Number.parseFloat($("#lap-track-map svg").attr("data-y-offset"));

    const polygonPoints = telemetry.map(function(e) {
      return (offsetX + e.position_x).toFixed(2) + "," + (offsetY + e.position_z).toFixed(2);
    }).join(" ");

    const lineColor = config.lineColors[lapIndex - 1];
    var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttributeNS(null, "id", "racingline");
    polygon.setAttributeNS(null, "points", polygonPoints);
    polygon.setAttributeNS(null, "style", "fill:none; stroke:" + lineColor +
      "; stroke-width:" + AnalysisPage.RACING_LINE_DEFAULT_STROKE_WIDTH);

    if (config.showLegend) {
      var legendHtml = `<div><span class="rl-legend-box" style="background-color:${lineColor}"></span><span class="rl-legend-label">${AnalysisPage.lapTimes[lapIndex - 1]}</span></div>`
      $("#racing-line-legend").append(legendHtml);
    }
    $("#racing-line-svg svg").append(polygon);
  }

  static cb_telemetryMissing() {
    $("#lap-track-map").remove();
    $("#lap-graphs").html("<div id='message'>No telemetry data available</div>");
  }

  static cb_lapMissing() {
    $("main").html("<div id='message'>Lap does not exists</div>");
  }

  static tackDoesNotMatch() {
    $("main").html("<div id='message'>The lap selected are not on same track</div>");
  }

  static cannotProcessTelemetry() {
    $("main").html("<div id='message'>Cannot process telemetry for selected lap</div>");
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

  static renderLapNSPGraphs(telemetry, trackLength, config) {
    AnalysisPage.renderSpeedGraph(telemetry, trackLength, config);
    AnalysisPage.renderGearGraph(telemetry, trackLength, config);
  }

  static createTelemetryDataset(legendLabel, lineColor, telemetry, trackLength, propName) {
    return {
      label: legendLabel,
      data: telemetry.map(function(e) { return { x: e.nsp * trackLength, y: e[propName] }; }),
      fill: false,
      backgroundColor: lineColor,
      borderColor: lineColor,
      lineTension: 0,
      pointRadius: 0,
      showLine: true,
      interpolate: true
    };
  }

  static renderSpeedGraph(originalTelemetry, trackLength, config) {
    const speedData = {
      datasets: originalTelemetry.map(function(telemetry, idx) {
        return AnalysisPage.createTelemetryDataset(AnalysisPage.lapTimes[idx], config.lineColors[idx], telemetry, trackLength, "speed");
      })
    };

    var prevSpeed;
    const speedChartTooltipCallback = {
      title: function(a, d) {
        AnalysisPage.updatePositionInTrackMap(a[0].element.x.toFixed(0) / trackLength, originalTelemetry[0]);
        return a[0].element.x.toFixed(0);
      },
      label: function(d) {
        if (d.datasetIndex == 0) prevSpeed = d.element.y.toFixed(2);
        var gap = 0;
        if (d.datasetIndex == 1) gap = (d.element.y.toFixed(2) - prevSpeed).toFixed(2);
        if (gap > 0) gap = "+" + gap;
        else gap = "" + gap;
        var label = AnalysisPage.lapTimes[d.datasetIndex] + " | " + d.element.y.toFixed(2) + " km / hr";
        if (d.datasetIndex == 1) label += " (" + gap + ")";
        return label;
      }
    }

    return AnalysisPage.createChart("lap-graph1-canvas", speedData, false, true, "Speed [ km / hr ]", config, speedChartTooltipCallback);
  }

  static renderGearGraph(originalTelemetry, trackLength, config) {
    const gearData = {
      datasets: originalTelemetry.map(function(telemetry, idx) {
        return AnalysisPage.createTelemetryDataset(AnalysisPage.lapTimes[idx], config.lineColors[idx], telemetry, trackLength, "gear")
      })
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
        text: 'Track Distance [m]',
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
      beginAtZero: config.yAxisBeginAtZero,
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
        maintainAspectRatio: false,
        stepped: stepped,
        scales: {
          y: yAxisOption,
          x: nspAxisOption
        },
        cubicInterpolationMode: (smooth) ? "monotone" : "default",
        plugins: {
          legend: {
            display: config.showLegend,
            labels: {
              color: config.axisTitleColor,
            }
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
