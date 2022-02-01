export default class Venusian {
  'name': string;

  'VSN': number;

  static vCount = 0;

  VSNs : Array<number> = [];

  /**
     * Creates a Venusian object with name and unique identification number.
     *
     * @param name Name of the Venusian as string.
     */
  constructor(name: string) {
    this.name = name;
    this.VSN = Venusian.vCount;
    Venusian.vCount += 1;
  }

  // Returns the name of Venusian as a string.
  public getName() : string {
    return this.name;
  }

  // Returns the social number of the given Venusian.
  public getVsn() : number {
    return this.VSN;
  }
}
