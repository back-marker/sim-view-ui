class Lap {
  static MILISECOND_SEPARATOR = ".";
  static SECOND_SEPARATOR = ":";
  static GAP_SYMBOL = "+";
  static NA_SYMBOL = "-";
  static NEGATIVE_GAP_SYMBOL = "-";

  // time, sec1, sec2 are inetger representing time in milli second
  constructor(lapTime, sec1, sec2, sec3) {
    this.lapTime = lapTime;
    this.sec1 = sec1;
    this.sec2 = sec2;
    this.sec3 = sec3;
  }

  /**
   * For :
   * 1. 0 return empty string
   * 2. time greater than 60 min returns empty string
   * 3. return in MM:SS:SSS
   * @param {int} time
   */
  static convertMSToTimeString(time) {
    // Laptime in ms
    if (time === 0) return "";
    var min = "";
    var sec = "";
    var ms = "";

    ms = time % 1000;
    time = Math.floor(time / 1000);
    sec = time % 60;
    time = Math.floor(time / 60);
    min = time;

    if (ms < 10) {
      ms = "00" + ms;
    } else if (ms < 100) {
      ms = "0" + ms;
    }

    if (min == 0) {
      return sec + Lap.MILISECOND_SEPARATOR + ms;
    }

    if (sec < 10) {
      sec = "0" + sec;
    }

    return min + Lap.SECOND_SEPARATOR + sec + Lap.MILISECOND_SEPARATOR + ms;
  }

  static convertMSToDisplayTimeString(time) {
    var timeStr = Lap.convertMSToTimeString(time);
    return timeStr === "" ? Lap.NA_SYMBOL : timeStr;
  }

  static convertToGapDisplayString(gap) {
    if (gap === undefined) return Lap.NA_SYMBOL;
    var gapString;
    if (typeof gap === "string") {
      gapString = gap;
    } else if (gap === 0) {
      gapString = "0.000";
    } else if (gap < 0) {
      return Lap.NEGATIVE_GAP_SYMBOL + Lap.convertMSToTimeString(-gap);
    } else {
      gapString = Lap.convertMSToTimeString(gap);
    }

    return Lap.GAP_SYMBOL + gapString;
  }

  static convertToGapPercentDisplayString(gap) {
    if (gap === undefined) return Lap.NA_SYMBOL;
    var gapString;
    if (typeof gap === "string") {
      gapString = gap;
    } else if (gap === 0) {
      gapString = "0.00";
    } else if (gap < 0) {
      return Lap.NEGATIVE_GAP_SYMBOL + (-gap * 100).toFixed(2);
    } else {
      gapString = (gap * 100).toFixed(2);
    }

    return Lap.GAP_SYMBOL + gapString + "%";
  }
}
