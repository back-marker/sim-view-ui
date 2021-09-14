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

class LeaderBoardEntry {
  static CONNECTION_STATUS = { CONNECTED: 0, LOADING: 1, DISCONNECTED: 2 };
  static TRACK_STATUS = {
    ON_TRACK: 0,
    OFF_TRACK: 1,
    PIT_ENTRY: 2,
    PIT_LANE: 3,
    PIT_EXIT: 4
  }

  constructor(id, connectionStatus, trackStatus, isFinished, laps, validLaps, telemetry, bestLap, currentLap, gap, interval, posChange) {
    this.id = id;
    this.connectionStatus = connectionStatus;
    this.trackStatus = trackStatus;

    this.isFinished = isFinished;

    this.laps = laps;
    this.validLaps = validLaps;

    this.telemetry = telemetry;

    this.bestLap = bestLap;
    this.currentLap = currentLap;

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

  toQualiHTML(pos, teamEvent, useTeamNumber, bestSec1Idx, bestSec2Idx, bestSec3Idx) {
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
        <td class="lb-best-lap${(this.isQualiPurpleLap(pos) ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</td>
        <td class="lb-gap">${Lap.convertToGapDisplayString(this.gap)}</td>
        <td class="lb-interval">${Lap.convertToGapDisplayString(this.interval)}</td>
        <td class="lb-sec1${(bestSec1Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec1)}</td>
        <td class="lb-sec2${(bestSec2Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec2)}</td>
        <td class="lb-sec3${(bestSec3Idx === pos ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.sec3)}</td>
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
      <td class="lb-best-lap${(this.isRacePurpleLap(pos, bestLapIdx) ? " purple-sec" : "")}">${Lap.convertMSToDisplayTimeString(this.bestLap.lapTime)}</td>
      <td class="lb-last-lap">${Lap.convertMSToDisplayTimeString(RaceLeaderBoard.prevLapList[this.id.userID] || 0)}</td>
      <td class="lb-sec1">${Lap.convertMSToDisplayTimeString(this.currentLap.sec1)}</td>
      <td class="lb-sec2">${Lap.convertMSToDisplayTimeString(this.currentLap.sec2)}</td>
      <td class="lb-sec3">${Lap.convertMSToDisplayTimeString(this.currentLap.sec3)}</td>
    </tr>`;
  }
}

class LeaderBoard {
  static teamList = {};
  static carList = {};
  static driverList = {};
  static carColorClass = [];
  static driverPosChangeCounterList = {};

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

  addEntry(entry) { /* empty */ }

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
    this.bestSec1Idx = -1;
    this.bestSec2Idx = -1;
    this.bestSec3Idx = -1;
  }

  addEntry(entry) {
    var idx = this.entries.length;
    this.entries.push(entry);
    if (entry.connectionStatus === LeaderBoardEntry.CONNECTION_STATUS.CONNECTED) {
      if (entry.bestLap.sec1 !== 0 && (this.bestSec1Idx == -1 ||
          entry.bestLap.sec1 < this.entries[this.bestSec1Idx].bestLap.sec1)) {
        this.bestSec1Idx = idx;
      }
      if (entry.bestLap.sec2 !== 0 && (this.bestSec2Idx == -1 ||
          entry.bestLap.sec2 < this.entries[this.bestSec2Idx].bestLap.sec2)) {
        this.bestSec2Idx = idx;
      }
      if (entry.bestLap.sec3 !== 0 && (this.bestSec3Idx == -1 ||
          entry.bestLap.sec3 < this.entries[this.bestSec3Idx].bestLap.sec3)) {
        this.bestSec3Idx = idx;
      }
    }
  }
}

class RaceLeaderBoard extends LeaderBoard {
  static prevLapList = {}

  constructor() {
    super();
    this.entries = [];
    this.bestLapIdx = -1;
  }

  addEntry(entry) {
    entry.gap = Util.getGapFromBitmap(entry.gap);
    entry.interval = Util.getGapFromBitmap(entry.interval);
    // Current lap will become previsou lap once complete
    if (entry.currentLap.lapTime !== 0) {
      RaceLeaderBoard.prevLapList[entry.id.userID] = entry.currentLap.lapTime;
    }

    var idx = this.entries.length;
    this.entries.push(entry);
    if (entry.bestLapTime !== 0 && (this.bestLapIdx === -1 ||
        entry.bestLapTime < this.entries[this.bestLapIdx].bestLapTime)) {
      this.bestLapIdx = idx;
    }
  }
}

class LeaderBoardDeserialiser {
  static VERSION = 3;
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
    const gap = this.readInt32();
    const interval = this.readInt32();
    const posChange = this.readInt8();

    return new LeaderBoardEntry(id, connectionStatus, trackStatus, isFinished, laps, validLaps,
      telemetry, bestLap, currentLap, gap, interval, posChange);
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
