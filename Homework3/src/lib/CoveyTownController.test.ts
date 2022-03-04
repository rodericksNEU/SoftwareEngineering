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

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  
  it('constructor should set the friendlyName property', () => { 
    const townName = `FriendlyNameTest-${nanoid()}`;
    const privateTownController = new CoveyTownController(townName, false);
    expect(privateTownController.friendlyName).toBe(townName);
    const publicTownController = new CoveyTownController(townName, false);
    expect(publicTownController.friendlyName).toBe(townName);
    
  });
  
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
  
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>()];
    
    beforeEach(() => {
      mockListeners.forEach(mockReset);
    });

    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener => expect(listener.onPlayerDisconnected).toBeCalledWith(player));
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));

    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());

    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();

    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();

    });
  });

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
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });

    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);

      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
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
  
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should add the conversation area to the list of conversation areas', async ()=>{
      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 10, y: 10, conversationLabel: undefined };
      testingTown.updatePlayerLocation(player, newLocation);

      const newConversationArea = TestUtils.createConversationForTesting();
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const areas = testingTown.conversationAreas;

      expect(areas.length).toEqual(1);
      expect(areas[0].label).toEqual(newConversationArea.label);
      expect(areas[0].topic).toEqual(newConversationArea.topic);
      expect(areas[0].boundingBox).toEqual(newConversationArea.boundingBox);

      expect(areas[0].occupantsByID.length === 1);
      expect(areas[0].occupantsByID[0] === player.id);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });
  });

  describe('updatePlayerLocation', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player\'s x,y location', async ()=>{
      // Create town and mock listener, create and add conversation area and player to town 
      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);


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
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
      expect(mockListener.onPlayerMoved).toHaveBeenCalledTimes(1);

    }); 
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

  // Assignment 3 Tests
  describe('destroySession', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should check if player is removed from conversation area upon session destroyed', async () => {

      const mockListeners = [mock<CoveyTownListener>(), mock<CoveyTownListener>()];
      testingTown.addTownListener(mockListeners[0]);
      testingTown.addTownListener(mockListeners[1]);
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
      expect(mockListeners[0].onPlayerMoved).toHaveBeenCalledTimes(2);
      expect(mockListeners[1].onPlayerMoved).toHaveBeenCalledTimes(2);
      expect(testConversationArea.occupantsByID.length === 2);
      expect(testConversationArea.occupantsByID[0] === player1.id);
      expect(testConversationArea.occupantsByID[1] === player2.id);
      
      testingTown.destroySession(session1);
      expect(session1 === null);
      expect(testConversationArea.occupantsByID.length === 1);
      expect(testingTown.getSessionByToken(session1.sessionToken)).toBeFalsy();
      expect(mockListeners[0].onPlayerDisconnected).toHaveBeenCalledTimes(1);
      expect(mockListeners[1].onPlayerDisconnected).toHaveBeenCalledTimes(1);
      
      testingTown.destroySession(session2);
      expect(session2 === null);
      expect(mockListeners[0].onPlayerDisconnected).toHaveBeenCalledTimes(2);
      expect(mockListeners[1].onPlayerDisconnected).toHaveBeenCalledTimes(2);
      expect(testConversationArea.occupantsByID.length === 0);
      expect(testingTown.getSessionByToken(session2.sessionToken)).toBeFalsy();

      expect(mockListeners[0].onConversationAreaUpdated).toHaveBeenCalledTimes(4);
      expect(mockListeners[1].onConversationAreaUpdated).toHaveBeenCalledTimes(4);
      expect(mockListeners[0].onPlayerDisconnected).toHaveBeenCalledTimes(2);
      expect(mockListeners[1].onPlayerDisconnected).toHaveBeenCalledTimes(2);
      expect(testingTown.getSessionByToken(session1.sessionToken) === null);
      expect(testingTown.getSessionByToken(session2.sessionToken) === null);
      expect(numPlayersBefore !== numPlayersAfter);
    });
  });

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
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        const testConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
        let result = testingTown.addConversationArea(testConversationArea);
        expect(result).toBe(true);

        const badBB = { x: 10, y: 10, height: 5, width: 5 };
        const goodBB = { x: 25, y: 25, height: 5, width: 5 };
        const badAreaLabel : ServerConversationArea = { label : testConversationArea.label, occupantsByID: [], topic : 'Bad Label', boundingBox : goodBB };
        result = testingTown.addConversationArea(badAreaLabel);
        expect(result).toBe(false);
        const badAreaTopic : ServerConversationArea = { label : 'Bad Topic', occupantsByID: [], topic : '', boundingBox : goodBB };
        result = testingTown.addConversationArea(badAreaTopic);
        expect(result).toBe(false);
        const badAreaBb : ServerConversationArea = { label : 'Bad Bounds', occupantsByID: [], topic : 'bounding box', boundingBox: badBB };
        result = testingTown.addConversationArea(badAreaBb);
        expect(result).toBe(false);
      });
  });
});

