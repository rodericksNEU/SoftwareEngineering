import Venusian from './Venusian';

export default class Ship {
  'name': string;

  'crew': Array<Venusian>;

  'serial': number;

  'daughters' : Array<Ship>;

  SNL : Array<number> = [];

  static sCount = 0;

  static waldoCount = 0;

  static fullFleet : Array<number> = [];



  /**
     * Creates a Ship object with crew of Venusians and fleet of daughter ships.
     *
     * @param crew Array of Venusians that work on ship.
     * @param daughters Array of all ships in the fleet of given ship.
     */
  constructor(crew: Array<Venusian>, daughters: Array<Ship>) {
    this.crew = crew;
    this.daughters = daughters;
    this.serial = Ship.sCount;
    Ship.sCount += 1;
    this.SNL.push(this.serial);

  }

  // Returns the crew of the ship.
  public getCrew() : Array<Venusian> {
    return this.crew;
  }

  // Returns the daughters of the ship.
  public getDaughters() : Array<Ship> {
    return this.daughters;
  }

  // Returns the serial number of the ship.
  public getSerialNumber() : number {
    return this.serial;
  }

  // Returns true if the ship has one or more crew members named Waldo.
  public hasWaldo(): boolean {
    const crew = this.getCrew();
    
    while (crew.length > 0) {
      const c = crew.pop();
      if (c) {
        if (c.name === 'Waldo') {
          return true;
        }
      }
    }
    return false;
  }

  /* Returns the number of Venusians named “Waldo” that are in the ship or its fleet Venusians can be in two places at once, so if two Waldos have same VSN, you should count them twice. */
  public totalWaldos() : number {
    
    const crew : Array<Venusian> = this.getCrew();
    const daughters : Array<Ship> = this.getDaughters();
    crew.forEach((c) => {
      if (c.getName() === 'Waldo') {
        Ship.waldoCount += 1;
      }
    });
    daughters.forEach((d) => {
      d.totalWaldos();
    });
    const waldos = Ship.waldoCount;
    Ship.waldoCount = 0;
    return waldos;
  
  }

  // Removes any Venusians named “Waldo” from the crew of the ship.
  public removeWaldos() : void {
    const newCrew = [];
    const cSize = this.crew.length - 1;
    while (cSize > 0) {
      const cm = this.crew[cSize];
      if (cm.getName() !== 'Waldo') {
        newCrew.push(cm);
      }
    }
    this.crew = newCrew;
  }

  // Removes any Venusians named Waldo from the crews of the given ship and its fleet.
  public removeDeepWaldos() : void {
    const daughters : Array<Ship> = this.getDaughters();
    this.removeWaldos();
    daughters.forEach((d) => {
      d.removeDeepWaldos();
    });
  }

  // Determines whether there are any ship serial number duplicates
  // among a given ship and its fleet
  public fleetHasDuplicates() : boolean {
    const children = this.getDaughters();
    Ship.fullFleet.push(this.getSerialNumber());
    children.forEach((c) => {
      Ship.fullFleet.push(c.getSerialNumber());
      c.fleetHasDuplicates();
    });

    const noDupes = [...new Set(Ship.fullFleet)];
    const fleetSize = Ship.fullFleet.length;
    Ship.fullFleet = [];
    return fleetSize !== noDupes.length;
  
  }
}