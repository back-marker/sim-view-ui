class DataStore {
  static cars = {}
  static teams = {}
  static users = {}
  static carColorClasses = []

  static addCar(id, car) {
    DataStore.cars[id] = car;
    DataStore.addCarClass(car.car_class);
  }

  static addTeam(id, team) {
    DataStore.teams[id] = team;
  }

  static addUser(id, user) {
    DataStore.users[id] = user;
  }

  static addCarClass(carClass) {
    if (DataStore.carColorClasses.indexOf(carClass) === -1) {
      DataStore.carColorClasses.push(carClass);
    }
  }

  static getCarColorClass(carID) {
    if (DataStore.cars[carID] === undefined) return "";
    return "car-class-" + DataStore.carColorClasses.indexOf(DataStore.cars[carID].class);
  }

  static getUserName(userID) {
    if (DataStore.users[userID] === undefined) return "";
    return DataStore.users[userID].name;
  }
}
