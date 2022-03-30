class ResultPage extends Page {
  static graphConfig = {
    "axisTitleColor": "#bbb",
    "axisTitleFontSize": 14,
    "gridLineColor": "#424242",
    "crossHairColor": "#FEC606",
    "zoomboxBackgroundColor": "rgba(66,133,244,0.2)",
    "zoomboxBorderColor": "#48F",
    "showLegend": true,
    "yAxisBeginAtZero": false,
    "chartTitleColor": "#6db4df",
    "chartTitleFontSize": 16,
    "lineColors": ["#5381d9", "#cccaca"]
  };

  static cb_updateEventInfo(data) {
    if (data["status"] == "success") {
      const event = data.event;
      DataStore.setEvent(event);
      $("#event-detail").attr("data-event-id", event.event_id).attr("data-team-event", event.team_event).
      attr("data-use-number", event.use_number).attr("data-track", event.track_config_id);
      $("#event-detail .title").text(event.name);
      $("#event-detail .server").text(event.server_name);
      $("#track-detail img").attr("src", `/images/ac/track/${event.track_config_id}/preview`);
      $("title").text("SimView | Result | " + event.name);

      getRequest("/api/ac/track/" + event.track_config_id, ResultPage.cb_updateTrackInfo);
      getRequest("/api/ac/event/" + event.event_id + "/sessions", ResultPage.cb_updateAllSessions);
    }
  }

  static cb_updateTrackInfo(data) {
    if (data["status"] == "success") {
      const track = data.track;
      $("#track-detail .name").text(track.display_name);
      $("#track-detail img").attr("alt", track.display_name);
      $("#track-detail .city").text(track.city);
      $("#track-detail .country").text(track.country);
      $("#track-detail .length").text((track.length / 1000).toFixed(2) + " KM");
    }
  }

  static cb_updateSessionDetail(data) {
    if (data["status"] === "success") {
      const session = data.session;
      $("#message").addClass("hidden-opacity");
      if (session.is_finished === 0) {
        $("#message").html("The results data may not be final as session is still running <a href='/ac/event/" + session.event_id + "/live'>[Go Live]</a>").removeClass("hidden-opacity");
      }
      $("#session-summary .weather .value").text(Util.getWeatherDisplayName(session.weather));
      $("#session-summary .air-temp .temp-val").text(session.air_temp);
      $("#session-summary .road-temp .temp-val").text(session.road_temp);
      if (session.start_grip != -1) {
        $("#session-summary .start-grip .value").text((session.start_grip * 100).toFixed(1) + "%");
      }
      if (session.current_grip != -1) {
        $("#session-summary .final-grip .value").text((session.current_grip * 100).toFixed(1) + "%");
      }
      $("#session-summary .start .value").text((new Date(parseInt(session.start_time) / 1000)).toLocaleString());
      var finishTime = session.finish_time;
      if (session.is_finished === 0) {
        finishTime = 0;
      }
      var finishTimeStr = "-";
      if (finishTime !== 0) {
        finishTimeStr = (new Date(finishTime / 1000)).toLocaleString();
      }
      $("#session-summary .finish .value").text(finishTimeStr);
      if (session.laps === 0) {
        $("#session-summary .duration .value").text(Util.getTimeDiffString(session.duration_min * 60));
      } else {
        $("#session-summary .duration .value").text(session.laps + " L");
      }
    }
  }

  static renderLapVariationGraph(lapTimes, indentityNames, teamEvent) {
    const labels = Array.from({ length: lapTimes.length }).map(function(v, idx) { return indentityNames[idx]; });

    const boxColorIdx = 15;
    const lapVariationData = {
      labels: labels,
      datasets: [{
        label: 'Lap Time Variation',
        backgroundColor: Colors.getWithTransparent(boxColorIdx, .3),
        borderColor: Colors.get(boxColorIdx),
        borderWidth: 2,
        outlierBackgroundColor: Colors.get(2),
        outlierBorderColor: Colors.get(2),
        outlierRadius: 4,
        meanRadius: 4,
        itemRadius: 0,
        padding: 10,
        medianColor: Colors.get(17),
        meanBackgroundColor: Colors.get(13),
        meanBorderColor: Colors.get(13),
        itemBackgroundColor: Colors.get(17),
        lowerBackgroundColor: Colors.getWithTransparent(boxColorIdx, .5),
        data: lapTimes.map(function(v, idx) { return v.lap_times; }),
      }]
    };

    const lapTimeVariationTooltipCallback = {
      label: function(d) {
        const data = d.parsed;
        var tooltipData = [
          { v: data.whiskerMax, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.whiskerMax))} : Whisker Max` },
          { v: data.q3, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.q3))} : Q3` },
          { v: data.mean, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.mean))} : Average` },
          { v: data.median, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.median))} : Median` },
          { v: data.q1, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.q1))} : Q1` },
          { v: data.whiskerMin, sv: `${Lap.convertMSToDisplayTimeString(Math.floor(data.whiskerMin))} : Whisker Min` }
        ];
        tooltipData = tooltipData.sort(function(l, r) {
          // Descending order
          if (l.v < r.v) return 1;
          if (l.v > r.v) return -1;
          return 0;
        }).map(function(x) { return x.sv; });
        tooltipData.push(((data.outliers.length === 0) ? "No" : data.outliers.length) + " outlier" + ((data.outliers.length === 1) ? "" : "s"));
        return tooltipData;
      }
    };

    const title = "Laptime Variation For Each " + (teamEvent ? "Team" : "Driver");
    ResultPage.createChart("canvas-consistency-graph", "boxplot", lapVariationData, false, "Laptime",
      ResultPage.graphConfig, false, title, lapTimeVariationTooltipCallback);
  }

  static renderPositionGraph(lapTimes, indentityNames, teamEvent) {
    const position = ResultPage.computePositionPerLap(lapTimes);
    const skipped = (ctx, value) => ctx.p0.skip || ctx.p1.skip ? value : undefined;

    const driverLaps = lapTimes.map(function(v) { return v.lap_times.length; });
    const totalLapCount = Math.max(...driverLaps);
    const positionData = {
      labels: Array.from({ length: totalLapCount }).map(function(v, idx) { return `L${idx + 1}`; }),
      datasets: position.map(function(value, idx) {
        return {
          label: indentityNames[idx],
          data: value,
          fill: false,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          pointStyle: 'circle',
          pointRadius: 4,
          segment: {
            borderDash: ctx => skipped(ctx, [6, 6]),
          },
          spanGaps: true,
          pointBorderColor: Colors.get(idx),
          pointBackgroundColor: Colors.get(idx),
          borderColor: Colors.getWithTransparent(idx, 0.6),
          backgroundColor: Colors.getWithTransparent(idx, 0.6)
        };
      })
    };

    const positionTooltipCallback = {
      label: function(d) {
        return `${d.dataset.label}: P${d.raw.y + 1}`;
      }
    };

    const tooltipSort = function(l, r) {
      if (l.raw.y === r.raw.y) return 0;
      if (l.raw.y < r.raw.y) return -1;
      return 1;
    }

    const title = "Position At The End Of Each Lap For Each " + (teamEvent ? "Team" : "Driver");
    ResultPage.createChart("canvas-position-graph", "line", positionData, false, "Position",
      ResultPage.graphConfig, true, title, positionTooltipCallback, tooltipSort);
  }

  static computePositionPerLap(driverLapTimeData) {
    const driverCount = driverLapTimeData.length;
    const driverLaps = driverLapTimeData.map(function(v) { return v.lap_times.length; });
    const totalLapCount = Math.max(...driverLaps);

    // driver -> [position for each lap]
    var positionMap = [];
    // driver -> totalTime
    var totalTime = {};

    var winnerDriverIdx = -1;
    var positionProcessedIdx = driverCount - 1;
    for (var lapIdx = 0; lapIdx < totalLapCount; ++lapIdx) {
      var cumulatedLapTime = [];
      for (var driverIdx = 0; driverIdx < driverCount; ++driverIdx) {
        const lapTime = driverLapTimeData[driverIdx].lap_times[lapIdx];
        if (lapTime !== undefined) {
          cumulatedLapTime.push({ driver: driverIdx, t: (totalTime[driverIdx] || 0) + lapTime });
        }
      }

      cumulatedLapTime = cumulatedLapTime.sort(function(l, r) {
        if (l.t === r.t) return 0;
        if (l.t < r.t) return -1;
        return 1;
      });

      for (var positionIdx = 0; positionIdx < cumulatedLapTime.length; ++positionIdx) {
        const driverIdx = cumulatedLapTime[positionIdx].driver;
        if (positionMap[driverIdx] === undefined) {
          positionMap[driverIdx] = [];
        }
        if (lapIdx + 1 === totalLapCount && positionIdx === 0) {
          winnerDriverIdx = driverIdx;
        }

        positionMap[driverIdx].push({ x: `L${lapIdx + 1}`, y: positionIdx });
        totalTime[driverIdx] = cumulatedLapTime[positionIdx].t;
      }

      var lappedDriverLastPosition = {};
      for (var driverIdx = 0; driverIdx < driverCount; ++driverIdx) {
        if (driverLapTimeData[driverIdx].lap_times.length === lapIdx) {
          const lastPos = positionMap[driverIdx][positionMap[driverIdx].length - 1].y;
          lappedDriverLastPosition[lastPos] = driverIdx;
        }
      }

      for (var positionMapIdx = driverCount - 1; positionMapIdx >= 0; --positionMapIdx) {
        if (lappedDriverLastPosition[positionMapIdx] !== undefined) {
          positionMap[lappedDriverLastPosition[positionMapIdx]].push({ x: `L${lapIdx + 1}`, y: positionProcessedIdx });
          --positionProcessedIdx;
        }
      }
    }

    for (var driverIdx = 0; driverIdx < driverCount; ++driverIdx) {
      if (driverLaps[driverIdx] < totalLapCount) {
        // Lapped
        const lapPos = positionMap[driverIdx][positionMap[driverIdx].length - 1].y;
        positionMap[driverIdx].pop();
        positionMap[driverIdx].push(undefined);
        positionMap[driverIdx].push({ x: `L${totalLapCount}`, y: lapPos });
      }
    }

    return positionMap;
  }

  static renderLapTimeGraph(lapTimes, indentityNames, teamEvent) {
    const laps = Math.max(...lapTimes.map(function(v) { return v.lap_times.length; }));
    const lapTimeData = {
      labels: Array.from({ length: laps }).map(function(v, idx) { return `L${idx + 1}`; }),
      datasets: lapTimes.map(function(v, idx) {
        return {
          label: indentityNames[idx],
          data: v.lap_times,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          fill: false,
          pointBorderColor: Colors.get(idx),
          pointBackgroundColor: Colors.get(idx),
          borderColor: Colors.getWithTransparent(idx, 0.6),
          backgroundColor: Colors.getWithTransparent(idx, 0.6)
        };
      })
    };

    const lapTimeTooltipCallback = {
      label: function(d) {
        return `${d.dataset.label}: ${Lap.convertMSToDisplayTimeString(d.raw)}`;
      }
    };

    const tooltipSort = function(l, r) {
      if (l.raw === r.raw) return 0;
      if (l.raw < r.raw) return 1;
      return -1;
    }

    const title = "Laptime Per Lap For Each " + (teamEvent ? "Team" : "Driver");
    ResultPage.createChart("canvas-laptime-graph", "line", lapTimeData, false, "LapTime",
      ResultPage.graphConfig, false, title, lapTimeTooltipCallback, tooltipSort);
  }

  static renderAvgLapTimeGraph(lapTimes, indentityNames, teamEvent) {
    const laps = Math.max(...lapTimes.map(function(v) { return v.lap_times.length; }));

    function computeAvg(data) {
      var result = [];
      var cumSum = 0;
      for (var idx = 1; idx < data.length; ++idx) {
        cumSum += data[idx];
        result.push({ x: `L${idx + 1}`, y: Math.floor(cumSum / idx) });
      }

      return result;
    }

    const lapTimeData = {
      labels: Array.from({ length: laps }).map(function(v, idx) { return `L${idx + 1}`; }),
      datasets: lapTimes.map(function(v, idx) {
        return {
          label: indentityNames[idx],
          data: computeAvg(v.lap_times),
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          fill: false,
          pointBorderColor: Colors.get(idx),
          pointBackgroundColor: Colors.get(idx),
          borderColor: Colors.getWithTransparent(idx, 0.6),
          backgroundColor: Colors.getWithTransparent(idx, 0.6)
        };
      })
    };

    const lapTimeTooltipCallback = {
      label: function(d) {
        return `${d.dataset.label}: ${Lap.convertMSToDisplayTimeString(d.raw.y)}`;
      }
    };

    const tooltipSort = function(l, r) {
      if (l.raw.y === r.raw.y) return 0;
      if (l.raw.y < r.raw.y) return 1;
      return -1;
    }

    const title = "Pace Per Lap For Each " + (teamEvent ? "Team" : "Driver") + " - First Lap Ignored";
    ResultPage.createChart("canvas-avglaptime-graph", "line", lapTimeData, false, "LapTime",
      ResultPage.graphConfig, false, title, lapTimeTooltipCallback, tooltipSort);
  }

  static createChart(canvasID, chartType, dataset, stepped, yAxisTitle, config, yAxisReverse, chartTitle, tooltipCallback, tooltipSortCallback) {
    const xAxisOption = {
      title: {
        display: chartType !== "boxplot",
        text: 'Lap Number',
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
      reverse: yAxisReverse,
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

    if (yAxisTitle.toLowerCase() == "position") {
      yAxisOption.ticks.stepSize = 1;
      yAxisOption.ticks.callback = function(value, index, ticks) {
        return `P${value + 1}`;
      }
    } else if (yAxisTitle.toLowerCase() == "laptime") {
      yAxisOption.ticks.callback = function(value, index, ticks) {
        return Lap.convertMSToDisplayTimeString(value);
      }
    }

    const canvasCtx = document.getElementById(canvasID).getContext('2d');
    const chart = new Chart(canvasCtx, {
      type: chartType,
      data: dataset,
      resposive: false,
      options: {
        maintainAspectRatio: false,
        stepped: stepped,
        scales: {
          y: yAxisOption,
          x: xAxisOption
        },
        plugins: {
          title: {
            display: true,
            text: chartTitle,
            font: {
              size: config.chartTitleFontSize
            },
            color: config.chartTitleColor
          },
          legend: {
            display: chartType !== "boxplot" && config.showLegend,
            labels: {
              color: config.axisTitleColor,
            }
          },
          tooltip: {
            enabled: true,
            animation: false,
            mode: 'x',
            intersect: false,
            callbacks: tooltipCallback,
            itemSort: tooltipSortCallback
          },
          crosshair: false,
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
              mode: 'x'
            },
            zoom: {
              mode: 'x',
              drag: {
                borderWidth: 2,
                backgroundColor: config.zoomboxBackgroundColor,
                borderColor: config.zoomboxBorderColor,
                enabled: true
              },
              onZoomComplete: function(chart) {
                $("#" + canvasID).parent().children(".reset-zoom").removeClass("hidden");
              }
            }
          }
        }
      }
    });

    $("#" + canvasID).parent().children(".reset-zoom").click(function() {
      chart.resetZoom();
      $(this).addClass("hidden");
    });
    return chart;
  }

  static renderGraphs(lapTimeData) {
    var teamEvent = Util.isCurrentTeamEvent();
    var labels = [];
    if (teamEvent) {
      labels = lapTimeData.map(function(v, idx) { return `[P${idx + 1}] ` + DataStore.getTeam(v.team_id).name; });
    } else {
      labels = lapTimeData.map(function(v, idx) { return `[P${idx + 1}] ` + DataStore.getUser(v.user_id).name; });
    }

    var graphHtml = `<div id="consistency-graph" class="result-graphs">
    <canvas id="canvas-consistency-graph" width="1300" height="620"></canvas>
    <button class="reset-zoom hidden">Reset Zoom</button>
  </div>
  <div id="laptime-graph" class="result-graphs">
    <canvas id="canvas-laptime-graph" width="1300" height="620"></canvas>
    <button class="reset-zoom hidden">Reset Zoom</button>
  </div>
  <div id="avglaptime-graph" class="result-graphs">
    <canvas id="canvas-avglaptime-graph" width="1300" height="620"></canvas>
    <button class="reset-zoom hidden">Reset Zoom</button>
  </div>
  <div id="position-graph" class="result-graphs">
    <canvas id="canvas-position-graph" width="1300" height="620"></canvas>
    <button class="reset-zoom hidden">Reset Zoom</button>
  </div>`;

    $("#graphs-tab").html(graphHtml);
    ResultPage.renderLapVariationGraph(lapTimeData, labels, teamEvent);
    ResultPage.renderLapTimeGraph(lapTimeData, labels, teamEvent);
    ResultPage.renderAvgLapTimeGraph(lapTimeData, labels, teamEvent);
    ResultPage.renderPositionGraph(lapTimeData, labels, teamEvent);
  }

  static cb_updateConsistencyTab(data) {
    if (data["status"] === "success") {
      const consistency = data.laps;

      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      var pendingTeamList = new Set();

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      var sessionType = $("select[name='select-session'] option:selected").text().toLowerCase().split(' ')[0];
      var consistencyHeader = "";
      if (sessionType === "race") {
        consistencyHeader = ResultConsistencyTabEntry.getHeaderHtml(teamEvent, useTeamNumber);
      } else {
        return;
      }

      var consistencyHtml = '';
      for (var idx = 0; idx < consistency.length; ++idx) {
        const singleConsistency = consistency[idx];
        consistencyHtml += ResultConsistencyTabEntry.fromJSON(singleConsistency).toHTML(idx + 1, teamEvent, useTeamNumber);

        if (teamEvent && !DataStore.containsTeam(singleConsistency.team_id)) {
          pendingTeamList.add(singleConsistency.team_id);
        }
        if (!DataStore.containsCar(singleConsistency.car_id)) {
          pendingCarList.add(singleConsistency.car_id);
        }
        if (!teamEvent && !DataStore.containsUser(singleConsistency.user_id)) {
          pendingDriverList.add(singleConsistency.user_id);
        }
      }

      $("#consistency-tab").html(`<table>
      <thead id="consistency-header">
      ${consistencyHeader}
      </thead>
      <tbody id="consistency-body">
      ${consistencyHtml}
      </tbody>
    </table>`);

      Page.updateTeamAndDriversAndCarsNameWithCallback(pendingTeamList, pendingCarList, pendingDriverList, function() {
        ResultPage.renderGraphs(consistency);
      });
    }
  }

  static cb_updateStandingsTab(data) {
    if (data["status"] === "success") {
      const standings = data.standings;
      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      var pendingTeamList = new Set();

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      var sessionType = $("select[name='select-session'] option:selected").text().toLowerCase().split(' ')[0];
      if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() ||
        sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
        $("#standings-header").html(QualiResultStandingTabEntry.getHeaderHtml(teamEvent, useTeamNumber));
      } else {
        $("#standings-header").html(RaceResultStandingTabEntry.getHeaderHtml(teamEvent, useTeamNumber));
      }

      var standingsHtml = "";
      var stintsHtml = "";
      for (var idx = 0; idx < standings.length; ++idx) {
        const standing = standings[idx];
        if (sessionType === Page.SESSION_TYPE.PRACTICE.toLowerCase() ||
          sessionType === Page.SESSION_TYPE.QUALIFYING.toLowerCase()) {
          standingsHtml += QualiResultStandingTabEntry.fromJSON(standing).toHTML(idx + 1, teamEvent, useTeamNumber);
        } else {
          standingsHtml += RaceResultStandingTabEntry.fromJSON(standing).toHTML(idx + 1, teamEvent, useTeamNumber);
        }

        var stint = ResultStintTabEntry.fromJSON(standing);
        stintsHtml += stint.toHTML(idx, teamEvent, useTeamNumber);

        if (teamEvent && !DataStore.containsTeam(standing.team_id)) {
          pendingTeamList.add(standing.team_id);
        }
        if (!DataStore.containsCar(standing.car_id)) {
          pendingCarList.add(standing.car_id);
        }
        if (!teamEvent && !DataStore.containsUser(standing.user_id)) {
          pendingDriverList.add(standing.user_id);
        }
      }

      $("#standings-body").attr("data-session-type", sessionType).html(standingsHtml);
      if (sessionType !== "race") {
        $("#standings-body").click(Page.openAnalysisPageOnClick);
      }
      $("#stints-tab").html(stintsHtml);

      Page.updateTeamAndDriversAndCarsName(pendingTeamList, pendingCarList, pendingDriverList);
    }
  }

  static cb_updateSectorsTab(data) {
    if (data["status"] === "success") {
      const sectors = data.sectors;
      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      var pendingTeamList = new Set();

      var teamEvent = Util.isCurrentTeamEvent();
      var useTeamNumber = Util.isCurrentTeamEventUseNumber();

      for (var sectorIdx = 1; sectorIdx <= 3; ++sectorIdx) {
        $("#sec-header-" + sectorIdx).html(ResultPage.getSectorsResultHeaderHtml(teamEvent, useTeamNumber, sectorIdx));
        var sectorList = sectors["sector" + sectorIdx];
        var sectorHtml = "";
        for (var idx = 0; idx < sectorList.length; ++idx) {
          var entry = ResultSectorTabEntry.fromJSON(sectorList[idx]);
          sectorHtml += entry.toHTML(idx + 1, teamEvent, useTeamNumber);

          if (teamEvent && !DataStore.containsTeam(entry.teamId)) {
            pendingTeamList.add(entry.teamId);
          }
          if (!DataStore.containsCar(entry.carId)) {
            pendingCarList.add(entry.carId);
          }
          if (!teamEvent && !DataStore.containsUser(entry.driverId)) {
            pendingDriverList.add(entry.driverId);
          }
        }

        $("#sec-body-" + sectorIdx).html(sectorHtml);
      }

      Page.updateTeamAndDriversAndCarsName(pendingTeamList, pendingCarList, pendingDriverList);
    }
  }

  static cb_updateSingleStint(data, containerId) {
    if (data["status"] === "success") {
      const stints = data.stints.stints;
      var pendingCarList = new Set();
      var pendingDriverList = new Set();
      var pendingTeamList = new Set();

      var teamEvent = Util.isCurrentTeamEvent();

      var stintsHtml = "";
      for (var idx = 0; idx < stints.length; ++idx) {
        var stint = ResultSingleStintEntry.fromJSON(stints[idx]);
        stintsHtml += stint.toHTML(idx + 1, teamEvent);

        if (teamEvent && !DataStore.containsUser(stint.driverId)) {
          pendingDriverList.add(stint.driverId);
        }
      }

      $(`#${containerId} .stints-container`).html(stintsHtml);
      $(`#${containerId} .bd-stint-laps`).click(Page.openAnalysisPageOnClick);

      Page.updateTeamAndDriversAndCarsName(pendingTeamList, pendingCarList, pendingDriverList);
    }
  }

  static cb_updateAllSessions(data) {
    if (data["status"] == "success") {
      var sessions = data["sessions"];
      var practiceCount = 0;
      var qualificationCount = 0;
      var raceCount = 0;
      for (const session of sessions) {
        if (session.type === Page.SESSION_TYPE.PRACTICE) {
          practiceCount++;
        } else if (session.type === Page.SESSION_TYPE.QUALIFYING) {
          qualificationCount++;
        } else if (session.type === Page.SESSION_TYPE.RACE) {
          raceCount++;
        }
      }

      $("#session-count .practice .value").text(practiceCount);
      $("#session-count .qualification .value").text(qualificationCount);
      $("#session-count .race .value").text(raceCount);

      $("select[name='select-session']").html(ResultPage.getResultSidebarHtml(sessions, practiceCount,
        qualificationCount, raceCount)).change(function() {
        var sessionId = $(this).val();
        $("#result-main").attr("data-session-id", sessionId);
        var sessionType = $("option[value='" + sessionId + "'").attr("data-session-type");
        getRequest("/api/ac/session/" + sessionId, ResultPage.cb_updateSessionDetail);
        getRequest("/api/ac/session/" + sessionId + "/result/sectors", ResultPage.cb_updateSectorsTab);
        getRequest("/api/ac/session/" + sessionId + "/" + sessionType + "/result/standings",
          ResultPage.cb_updateStandingsTab);
        if (sessionType === "race") {
          getRequest("/api/ac/session/" + sessionId + "/race/result/laps",
            ResultPage.cb_updateConsistencyTab);
        } else {
          $("#consistency-tab").html(`<div class="consistency-missing">Consistency data is only available for Race session</div>`);
          $("#graphs-tab").html(`<div class="consistency-missing">Graph data is only available for Race session</div>`);
        }
      });
    }
  }

  static getResultSidebarHtml(sessions, practiceCount, qualificationCount, raceCount) {
    var sidebarHtml = "<option value='0'>Select Session</option>";
    var practiceIdx = practiceCount;
    var qualificationIdx = qualificationCount;
    var raceIdx = raceCount;
    for (const session of sessions) {
      var sessionText;
      if (session.type === Page.SESSION_TYPE.PRACTICE) {
        sessionText = Page.SESSION_TYPE.PRACTICE;
        if (practiceCount > 1) {
          sessionText += " " + practiceIdx;
          practiceIdx--;
        }
      } else if (session.type === Page.SESSION_TYPE.QUALIFYING) {
        sessionText = Page.SESSION_TYPE.QUALIFYING;
        if (qualificationCount > 1) {
          sessionText += " " + qualificationIdx;
          qualificationIdx--;
        }
      } else if (session.type === Page.SESSION_TYPE.RACE) {
        sessionText = Page.SESSION_TYPE.RACE;
        if (raceCount > 1) {
          sessionText += " " + raceIdx;
          raceIdx--;
        }
      }
      if (session.is_finished === 0) {
        sessionText += " [ LIVE ]";
      }
      sidebarHtml += `<option data-session-finish="${session["is_finished"]}" data-session-type="${session["type"].toLowerCase()}" value="${session["session_id"]}">${sessionText}</option>`;
    }

    return sidebarHtml;
  }

  static getSectorsResultHeaderHtml(teamEvent, useTeamNumber, sector_idx) {
      return `<tr>
          <td class="sec-hr-pos"><a class="tooltip" title="Overall position">Pos</a></td>
          <td class="sec-hr-car-class">Class</td>
          ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team no">No.</a></td>` : ""}
          ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
          <td class="sec-hr-car">Car</td>
          ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
          <td class="sec-hr-sec"><a class="tooltip" title="Best sector ${sector_idx} time">BS ${sector_idx}</a></td>
          <td class="sec-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
          <td class="sec-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        </tr>`;
    }
  }
