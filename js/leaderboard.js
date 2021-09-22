class LeaderBoardID {
  constructor(teamID, userID, carID) {
    this.teamID = teamID;
    this.userID = userID;
    this.carID = carID;
  }

  getUniqueID() {
    if (this.teamID !== 0) {
      return "team_" + this.teamID;
    } else {
      return "user_" + this.userID + "_car_" + this.carID;
    }
  }
}

class CarTelemetry {
  constructor(nsp, posX, posZ, carSpeed, gear, rpm) {
    this.nsp = nsp;
    this.posX = posX;
    this.posZ = posZ;
    this.carSpeed = carSpeed;
    this.gear = gear;
    this.rpm = rpm;
  }
}

class SessionFeedEntry {
  constructor(type, time, detail) {
    this.type = type;
    this.time = time;
    this.detail = detail;
  }
}

class LapAndSectorStatus {
  constructor(currentLapStatus, s1Status, s2Status, s3Status) {
    this.currentLapStatus = currentLapStatus;
    this.s1Status = s1Status;
    this.s2Status = s2Status;
    this.s3Status = s3Status;
  }

  getStatusString(status) {
    if (status == 0) return "yellow-sec";
    if (status == 1) return "green-sec";
    if (status == 2) return "purple-sec";
    return "yellow-sec";
  }

  getLapStatus() {
    if (this.currentLapStatus == 3) return "red-sec";
    return this.getStatusString(this.currentLapStatus);
  }

  getS1Status() {
    return this.getStatusString(this.s1Status);
  }

  getS2Status() {
    return this.getStatusString(this.s2Status);
  }

  getS3Status() {
    return this.getStatusString(this.s3Status);
  }
}

class LeaderBoardEntry {
  static CONNECTION_STATUS = { CONNECTED: 0, LOADING: 1, DISCONNECTED: 2 };
  static TRACK_STATUS = {
    ON_TRACK: 0,
    OFF_TRACK: 1,
    PIT_ENTRY: 2,
    PIT_LANE: 3,
    PIT_EXIT: 4
  }

  constructor(id, connectionStatus, trackStatus, isFinished, laps, validLaps, telemetry, bestLap, currentLap, status, gap, interval, posChange) {
    this.id = id;
    this.connectionStatus = connectionStatus;
    this.trackStatus = trackStatus;

    this.isFinished = isFinished;

    this.laps = laps;
    this.validLaps = validLaps;

    this.telemetry = telemetry;

    this.bestLap = bestLap;
    this.currentLap = currentLap;
    this.status = status;

    if (gap != -1) {
      this.gap = gap;
    }
    if (interval != -1) {
      this.interval = interval;
    }
    this.posChange = posChange;
  }

  getDriverStatusClass() {
    if (this.isFinished) {
      return "status-chequered";
    }
    switch (this.connectionStatus) {
      case LeaderBoardEntry.CONNECTION_STATUS.CONNECTED:
        return "status-green";
      case LeaderBoardEntry.CONNECTION_STATUS.LOADING:
        return "status-yellow";
      case LeaderBoardEntry.CONNECTION_STATUS.DISCONNECTED:
        return "status-red";
    }
  }

  getTrackStatusClass() {
    if (this.connectionStatus === LeaderBoardEntry.CONNECTION_STATUS.DISCONNECTED) return "";
    if (this.connectionStatus === LeaderBoardEntry.CONNECTION_STATUS.CONNECTED) {
      if (this.trackStatus === LeaderBoardEntry.TRACK_STATUS.PIT_LANE) {
        return "lb-row-pit";
      } else {
        return "";
      }
    } else {
      if (this.trackStatus === LeaderBoardEntry.TRACK_STATUS.PIT_LANE) {
        return "lb-row-pit";
      } else if (this.trackStatus === LeaderBoardEntry.TRACK_STATUS.OFF_TRACK) {
        return "lb-row-offtrack";
      } else {
        return "";
      }
    }
  }

  getPositionChangeClass() {
    const uniqueID = this.id.getUniqueID();
    if (this.posChange != 0) {
      LeaderBoard.driverPosChangeCounterList[uniqueID] = { "pos_change": posChange, "counter": 10 };
    }
    if (LeaderBoard.driverPosChangeCounterList[uniqueID] !== undefined && LeaderBoard.driverPosChangeCounterList[uniqueID]["counter"] >= 0) {
      var oldPosChange = LeaderBoard.driverPosChangeCounterList[uniqueID]["pos_change"];
      var posChangeClass = "position-" + (oldPosChange > 0 ? "gain" : (oldPosChange < 0 ? "lose" : "")) + "-arrow";
      if (LeaderBoard.driverPosChangeCounterList[uniqueID]["counter"] === 0) {
        LeaderBoard.driverPosChangeCounterList[uniqueID] = undefined;
      } else {
        --LeaderBoard.driverPosChangeCounterList[uniqueID]["counter"];
      }

      return posChangeClass
    }

    return "";
  }

