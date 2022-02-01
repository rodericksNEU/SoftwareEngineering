import Venusian from './Venusian';
import Ship from './Ship';

const maude = new Venusian('Maude');
const harold = new Venusian('Harold');
const Waldo1 = new Venusian('Waldo');
const Waldo2 = new Venusian('Waldo');
const ship1 = new Ship([], []);
const ship2 = new Ship([maude, harold, Waldo1, Waldo2], []);
const ship3 = new Ship([maude, harold], []);
const ship4 = new Ship([harold, Waldo1], [ship1, ship2]);
const ship5 = new Ship([], [ship2, ship4, ship3]);

describe('sanity tests', () => {

  test('methods for Venusians are defined', () => {
    expect(harold.getName()).toBeDefined();
    expect(harold.getVsn()).toBeDefined();
  });

  test('methods for Ship are defined', () => {
    expect(ship1.getCrew()).toBeDefined();
    expect(ship1.getDaughters()).toBeDefined();
    expect(ship1.getSerialNumber()).toBeDefined();
    expect(ship5.totalWaldos()).toBeDefined();
    expect(ship5.removeWaldos).toBeDefined();
    expect(ship5.removeDeepWaldos).toBeDefined();
    expect(ship5.fleetHasDuplicates()).toBeDefined();
  });

});
