class ResultSectorTabEntry {
  constructor(teamId, driverId, carId, bestSectorTime, gap, interval) {
    this.teamId = teamId;
    this.driverId = driverId;
    this.carId = carId;
    this.bestSectorTime = bestSectorTime;
    this.gap = gap;
    this.interval = interval;
  }

  static fromJSON(data) {
    return new ResultSectorTabEntry(data["team_id"], data["user_id"], data["car_id"], data["best_sector_time"], data["gap"], data["interval"]);
  }

  toHTML(pos, teamEvent, useTeamNumber) {
      return `<tr>
        <td class="sec-pos">${pos}</td>
        <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent === true? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}"}>
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
        </td>
        ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"] : ""}</td>` : ""}
        ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"] : ""}</td>` : ""}
        <td class="lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
            ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
          </span>
        </td>
        ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
          ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
        <td class="sec-sec">${Lap.convertMSToDisplayTimeString(this.bestSectorTime)}</td>
        <td class="sec-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="sec-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      </tr>`;
    }
  }

  class QualiResultStandingTabEntry {
    constructor(teamId, driverId, carId, bestLapTime, validLaps, gap, interval, finishAt) {
      this.teamId = teamId;
      this.driverId = driverId;
      this.carId = carId;
      this.bestLapTime = bestLapTime;
      this.validLaps = validLaps;
      this.gap = gap;
      this.interval = interval;
      if (finishAt === 0) {
        this.finishAt = "N/A";
      } else {
        this.finishAt = (new Date(finishAt / 1000)).toLocaleString();
      }
    }

    static fromJSON(data) {
      return new QualiResultStandingTabEntry(data["team_id"], data["user_id"], data["car_id"], data["best_lap_time"],
        data["valid_laps"], data["gap"], data["interval"], data["lap_finish_time"]);
    }

    toHTML(pos, teamEvent, useTeamNumber) {
      return `<tr>
        <td class="st-pos">${pos}</td>
        <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
        </td>
        ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
        ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
        <td class="lb-car" data-car-id="${this.carId}">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
            ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
          </span>
        </td>
        ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
          ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
        <td class="lb-best-lap">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</td>
        <td class="st-valid-laps">${this.validLaps}</td>
        <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
        <td class="st-finish-at">${this.finishAt}</td>
      </tr>`;
    }

    static getHeaderHtml(teamEvent, useTeamNumber) {
      return `<tr>
        <td class="st-hr-pos"><a class="tooltip" title="Overall position">Pos</a></td>
        <td class="lb-hr-car-class">Class</td>
        ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team No">No.</a></td>` : ""}
        ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
        <td class="lb-hr-car">Car</td>
        ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
        <td class="lb-hr-best-lap"><a class="tooltip" title="Best lap">Best</a></td>
        <td class="st-hr-valid-laps"><a class="tooltip" title="Total valid laps">V. Laps</a></td>
        <td class="lb-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
        <td class="lb-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        <td class="st-hr-finish-at">Finish At</td>
      </tr>`;
    }
  }

  class RaceResultStandingTabEntry {
    constructor(teamId, driverId, carId, laps, validLaps, gap, interval, totalTime) {
      this.teamId = teamId;
      this.driverId = driverId;
      this.carId = carId;
      this.laps = laps;
      this.validLaps = validLaps;
      this.gap = Util.getGapFromBitmap(gap);
      this.interval = Util.getGapFromBitmap(interval);
      this.totalTime = totalTime;
    }

    static fromJSON(data) {
      return new RaceResultStandingTabEntry(data["team_id"], data["user_id"], data["car_id"], data["laps"],
        data["valid_laps"], data["gap"], data["interval"], data["total_time"]);
    }

    toHTML(pos, teamEvent, useTeamNumber) {
      return `<tr>
        <td class="st-pos">${pos}</td>
        <td class="lb-car-class ${Util.getCarColorClass(this.carId)}" data-car-id="${this.carId}">
          ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
        </td>
        ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"]:""}</td>` : ""}
        ${teamEvent? `<td class="lb-team" data-team-id="${this.teamId}">
          ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"]:""}</td>` : ""}
        <td class="lb-car" data-car-id="${this.carId}">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.carId}/badge')">
            ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
          </span>
        </td>
        ${!teamEvent? `<td class="lb-driver" data-driver-id="${this.driverId}">
          ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}</td>` : ""}
        <td class="lb-laps">${this.laps}</td>
        <td class="st-valid-laps">${this.validLaps}</td>
        <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
        <td class="st-total">${Lap.convertMSToDisplayTimeString(this.totalTime)}</td>
      </tr>`;
    }

    static getHeaderHtml(teamEvent, useTeamNumber) {
      return `<tr>
        <td class="st-hr-pos"><a class="tooltip" title="Overall position">Pos</a></td>
        <td class="lb-hr-car-class">Class</td>
        ${useTeamNumber? `<td class="lb-hr-team-no"><a class="tooltip" title="Team No">No.</a></td>` : ""}
        ${teamEvent? `<td class="lb-hr-team">Team</td>` : ""}
        <td class="lb-hr-car">Car</td>
        ${!teamEvent? `<td class="lb-hr-driver">Driver</td>` : ""}
        <td class="lb-hr-laps"><a class="tooltip" title="Total laps">Laps</a></td>
        <td class="st-hr-valid-laps"><a class="tooltip" title="Total valid laps">V. Laps</a></td>
        <td class="lb-hr-gap"><a class="tooltip" title="Gap to leader">Gap</a></td>
        <td class="lb-hr-interval"><a class="tooltip" title="Gap to car ahead">Int.</a></td>
        <td class="st-total"><a class="tooltip" title="Total time of laps">Total</a></td>
      </tr>`;
    }
  }

  class ResultSingleStintLapEntry {
    constructor(lapTime, sec1, sec2, sec3, grip, avgSpeed, maxSpeed, cuts, crashes, carCrashes, finishAt, isBestLap) {
      this.lapTime = lapTime;
      this.sec1 = sec1;
      this.sec2 = sec2;
      this.sec3 = sec3;
      this.grip = (grip <= 0 ? "-" : (grip * 100.0).toFixed(2));
      this.avgSpeed = (avgSpeed === 0 ? "-" : avgSpeed + " Km/Hr");
      this.maxSpeed = maxSpeed + " Km/Hr";
      this.cuts = cuts;
      this.crashes = crashes;
      this.carCrashes = carCrashes;
      if (finishAt === 0) {
        this.finishAt = "N/A";
      } else {
        this.finishAt = (new Date(finishAt / 1000)).toLocaleString();
      }
      this.isBestLap = isBestLap;
    }

    static fromJSON(data) {
      return new ResultSingleStintLapEntry(data["lap_time"], data["sector_1"], data["sector_2"],
        data["sector_3"], data["grip"], data["avg_speed"], data["max_speed"], data["cuts"], data["crashes"], data["car_crashes"],
        data["finish_at"], data["best_lap"]);
    }

    toHTML(pos) {
      var lapType = "";
      if (!this.isValid()) {
        lapType = "invalid-lap"
      } else if (this.isBestLap) {
        lapType = "best-lap";
      }

      return `<tr class="${lapType}">
          <td class="st-no">${pos}</td>
          <td class="st-time">${Lap.convertMSToDisplayTimeString(this.lapTime)}</td>
          <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec1)}</td>
          <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec2)}</td>
          <td class="st-sec">${Lap.convertMSToDisplayTimeString(this.sec3)}</td>
          <td class="st-grip">${this.grip}</td>
          <td class="st-avg">${this.avgSpeed}</td>
          <td class="st-max">${this.maxSpeed}</td>
          <td class="st-cuts">${this.cuts}</td>
          <td class="st-crashes">${this.crashes}</td>
          <td class="st-car-crashes">${this.carCrashes}</td>
          <td class="st-finish-time">${this.finishAt}</td>
        </tr>`;
    }

    isValid() {
      return this.cuts === 0 && this.crashes === 0 && this.carCrashes === 0;
    }

    static getHeaderHtml() {
      return `<tr>
          <td class="st-hr-no">No.</td>
          <td class="st-hr-time">Time</td>
          <td class="st-hr-sec">S1</td>
          <td class="st-hr-sec">S2</td>
          <td class="st-hr-sec">S3</td>
          <td class="st-hr-grip">Grip %</td>
          <td class="st-hr-avg">Avg. Speed</td>
          <td class="st-hr-max">Max. Speed</td>
          <td class="st-hr-cuts">Cuts</td>
          <td class="st-hr-crashes">Crashes</td>
          <td class="st-hr-car-crashes">Car crashes</td>
          <td class="st-hr-finish-time">Finish At</td>
        </tr>`;
    }
  }

  class ResultSingleStintEntry {
    constructor(driverId, totalLaps, validLaps, bestLapTime, avgLapTime, avgLapGap, lapList) {
      this.driverId = driverId;
      this.totalLaps = totalLaps;
      this.validLaps = validLaps;
      this.bestLapTime = bestLapTime;
      this.avgLapTime = avgLapTime;
      this.avgLapGap = avgLapGap;
      this.lapList = lapList;
    }

    static fromJSON(data) {
      var lapList = [];
      for (var idx = 0; idx < data["laps"].length; ++idx) {
        lapList.push(ResultSingleStintLapEntry.fromJSON(data["laps"][idx]));
      }

      return new ResultSingleStintEntry(data["user_id"], data["total_laps"], data["valid_laps"], data["best_lap_time"],
        data["avg_lap_time"], data["avg_lap_gap"], lapList);
    }

    toHTML(pos, teamEvent) {
      var stintHtml = `<div class="driver-stint">
        <div class="stint-summary">
          <ul>
            <li><span class="st-tag">Stint</span><span class="st-value">${pos}</span></li>
            ${teamEvent? `<li><span class="st-tag">Driver</span><span class="st-value lb-driver" data-driver-id="${this.driverId}">
              ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}
            </span></li>`:""}
            <li><span class="st-tag">Valid Laps</span><span class="st-value">${this.validLaps}</span></li>
            <li><span class="st-tag">Laps</span><span class="st-value">${this.totalLaps}</span></li>
            <li><span class="st-tag">Best Lap</span><span class="st-value">${Lap.convertMSToDisplayTimeString(this.bestLapTime)}</span></li>
            <li><span class="st-tag">Avg. Lap</span><span class="st-value">
              ${Lap.convertMSToDisplayTimeString(this.avgLapTime)} ( ${Lap.convertToGapDisplayString(this.avgLapGap)} )
            </span></li>
            <div class="clear-both"></div>
          </ul>
        </div>`;

      stintHtml += `<div class="stint-laps">
        <table>
          <thead class="hr-stint-laps">`;
      stintHtml += ResultSingleStintLapEntry.getHeaderHtml();
      stintHtml += `</thead>
        <tbody class="bd-stint-laps">`;
      var lapsHtml = "";
      for (var idx = 0; idx < this.lapList.length; ++idx) {
        lapsHtml += this.lapList[idx].toHTML(idx + 1);
      }
      stintHtml += lapsHtml;
      stintHtml += `</tbody>
            </table>
          </div>
        </div>`;

      return stintHtml;
    }
  }

  class ResultStintTabEntry {
    constructor(teamId, driverId, carId, stintList) {
      this.teamId = teamId;
      this.driverId = driverId;
      this.carId = carId;
      this.stintList = stintList;
    }

    static fromJSON(data) {
      var stints = [];
      for (var idx = 0; idx < data["stints"].length; ++idx) {
        stints.push(ResultSingleStintEntry.fromJSON(data["stints"][idx]));
      }

      return new ResultStintTabEntry(data["team_id"], data["user_id"], data["car_id"], stints);
    }

    toHTML(teamEvent, useTeamNumber) {
      var allStints = `<div class="driver-stints" ${useTeamNumber? `data-team-id="${this.teamId}"` : `data-driver-id="${this.driverId}"`}>
        <div class="stint-driver">
          ${useTeamNumber? `<div class="left lb-team-no" data-team-id="${this.teamId}">
            ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["team_no"] : ""}
          </div><div class="left">|</div>` : ""}
          ${teamEvent? `<div class="left stint-team-name lb-team ellipsis" data-team-id="${this.teamId}">
            ${LeaderBoard.teamList[this.teamId] !== undefined? LeaderBoard.teamList[this.teamId]["name"] : ""}</div>` :
          `<div class="left stint-driver-name lb-driver ellipsis" data-driver-id="${this.driverId}">
            ${LeaderBoard.driverList[this.driverId] !== undefined? LeaderBoard.driverList[this.driverId] : ""}
          </div>`}
          <div class="left">|</div>
          <div class="left stint-driver-class lb-car-class ${Util.getCarColorClass(this.carId)}" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}">
            ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["class"] : ""}
          </div>
          <div class="left">|</div>
          <div class="left stint-driver-car lb-car" ${teamEvent? `data-team-id="${this.teamId}"` : ""} data-car-id="${this.carId}"}>
            <span class="car-name car-badge ellipsis" style="background: url('/images/ac/car/${this.carId}/badge')">
              ${LeaderBoard.carList[this.carId] !== undefined? LeaderBoard.carList[this.carId]["name"] : ""}
            </span>
          </div>
          <div class="right"><span class="arrow-up"></span></div>
          <div class="clear-both"></div>
        </div>`;
      var stintsHtml = "";
      for (var idx = 0; idx < this.stintList.length; ++idx) {
        stintsHtml += this.stintList[idx].toHTML(idx + 1, teamEvent);
      }
      allStints += `<div class="stints-container">${stintsHtml}</div>` +
        `</div>`;

      return allStints;
    }
  }