  isQualiPurpleLap(pos) {
    return pos === 0 && this.connectionStatus === LeaderBoardEntry.CONNECTION_STATUS.CONNECTED && this.bestLap.lapTime !== 0;
  }

  toQualiHTML(pos, teamEvent, useTeamNumber) {
      TrackMap.syncDriverMapStatus(pos, this.connectionStatus, this.id, teamEvent, useTeamNumber, this.telemetry, this.trackStatus);

      const team = DataStore.getTeam(this.id.teamID);
      const car = DataStore.getCar(this.id.carID);
      const user = DataStore.getUser(this.id.userID);

      return `<tr class="${this.getTrackStatusClass()}" data-pos="${pos + 1}">
        <td class="lb-status"><span class="status ${this.getDriverStatusClass()}"></span></td>
        <td class="lb-pos">
          <span class="pos">${pos + 1}</span>
          <span class="${this.getPositionChangeClass()}"></span>
        </td>
        <td class="lb-car-class ${DataStore.getCarColorClass(this.id.carID)}" ${teamEvent? `data-team-id="${this.id.teamID}"` : ""} data-car-id="${this.id.carID}">
          ${DataStore.getCarClass(this.id.carID)}
        </td>
        ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.id.teamID}">${team !== undefined? team.team_no : ""}</td>` : ""}
        ${teamEvent? `<td class="lb-team activate-overlay" data-team-id="${this.id.teamID}">${team !== undefined? team.name : ""}</td>` : ""}
        <td class="lb-car" ${teamEvent? `data-team-id="${this.id.teamID}"` : ""} data-car-id="${this.id.carID}">
          <span class="car-name car-badge" style="background: url('/images/ac/car/${this.id.carID}/badge')">
            ${car !== undefined? car.display_name : ""}
          </span>
        </td>
        <td class="lb-driver" data-driver-id="${this.id.userID}">
          ${(user !== undefined) ? user.name : ""}</td>
        <td class="lb-best-lap"><span class="${(this.isQualiPurpleLap(pos) ? "purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</span></td>
        <td class="lb-last-lap"><span class="${LeaderBoard.prevLapStatusList[this.id.userID] || ""}">${Lap.convertMSToDisplayTimeString(LeaderBoard.prevLapList[this.id.userID] || 0)}</span></td>
        <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
        <td class="lb-sec1"><span class="${this.status.getS1Status()}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec1)}</span></td>
        <td class="lb-sec2"><span class="${this.status.getS2Status()}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec2)}</span></td>
        <td class="lb-sec3"><span class="${this.status.getS3Status()}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec3)}</span></td>
        <td class="lb-laps">${this.validLaps === 0? "-" : this.validLaps}</td>
      </tr>`;
  }

  isRacePurpleLap(pos, bestLapIdx) {
    return pos === bestLapIdx && this.bestLap.lapTime !== 0;
  }

  toRaceHTML(pos, teamEvent, useTeamNumber, bestLapIdx) {
    TrackMap.syncDriverMapStatus(pos, this.connectionStatus, this.id, teamEvent, useTeamNumber, this.telemetry, this.trackStatus);

    const team = DataStore.getTeam(this.id.teamID);
    const car = DataStore.getCar(this.id.carID);
    const user = DataStore.getUser(this.id.userID);

    return `<tr class="${this.getTrackStatusClass()}" data-pos="${pos + 1}">
    <td class="lb-status"><span class="status ${this.getDriverStatusClass()}"></span></td>
      <td class="lb-pos">
        <span class="pos">${pos + 1}</span>
        <span class="${this.getPositionChangeClass()}"></span>
      </td>
      <td class="lb-car-class ${DataStore.getCarColorClass(this.id.carID)}" ${teamEvent? `data-team-id="${this.id.teamID}"` : ""} data-car-id="${this.id.carID}">
        ${car !== undefined? car.car_class : ""}
      </td>
      ${useTeamNumber? `<td class="lb-team-no" data-team-id="${this.id.teamID}">${team !== undefined? team.team_no : ""}</td>` : ""}
      ${teamEvent? `<td class="lb-team activate-overlay" data-team-id="${this.id.teamID}">${team !== undefined? team.name : ""}</td>` : ""}
      <td class="lb-car" ${teamEvent? `data-team-id="${this.id.teamID}"` : ""} data-car-id="${this.id.carID}">
        <span class="car-name car-badge" style="background: url('/images/ac/car/${this.id.carID}/badge')">
          ${car !== undefined? car.display_name : ""}
        </span>
      </td>
      <td class="lb-driver" data-driver-id="${this.id.userID}">
        ${user !== undefined ? user.name : ""}</td>
      <td class="lb-laps">${this.laps === 0? "-" : this.laps}</td>
      <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
      <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
      <td class="lb-best-lap"><span class="${(this.isRacePurpleLap(pos, bestLapIdx) ? "purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</span></td>
      <td class="lb-last-lap"><span class="${LeaderBoard.prevLapStatusList[this.id.userID] || ""}">${Lap.convertMSToDisplayTimeString(LeaderBoard.prevLapList[this.id.userID] || 0)}</span></td>
      <td class="lb-sec1"><span class="${this.status.getS1Status()}">${Lap.convertMSToDisplayTimeString(this.currentLap.sec1)}</span></td>
      <td class="lb-sec2"><span class="${this.status.getS2Status()}">${Lap.convertMSToDisplayTimeString(this.currentLap.sec2)}</span></td>
      <td class="lb-sec3"><span class="${this.status.getS3Status()}">${Lap.convertMSToDisplayTimeString(this.currentLap.sec3)}</span></td>
    </tr>`;
  }
}

class LeaderBoard {
  static teamList = {};
  static carList = {};
  static driverList = {};
  static carColorClass = [];
  static driverPosChangeCounterList = {};

  static prevLapList = {}
  static prevLapStatusList = {}

  constructor() {
    this.entries = [];
    this.feedList = [];
    this.startGrip = -1;
    this.currentGrip = -1;
    this.sessionID = 0;
  }

  setGrip(start, current) {
    this.startGrip = start;
    this.currentGrip = current;
  }

  setSessionID(id) {
    this.sessionID = id;
  }

  addEntry(entry) {
    // Current lap will become previous lap once complete
    if (entry.currentLap.lapTime !== 0) {
      LeaderBoard.prevLapList[entry.id.userID] = entry.currentLap.lapTime;
      LeaderBoard.prevLapStatusList[entry.id.userID] = entry.status.getLapStatus();
    }
  }

  addFeed(feed) {
    this.feedList.push(feed);
  }

  getFeedHTML() {
    var feedHtml = "";
    for (var feed of this.feedList) {
      var timeAgoSec = SessionFeed.getFeedTimestamp(feed.time / 1000);
      feedHtml += `<tr>
        <td class="sf-time" data-timestamp-ms="${feed.time / 1000}">${timeAgoSec}</td>
        <td class="sf-car-class ${SessionFeed.getFeedTypeColorClass(feed.type, feed.detail)}">${SessionFeed.getFeedTypeString(feed.type, feed.detail)}</td>
        <td class="sf-detail">${SessionFeed.getFeedMsg(feed.time, feed.type, feed.detail)}</td>
      </tr>`;
    }

    return feedHtml;
  }
}

class QualiLeaderBoard extends LeaderBoard {
  constructor() {
    super();
  }

  addEntry(entry) {
    super.addEntry(entry);
    this.entries.push(entry);
  }
}

class RaceLeaderBoard extends LeaderBoard {
  static prevLapList = {}
  static prevLapStatusList = {}

  constructor() {
    super();
    this.entries = [];
    this.bestLapIdx = -1;
  }

  addEntry(entry) {
    super.addEntry(entry);
    entry.gap = Util.getGapFromBitmap(entry.gap);
    entry.interval = Util.getGapFromBitmap(entry.interval);

    var idx = this.entries.length;
    this.entries.push(entry);
    if (entry.bestLapTime !== 0 && (this.bestLapIdx === -1 ||
        entry.bestLapTime < this.entries[this.bestLapIdx].bestLapTime)) {
      this.bestLapIdx = idx;
    }
  }
}

class LeaderBoardDeserialiser {
  static VERSION = 5;
  constructor( /* ArrayBuffer */ data) {
    this.buffer = data;
    this.data = new DataView(data);
    this.offset = 0;
  }

  readUint32() {
    var d = this.data.getUint32(this.offset, true);
    this.offset += 4;
    return d;
  }

  readInt32() {
    var d = this.data.getInt32(this.offset, true);
    this.offset += 4;
    return d;
  }

  readInt64() {
    var d = (Number)(this.data.getBigInt64(this.offset, true));
    this.offset += 8;
    return d;
  }

  readUint8() {
    var d = this.data.getUint8(this.offset);
    this.offset += 1;
    return d;
  }

  readInt8() {
    var d = this.data.getInt8(this.offset);
    this.offset += 1;
    return d;
  }

  readUInt8() {
    var d = this.data.getUint8(this.offset);
    this.offset += 1;
    return d;
  }

  readUint16() {
    var d = this.data.getUint16(this.offset, true);
    this.offset += 2;
    return d;
  }

  readFloat() {
    var d = this.data.getFloat32(this.offset, true);
    this.offset += 4;
    return d;
  }

  readStr(len) {
    const d = String.fromCharCode.apply(null, new Uint8Array(this.buffer, this.offset, len));
    this.offset += len;
    return d;
  }

  deserialise(leaderboard) {
    const VERSION = this.readUint8();
    if (VERSION != LeaderBoardDeserialiser.VERSION) {
      console.log("Leaderboard version does not match");
      return
    }

    const sessionID = this.readInt64();
    leaderboard.setSessionID(sessionID);

    const raceSession = this.readUint8();

    const startGrip = this.readFloat();
    const currentGrip = this.readFloat();
    leaderboard.setGrip(startGrip, currentGrip);

    const entryCount = this.readUint8();
    for (var i = 0; i < entryCount; ++i) {
      leaderboard.addEntry(this.deserialiseEntry());
    }

    const feedCount = this.readUint8();
    for (var i = 0; i < feedCount; ++i) {
      leaderboard.addFeed(this.deserialiseFeed());
    }
  }

  deserialiseEntry() {
    const teamID = this.readUint32();
    const userID = this.readUint32();
    const carID = this.readUint16();
    const id = new LeaderBoardID(teamID, userID, carID);

    var mask1 = this.readUint8();
    //3 bits for connection status
    //4 bits for track status
    //1 bit for is finished
    const isFinished = (mask1 & 1) === 1;
    mask1 = mask1 >> 1;
    const trackStatus = (mask1 & 15);
    mask1 = mask1 >> 4;
    const connectionStatus = mask1;
    const laps = this.readUint16();
    const validLaps = this.readUint16();

    const nsp = this.readFloat();
    const posX = this.readFloat();
    const posZ = this.readFloat();

    var mask2 = this.readUint16();
    // 10 bits for speed
    // 6 bits for gear
    const gear = (mask2 & 63);
    mask2 = mask2 >> 6;
    const speed = mask2;

    const rpm = this.readUint16();
    const telemetry = new CarTelemetry(nsp, posX, posZ, speed, gear, rpm);

    const bestLap = new Lap(0, this.readUint32(), this.readUint32(), this.readUint32());
    const currentLap = new Lap(0, this.readUint32(), this.readUint32(), this.readUint32());

    var sectorMask = this.readUInt8();
    const currentLapStatus = sectorMask & 3;
    sectorMask = sectorMask >> 2;
    const s3Status = sectorMask & 3;
    sectorMask = sectorMask >> 2;
    const s2Status = sectorMask & 3;
    sectorMask = sectorMask >> 2;
    const s1Status = sectorMask & 3;
    const status = new LapAndSectorStatus(currentLapStatus, s1Status, s2Status, s3Status);

    const gap = this.readInt32();
    const interval = this.readInt32();
    const posChange = this.readInt8();

    return new LeaderBoardEntry(id, connectionStatus, trackStatus, isFinished, laps, validLaps,
      telemetry, bestLap, currentLap, status, gap, interval, posChange);
  }

  deserialiseFeed() {
    const feedType = this.readUint8();
    const timestamp = this.readInt64();
    const size = this.readUint16();
    const detail = this.readStr(size);
    return new SessionFeedEntry(feedType, timestamp, JSON.parse(detail));
  }
}

class LeaderBoardFactory {
  static create(/* ArrayBuffer */ buffer, race) {
    const leaderboard = race ? new RaceLeaderBoard() : new QualiLeaderBoard();
    const deserialiser = new LeaderBoardDeserialiser(buffer);
    deserialiser.deserialise(leaderboard);
    return leaderboard;
  }
}
