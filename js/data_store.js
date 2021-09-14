class DataStore {
  static cars = {}
  static teams = {}
  static users = {}
  static carColorClasses = []
  static event = {}
  static sessionID = 0
  static sessionOver = false

  static addCar(id, car) {
    DataStore.cars[id] = car;
    DataStore.addCarClass(car.car_class);
  }

  static getCar(id) {
    return DataStore.cars[id];
  }

  static containsCar(id) {
    return DataStore.cars[id] !== undefined;
  }

  static getCarClass(id) {
    if (!DataStore.containsCar(id)) return "";
    return DataStore.cars[id].car_class;
  }

  static addTeam(id, team) {
    DataStore.teams[id] = team;
  }

  static containsTeam(id) {
    return DataStore.teams[id] !== undefined;
  }

  static getTeam(id) {
    return DataStore.teams[id];
  }

  static addUser(id, user) {
    DataStore.users[id] = user;
  }

  static containsUser(id) {
    return DataStore.users[id] !== undefined;
  }

  static getUser(id) {
    return DataStore.users[id];
  }

  static addCarClass(carClass) {
    if (DataStore.carColorClasses.indexOf(carClass) === -1) {
      DataStore.carColorClasses.push(carClass);
    }
  }

  static setEvent(event) {
    DataStore.event = event;
  }

  static getEvent() {
    return DataStore.event;
  }

  static setSessionID(id) {
    DataStore.sessionID = id;
  }

  static getSessionID() {
    return DataStore.sessionID;
  }

  static setSessionFinish() {
    DataStore.sessionOver = true;
  }

  static isSessionFinished() {
    return DataStore.sessionOver;
  }

  static isReverseGridEnabled() {
    DataStore.event.reverse_grid_positions !== 0;
  }

  static extraLapEnabled() {
    return DataStore.event.race_extra_laps === 1;
  }

  static getCarColorClass(carID) {
    if (DataStore.cars[carID] === undefined) return "";
    return "car-class-" + DataStore.carColorClasses.indexOf(DataStore.cars[carID].car_class);
  }

  static getUserName(userID) {
    if (DataStore.users[userID] === undefined) return "";
    return DataStore.users[userID].name;
  }
}
