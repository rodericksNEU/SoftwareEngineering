import { customAlphabet, nanoid } from 'nanoid';
import { ServerConversationArea } from '../client/TownsServiceClient';
import { UserLocation } from '../CoveyTypes';
import CoveyTownListener from '../types/CoveyTownListener';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import IVideoClient from './IVideoClient';
import TwilioVideo from './TwilioVideo';

const friendlyNanoID = customAlphabet('1234567890ABCDEF', 8);

/**
 * The CoveyTownController implements the logic for each town: managing the various events that
 * can occur (e.g. joining a town, moving, leaving a town)
 */
export default class CoveyTownController {
  get capacity(): number {
    return this._capacity;
  }

  set isPubliclyListed(value: boolean) {
    this._isPubliclyListed = value;
  }

  get isPubliclyListed(): boolean {
    return this._isPubliclyListed;
  }

  get townUpdatePassword(): string {
    return this._townUpdatePassword;
  }

  get players(): Player[] {
    return this._players;
  }

  get occupancy(): number {
    return this._listeners.length;
  }

  get friendlyName(): string {
    return this._friendlyName;
  }

  set friendlyName(value: string) {
    this._friendlyName = value;
  }

  get coveyTownID(): string {
    return this._coveyTownID;
  }

  get conversationAreas(): ServerConversationArea[] {
    return this._conversationAreas;
  }

  /** The list of players currently in the town * */
  private _players: Player[] = [];

  /** The list of valid sessions for this town * */
  private _sessions: PlayerSession[] = [];

  /** The videoClient that this CoveyTown will use to provision video resources * */
  private _videoClient: IVideoClient = TwilioVideo.getInstance();

  /** The list of CoveyTownListeners that are subscribed to events in this town * */
  private _listeners: CoveyTownListener[] = [];

  /** The list of currently active ConversationAreas in this town */
  private _conversationAreas: ServerConversationArea[] = [];

  private readonly _coveyTownID: string;

  private _friendlyName: string;

  private readonly _townUpdatePassword: string;

  private _isPubliclyListed: boolean;

  private _capacity: number;

  constructor(friendlyName: string, isPubliclyListed: boolean) {
    this._coveyTownID = process.env.DEMO_TOWN_ID === friendlyName ? friendlyName : friendlyNanoID();
    this._capacity = 50;
    this._townUpdatePassword = nanoid(24);
    this._isPubliclyListed = isPubliclyListed;
    this._friendlyName = friendlyName;
  }

  /**
   * Adds a player to this Covey Town, provisioning the necessary credentials for the
   * player, and returning them
   *
   * @param newPlayer The new player to add to the town
   */
  async addPlayer(newPlayer: Player): Promise<PlayerSession> {
    const theSession = new PlayerSession(newPlayer);

    this._sessions.push(theSession);
    this._players.push(newPlayer);

    // Create a video token for this user to join this town
    theSession.videoToken = await this._videoClient.getTokenForTown(
      this._coveyTownID,
      newPlayer.id,
    );

    // Notify other players that this player has joined
    this._listeners.forEach(listener => listener.onPlayerJoined(newPlayer));

    return theSession;
  }

  /**
   * Destroys all data related to a player in this town.
   *
   * @param session PlayerSession to destroy
   */
  destroySession(session: PlayerSession): void {
   
    // filter out players and sessions
    this._players = this._players.filter(p => p.id !== session.player.id);
    this._sessions = this._sessions.filter(s => s.sessionToken !== session.sessionToken);

    // alert each listener that the player disconnected
    this._listeners.forEach(listener => listener.onPlayerDisconnected(session.player));

    // alias the conversation
    const conv = session.player.activeConversationArea;

    // if we have said conversation and its not null or undefined
    if (conv && conv !== undefined && conv !== null) {
      // filter occupants by ID
      conv.occupantsByID = conv.occupantsByID.filter(s => s !== session.player.id);

      // destroy the conversation area / update it?
      this._listeners.forEach(listener => listener.onConversationAreaDestroyed(conv));
      this._listeners.forEach(listener => listener.onConversationAreaUpdated(conv));
     
    }
  }

