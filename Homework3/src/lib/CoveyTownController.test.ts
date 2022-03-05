import { nanoid } from 'nanoid';
import { mock, mockDeep, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import { UserLocation } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';
import { ServerConversationArea } from '../client/TownsServiceClient';
// import { listeners } from 'process';


const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

// CONTROLLER TESTS
describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  
  // CONSTRUCTOR SETS TOWN NAME
  it('constructor should set the friendlyName property', () => { 
    const townName = `FriendlyNameTest-${nanoid()}`;
    const privateTownController = new CoveyTownController(townName, false);
    expect(privateTownController.friendlyName).toBe(townName);
    const publicTownController = new CoveyTownController(townName, false);
    expect(publicTownController.friendlyName).toBe(townName);
    
  });

  // ADD PLAYER
  describe('addPlayer', () => { 
    it('should use the coveyTownID and player ID properties when requesting a video token',
      async () => {
        const townName = `FriendlyNameTest-${nanoid()}`;
        const townController = new CoveyTownController(townName, false);
        const townID = townController.coveyTownID;
        const numPlayersBefore = townController.players.length;
        const player = new Player(nanoid());
        const newPlayerSession = await townController.addPlayer(player);
        const numPlayersAfter = townController.players.length;

        expect(numPlayersBefore === numPlayersAfter - 1);
        expect(townController.getSessionByToken(newPlayerSession.sessionToken) === newPlayerSession);
        expect(mockTwilioVideo.getTokenForTown.mock.calls.length).toBe(1);
        expect(mockTwilioVideo.getTokenForTown.mock.calls[0][0]).toBe(townID);
        expect(mockTwilioVideo.getTokenForTown.mock.calls[0][1]).toBe(newPlayerSession.player.id);

        expect(mockTwilioVideo.getTokenForTown).toHaveBeenCalledTimes(1);
        expect(mockTwilioVideo.getTokenForTown).toBeCalledWith(townController.coveyTownID, newPlayerSession.player.id);
      });
  });

  // TOWN AREA LISTENERS
  describe('town listeners and events', () => {
    const mockListeners = [mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>()];
    
    beforeEach(() => {
      mockListeners.forEach(mockReset);
    });

    // Active listeners
    // UPDATE PLAYER LOCATION
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const testingTown = new CoveyTownController('testing town', true);
      testingTown.addTownListener(mockListeners[0]);
      const newPlayer = new Player('newPlayer');
      await testingTown.addPlayer(newPlayer);
      testingTown.updatePlayerLocation(newPlayer, { 'x': 420, 'y': 69, 'rotation': 'front', 'moving': true });

      expect(mockListeners[0].onPlayerMoved).toBeCalledTimes(1);

      testingTown.addTownListener(mockListeners[1]);
      testingTown.updatePlayerLocation(newPlayer, { 'x': 492, 'y': 589, 'rotation': 'back', 'moving': true });

      expect(mockListeners[0].onPlayerMoved).toBeCalledTimes(2);
      expect(mockListeners[1].onPlayerMoved).toBeCalledTimes(1);

    });

    // DESTROY SESSION
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      testingTown.addTownListener(mockListeners[0]);
      const player1 = new Player('player1');
      const player2 = new Player('player2');
      const player3 = new Player('player3');
      const player1Session = await testingTown.addPlayer(player1);
      const player2Session = await testingTown.addPlayer(player2);
      const player3Session = await testingTown.addPlayer(player3);
      testingTown.destroySession(player1Session);

      expect(mockListeners[0].onPlayerDisconnected).toBeCalledTimes(1);

      testingTown.addTownListener(mockListeners[1]);
      testingTown.destroySession(player2Session);

      expect(mockListeners[0].onPlayerDisconnected).toBeCalledTimes(2);
      expect(mockListeners[1].onPlayerDisconnected).toBeCalledTimes(1);

      testingTown.addTownListener(mockListeners[2]);
      testingTown.destroySession(player3Session);

      expect(mockListeners[0].onPlayerDisconnected).toBeCalledTimes(3);
      expect(mockListeners[1].onPlayerDisconnected).toBeCalledTimes(2);
      expect(mockListeners[2].onPlayerDisconnected).toBeCalledTimes(1);

    });

    // ADD PLAYER
    it('should notify added listeners of new players when addPlayer is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));

    });

    // DISCONNECT ALL PLAYERS
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());

    });

    // Removed listeners
    // UPDATE PLAYER LOCATION
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const testingTown = new CoveyTownController('testing town', true);
      testingTown.addTownListener(mockListeners[0]);
      testingTown.addTownListener(mockListeners[1]);
      const newPlayer = new Player('newPlayer');
      await testingTown.addPlayer(newPlayer);
      testingTown.updatePlayerLocation(newPlayer, { 'x': 420, 'y': 69, 'rotation': 'front', 'moving': true });

      expect(mockListeners[0].onPlayerMoved).toBeCalledTimes(1);
      expect(mockListeners[1].onPlayerMoved).toBeCalledTimes(1);

      testingTown.removeTownListener(mockListeners[1]);
      testingTown.updatePlayerLocation(newPlayer, { 'x': 492, 'y': 589, 'rotation': 'back', 'moving': true });

      expect(mockListeners[0].onPlayerMoved).toBeCalledTimes(2);
      expect(mockListeners[1].onPlayerMoved).toBeCalledTimes(1);

    });
    
    // Removed listeners
    // DESTROY SESSION
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();

    });
    
    // Removed listeners
    // ADD PLAYER
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
      expect(mockListeners[0].onPlayerDisconnected).toBeCalledTimes(1);
      expect(mockListeners[0].onPlayerDisconnected).toBeCalledWith(player);
    });
    
    // Removed listeners
    // DISCONNECT ALL PLAYERS 
    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const testingTown : CoveyTownController = new CoveyTownController(townName, false);
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });
  });

  // TOWN LISTENER HANDLER
  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    // INVALID TOWN ID
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID('', session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
      expect(mockSocket.disconnect).toBeCalledTimes(1);
    });

    // INVALID SESSION TOKEN
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
      expect(mockSocket.disconnect).toBeCalledTimes(1);
    });

    // VALID SESSION TOKEN
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      
      // ADD PLAYER MOVED LISTENER
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        
        testingTown.updatePlayerLocation(player, { 'x': 100, 'y': 100, 'rotation': 'front', 'moving': true });
        expect(mockSocket.emit).toHaveBeenCalledWith('playerMoved', player);

      });

      // ADD DESTROY SESSION LISTENER 
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      // ADD CONVERSATION AREA DESTROYED LISTENER
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });

      // SOCKET DISCONNECT
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }

        });
      });
      // PLAYER LOCATION UPDATED
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(call => call[0] === 'playerMovement');
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
  
  // ADD COVERSATION AREA
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });

    it('should add the conversation area to the list of conversation areas and notify listeners', async ()=>{
      
      // LISTENERS
      const mockListeners = [mock<CoveyTownListener>(), mock<CoveyTownListener>(), mock<CoveyTownListener>()];
      testingTown.addTownListener(mockListeners[0]);

      // PLAYER IN BOUNDS OF UTILS WHEN AREA CREATED
      const utilsPlayer = new Player('player1');
      await testingTown.addPlayer(utilsPlayer);
      testingTown.updatePlayerLocation(utilsPlayer, { 'x': 10, 'y': 10, 'rotation': 'back', 'moving': true });
      
      // ADD UTILS AREA
      const utilsConversationArea = TestUtils.createConversationForTesting();
      utilsConversationArea.boundingBox = { x: 10, y: 10, width: 5, height: 5 };
      let result = testingTown.addConversationArea(utilsConversationArea);
      expect(result).toBe(true);
      let areas = testingTown.conversationAreas;

      // UTILS AREA TESTS
      expect(areas.length === 1);
      expect(areas[0].label).toEqual(utilsConversationArea.label);
      expect(areas[0].topic).toEqual(utilsConversationArea.topic);
      expect(areas[0].boundingBox).toEqual(utilsConversationArea.boundingBox);
      expect(areas[0].occupantsByID.length === 0);
      expect(mockListeners[0].onConversationAreaUpdated).toHaveBeenCalledTimes(1);

      // UTILS AREA PLAYER TEST
      expect(areas[0].occupantsByID.length === 1);
      expect(areas[0].occupantsByID[0] === utilsPlayer.id);
      expect(utilsPlayer.activeConversationArea === areas[0]);

      // INVALID LABEL, TOPIC, AND BOUNDS
      const badBB = { x: 10, y: 10, height: 5, width: 5 };
      const goodBB = { x: 25, y: 25, height: 5, width: 5 };
      const badLabelArea : ServerConversationArea = { 
        label : utilsConversationArea.label, occupantsByID: [], topic : 'Bad Label', boundingBox : goodBB };
      result = testingTown.addConversationArea(badLabelArea);
      expect(result).toBe(false);

      const badTopicArea : ServerConversationArea = { 
        label : 'Bad Topic', occupantsByID: [], topic : '', boundingBox : goodBB };
      result = testingTown.addConversationArea(badTopicArea);
      expect(result).toBe(false);
      
      const badBbArea : ServerConversationArea = { 
        label : 'Bad Bounds', occupantsByID: [], topic : 'bounding box', boundingBox: badBB };
      result = testingTown.addConversationArea(badBbArea);
      expect(result).toBe(false); 

      const validBB = { x: 50, y: 50, height: 10, width: 10 };
      const validArea : ServerConversationArea = { 
        label : 'Valid Area', occupantsByID: [], topic : 'Valid Topic', boundingBox : validBB }; 

      // ADD VALID TOPIC LABEL AND BB AREA
      testingTown.addTownListener(mockListeners[1]);
      result = testingTown.addConversationArea(validArea);
      expect(result).toBe(true);
      areas = testingTown.conversationAreas;

      expect(areas.length === 2);
      expect(mockListeners[0].onConversationAreaUpdated).toHaveBeenCalledTimes(2);
      expect(mockListeners[1].onConversationAreaUpdated).toHaveBeenCalledTimes(1);

      // VALID AREA TESTS
      expect(areas[1].label === validArea.label);
      expect(areas[1].topic === validArea.topic);
      expect(areas[1].boundingBox === validArea.boundingBox);

      // INVALID EDGE PLAYER LOCATION FOR EACH SIDE
      // #region 
      testingTown.addTownListener(mockListeners[2]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(0);

      const invalidLeftEdgePlayer = new Player('player1');
      await testingTown.addPlayer(invalidLeftEdgePlayer);
      testingTown.updatePlayerLocation(invalidLeftEdgePlayer, { 'x': 40, 'y': 50, 'rotation': 'back', 'moving': false });
      expect(areas[1].occupantsByID.length === 0);
      expect(invalidLeftEdgePlayer.activeConversationArea !== areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(1);

      const invalidRightEdgePlayer = new Player('player1');
      await testingTown.addPlayer(invalidRightEdgePlayer);
      testingTown.updatePlayerLocation(invalidRightEdgePlayer, { 'x': 60, 'y': 50, 'rotation': 'back', 'moving': false });
      expect(areas[1].occupantsByID.length === 0);
      expect(invalidRightEdgePlayer.activeConversationArea !== areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(2);

      const invalidTopEdgePlayer = new Player('player1');
      await testingTown.addPlayer(invalidTopEdgePlayer);
      testingTown.updatePlayerLocation(invalidTopEdgePlayer, { 'x': 50, 'y': 40, 'rotation': 'back', 'moving': false });
      expect(areas[1].occupantsByID.length === 0);
      expect(invalidTopEdgePlayer.activeConversationArea !== areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(3);

      const invalidBottomEdgePlayer = new Player('player1');
      await testingTown.addPlayer(invalidBottomEdgePlayer);
      testingTown.updatePlayerLocation(invalidBottomEdgePlayer, { 'x': 50, 'y': 60, 'rotation': 'back', 'moving': false });
      expect(areas[1].occupantsByID.length === 0);
      expect(invalidBottomEdgePlayer.activeConversationArea !== areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(4);
      // #endregion

      // VALID EDGE PLAYER LOCATION FOR EACH SIDE
      // #region 
      const leftEdgePlayer = new Player('player1');
      await testingTown.addPlayer(leftEdgePlayer);
      testingTown.updatePlayerLocation(leftEdgePlayer, { 'x': 41, 'y': 50, 'rotation': 'back', 'moving': true });
      expect(areas[1].occupantsByID.length === 1);
      expect(invalidLeftEdgePlayer.activeConversationArea === areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(5);

      const rightEdgePlayer = new Player('player1');
      await testingTown.addPlayer(rightEdgePlayer);
      testingTown.updatePlayerLocation(rightEdgePlayer, { 'x': 59, 'y': 50, 'rotation': 'back', 'moving': true });
      expect(areas[1].occupantsByID.length === 2);
      expect(invalidRightEdgePlayer.activeConversationArea === areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(6);

      const topEdgePlayer = new Player('player1');
      await testingTown.addPlayer(topEdgePlayer);
      testingTown.updatePlayerLocation(topEdgePlayer, { 'x': 49, 'y': 40, 'rotation': 'back', 'moving': true });
      expect(areas[1].occupantsByID.length === 3);
      expect(invalidTopEdgePlayer.activeConversationArea === areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(7);

      const bottomEdgePlayer = new Player('player1');
      await testingTown.addPlayer(bottomEdgePlayer);
      testingTown.updatePlayerLocation(bottomEdgePlayer, { 'x': 50, 'y': 59, 'rotation': 'back', 'moving': true });
      expect(areas[1].occupantsByID.length === 4);
      expect(invalidBottomEdgePlayer.activeConversationArea === areas[1]);
      expect(mockListeners[2].onPlayerMoved).toBeCalledTimes(8);

      expect(mockListeners[2].onConversationAreaUpdated).not.toHaveBeenCalled();
      // #endregion
    });
  });

  // UPDATE PLAYER LOCATION
  describe('updatePlayerLocation', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    
    // ACTIVE CONVERSATION AREA 
    it('should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player\'s x,y location', async ()=>{
      // Create town and mock listener, create and add conversation area and player to town 
      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const location1 : UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, location1);

      // Check that player's active conversation area has attributes of new conversation area
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(newConversationArea.boundingBox);

      const areas = testingTown.conversationAreas;
      // Check that only 1 player is in conversation area
      expect(areas[0].occupantsByID.length).toBe(1);
      // Check that the player is has the ID of added player
      expect(areas[0].occupantsByID[0]).toBe(player.id);
      // Check that conversation area updated and player moved listeners were called

      const location2 : UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: undefined };
      testingTown.updatePlayerLocation(player, location2);

      expect(player.activeConversationArea).toBe(undefined);

    }); 
    
    // CONVERSATION AREA UPDATED LISTENER 
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () =>{

      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });
  });

  // UPDATE PLAYER LOCATION
  describe('updatePlayerLocation', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    
    // ACTIVE CONVERSATION AREA 
    it('should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player\'s x,y location', async ()=>{
      // Create town and mock listener, create and add conversation area and player to town 
      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const location1 : UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, location1);

      // Check that player's active conversation area has attributes of our new conversation area
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(newConversationArea.boundingBox);

      const areas = testingTown.conversationAreas;
      // Check that only 1 player is in conversation area
      expect(areas[0].occupantsByID.length).toBe(1);
      // Check that the player is has the ID of added player
      expect(areas[0].occupantsByID[0]).toBe(player.id);
      // Check that conversation area updated and player moved listeners were called

      const location2 : UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: undefined };
      testingTown.updatePlayerLocation(player, location2);

      expect(player.activeConversationArea).toBe(undefined);

    }); 
    
    // CONVERSATION AREA UPDATED LISTENER 
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () =>{

      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });
  });

  // DESTROY SESSION
  describe('destroySession', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should check if player is removed from conversation area upon session destroyed', async () => {
      const testConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(testConversationArea);
      expect(result).toBe(true);
      
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());
      const numPlayersBefore = testingTown.players.length;
      expect(numPlayersBefore === 0);

      const session1 = await testingTown.addPlayer(player1);
      const session2 = await testingTown.addPlayer(player2);
      expect(testingTown.getSessionByToken(session1.sessionToken) === session1);
      expect(testingTown.getSessionByToken(session2.sessionToken) === session2);
      const newLocation : UserLocation = { moving: false, rotation: 'front', x: 10, y: 10, conversationLabel: testConversationArea.label };
      const numPlayersAfter = testingTown.players.length;
      testingTown.updatePlayerLocation(player1, newLocation);
      testingTown.updatePlayerLocation(player2, newLocation);
      expect(testConversationArea.occupantsByID.length === 2);
      expect(testConversationArea.occupantsByID[0] === player1.id);
      expect(testConversationArea.occupantsByID[1] === player2.id);
      
      testingTown.destroySession(session1);
      expect(session1 === null);
      expect(testConversationArea.occupantsByID.length === 1);
      expect(testingTown.getSessionByToken(session1.sessionToken)).toBeFalsy();
      
      testingTown.destroySession(session2);
      expect(session2 === null); 
      expect(testConversationArea.occupantsByID.length === 0);
      expect(testingTown.getSessionByToken(session2.sessionToken)).toBeFalsy();
      expect(testingTown.getSessionByToken(session1.sessionToken)).toBeFalsy();
      expect(numPlayersBefore !== numPlayersAfter);
    });
  });

  //
  describe('endEmptyConversationArea', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('Automatically end a conversation area when it\'s unoccupied',
      async () => {
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        const testConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
        const result = testingTown.addConversationArea(testConversationArea);
        expect(result).toBe(true);
        const player = new Player(nanoid());
        
        const enterConversationArea:UserLocation = { moving: false, rotation: 'front', x: 10, y: 10, conversationLabel: testConversationArea.label };
        testingTown.updatePlayerLocation(player, enterConversationArea);
        expect(testConversationArea.occupantsByID.length === 1);
        const caCountBefore = testingTown.conversationAreas.length;
        
        const leaveConversationArea:UserLocation = { moving: false, rotation: 'front', x: 50, y: 50, conversationLabel: undefined };
        const caCountAfter = testingTown.conversationAreas.length;
        testingTown.updatePlayerLocation(player, leaveConversationArea);

        // Check that conversation area list decremented
        expect(caCountBefore === caCountAfter + 1);
        // Check that conversation area has 0 occupants
        expect(testConversationArea.occupantsByID.length === 0);
        // Check that conversation area was called for player entry and exit
        expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(2);
        expect(mockListener.onConversationAreaDestroyed).toHaveBeenCalledWith(testConversationArea);
        // Check that conversation area has been destroyed
        expect(mockListener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
      });
  });

  describe('conversationAreaRequestHandlers', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('Automatically end a conversation area when it\'s unoccupied',
      async () => {
        const testConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
        const result = testingTown.addConversationArea(testConversationArea);
        expect(result).toBe(true);
        const player = new Player(nanoid());

        const enterConversationArea:UserLocation = { moving: false, rotation: 'front', x: 10, y: 10, conversationLabel: testConversationArea.label };
        testingTown.updatePlayerLocation(player, enterConversationArea);
        expect(testConversationArea.occupantsByID.length === 1);
        
        const leaveConversationArea:UserLocation = { moving: false, rotation: 'front', x: 50, y: 50, conversationLabel: undefined };
        testingTown.updatePlayerLocation(player, leaveConversationArea);
        expect(testConversationArea.occupantsByID.length === 0);
        expect(testingTown.conversationAreas.length === 0);
      });
  });
});