  /**
   * Updates the location of a player within the town
   *
   * If the player has changed conversation areas, this method also updates the
   * corresponding ConversationArea objects tracked by the town controller, and dispatches
   * any onConversationUpdated events as appropriate
   *
   * @param player Player to update location for
   * @param location New location for this player
   */
  updatePlayerLocation(player: Player, location: UserLocation): void {
    const oldPlayer = player;
    const oldAreaLabel = player.activeConversationArea?.label;
    player.updateLocation(location);
    const newPlayer = player;
    if (oldAreaLabel !== location.conversationLabel) {
      const newArea = location.conversationLabel;
      
      // Loop through all conversation areas
      for (let i = 0; i < this._conversationAreas.length; i += 1) {
        const ca = this._conversationAreas[i];
        
        // get conversation area with same id as new area
        if (ca.label === oldAreaLabel) {
          const occupants = ca.occupantsByID;
          const newOccupants : string[] = [];
          
          // Remove occupant from old area
          for (let o = 0; o < occupants.length; i += 1) {
            if (occupants[o] !== oldPlayer.id) {
              newOccupants.push(occupants[o]);

            }
          }
          ca.occupantsByID = newOccupants;
          oldPlayer.activeConversationArea = undefined;
          const oldArea = oldPlayer.activeConversationArea;
          if (oldArea) {
            this._listeners.forEach(l => l.onConversationAreaUpdated(oldArea));
          }
        }
        if (ca.label === newArea) {
          // add player to new conversation area list
          ca.occupantsByID.push(newPlayer.id);
          newPlayer.activeConversationArea = ca;
          this._listeners.forEach(l => l.onConversationAreaUpdated(ca));
        }
      }
    }
    this._listeners.forEach(listener => listener.onPlayerMoved(newPlayer));
  }

  /**
   * Creates a new conversation area in this town if there is not currently an active
   * conversation with the same label.
   *
   * Adds any players who are in the region defined by the conversation area to it.
   *
   * Notifies any CoveyTownListeners that the conversation has been updated
   *
   * @param _conversationArea Information describing the conversation area to create. Ignores any
   *  occupantsById that are set on the conversation area that is passed to this method.
   *
   * @returns true if the conversation is successfully created, or false if not
   */
  addConversationArea(_conversationArea: ServerConversationArea): boolean {


    if (
      _conversationArea.topic === '' ||
      _conversationArea.topic === undefined ||
      _conversationArea.label === '' ||
      _conversationArea.label === undefined
    ) {
      return false;
    }

    const bb = _conversationArea.boundingBox;
    // left most point of new bounding box
    const newLeft = bb.x - bb.width / 2;
    // right most point of new bounding box
    const newRight = bb.x + bb.width / 2;
    // top of bounding box
    const newTop = bb.y - bb.height / 2;
    // bottom of bounding box
    const newBottom = bb.y + bb.height / 2;

    // Checks if there is an existing conversation area in bounds of new conversation area
    
    for (let i = 0; i < this._conversationAreas.length; i += 1) {
      const convo = this._conversationAreas[i];
      if (convo) {
        if (convo.label === _conversationArea.label) {
          return false;
        }

        const cbb = convo.boundingBox;
        const left = cbb.x - bb.width / 2;
        const right = cbb.x + bb.width / 2;
        const top = cbb.y - bb.height / 2;
        const bottom = cbb.y + bb.height / 2;

        if (newRight > left && newLeft < right && newBottom < top && newTop > bottom) {
          return false;
        }
      }
    }

    this.conversationAreas.push(_conversationArea);
    // console.log(`length of conversation area array is ${this._conversationAreas.length}`);


    // Adds all players in new conversation area to occupancy list
    let j = this._players.length;
    while (j > 0) {

      const player = this._players[j - 1];
      const px = player.location.x;
      const py = player.location.y;
      if (px > newLeft && px < newRight && py > newTop && py < newBottom) {
        player.activeConversationArea = _conversationArea;
        _conversationArea.occupantsByID.push(player.id);

      }
      j -= 1;
    }

    this._listeners.forEach(l => {
      l.onConversationAreaUpdated(_conversationArea);
    });
    return true;
  }

  /**
   * Subscribe to events from this town. Callers should make sure to
   * unsubscribe when they no longer want those events by calling removeTownListener
   *
   * @param listener New listener
   */
  addTownListener(listener: CoveyTownListener): void {
    this._listeners.push(listener);
  }

  /**
   * Unsubscribe from events in this town.
   *
   * @param listener The listener to unsubscribe, must be a listener that was registered
   * with addTownListener, or otherwise will be a no-op
   */
  removeTownListener(listener: CoveyTownListener): void {
    this._listeners = this._listeners.filter(v => v !== listener);
  }

  /**
   * Fetch a player's session based on the provided session token. Returns undefined if the
   * session token is not valid.
   *
   * @param token
   */
  getSessionByToken(token: string): PlayerSession | undefined {
    return this._sessions.find(p => p.sessionToken === token);
  }

  disconnectAllPlayers(): void {
    this._listeners.forEach(listener => listener.onTownDestroyed());
  }
}
