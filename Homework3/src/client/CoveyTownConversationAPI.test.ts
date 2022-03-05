import CORS from 'cors';
import Express from 'express';
import http from 'http';
import { nanoid } from 'nanoid';
import { AddressInfo } from 'net';
import { mock, mockReset } from 'jest-mock-extended';
import CoveyTownController from '../lib/CoveyTownController';
import CoveyTownsStore from '../lib/CoveyTownsStore';
import addTownRoutes from '../router/towns';
import * as requestHandlers from '../requestHandlers/CoveyTownRequestHandlers';
import { createConversationForTesting } from './TestUtils';
import TownsServiceClient, { ServerConversationArea } from './TownsServiceClient';
import CoveyTownListener from '../types/CoveyTownListener';
// import Player from '../types/Player';
// import * as TestUtils from './TestUtils';

type TestTownData = {
  friendlyName: string;
  coveyTownID: string;
  isPubliclyListed: boolean;
  townUpdatePassword: string;
};

// CONVERSATION AREA API TESTS
describe('Create Conversation Area API', () => {
  let server: http.Server;
  let apiClient: TownsServiceClient;

  async function createTownForTesting(
    friendlyNameToUse?: string,
    isPublic = false,
  ): Promise<TestTownData> {
    const friendlyName =
      friendlyNameToUse !== undefined
        ? friendlyNameToUse
        : `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
    const ret = await apiClient.createTown({ friendlyName, isPubliclyListed: isPublic });
    return {
      friendlyName,
      isPubliclyListed: isPublic,
      coveyTownID: ret.coveyTownID,
      townUpdatePassword: ret.coveyTownPassword,
    };
  }

  beforeAll(async () => {
    const app = Express();
    app.use(CORS());
    server = http.createServer(app);

    addTownRoutes(server, app);
    await server.listen();
    const address = server.address() as AddressInfo;

    apiClient = new TownsServiceClient(`http://127.0.0.1:${address.port}`);
  });
  afterAll(async () => {
    await server.close();
  });
  // SUCCESFUL CREATE CONVERSATION AREA
  it('Executes without error when creating a new conversation', async () => {
    const testingTown = await createTownForTesting(undefined, true);
    const testingSession = await apiClient.joinTown({
      userName: nanoid(),
      coveyTownID: testingTown.coveyTownID,
    });
    await apiClient.createConversationArea({
      conversationArea: createConversationForTesting(),
      coveyTownID: testingTown.coveyTownID,
      sessionToken: testingSession.coveySessionToken,
    });
  });
});

// REQUEST HANDLER ADD CONVERSATION AREA
describe('conversationAreaCreateHandler', () => {
  const mockCoveyTownStore = mock<CoveyTownsStore>();
  const mockCoveyTownController = mock<CoveyTownController>();
  // let server: http.Server;
  // let apiClient: TownsServiceClient;

  beforeAll(() => {
    // Set up a spy for CoveyTownsStore that will always return our mockCoveyTownsStore as the singleton instance
    jest.spyOn(CoveyTownsStore, 'getInstance').mockReturnValue(mockCoveyTownStore);
  });
  beforeEach(() => {
    // Reset all mock calls, and ensure that getControllerForTown will always return the same mock controller
    mockReset(mockCoveyTownController);
    mockReset(mockCoveyTownStore);
    mockCoveyTownStore.getControllerForTown.mockReturnValue(mockCoveyTownController);
  });
  afterEach(() => {
    mockReset(mockCoveyTownController);
    mockReset(mockCoveyTownStore);
    mockCoveyTownStore.getControllerForTown.mockReturnValue(mockCoveyTownController);
  });

  // VALID SESSION TOKEN
  it('Checks for a valid session token before creating a conversation area', async ()=>{
    const invalidTownID = nanoid();
    const conversationArea : ServerConversationArea = {
      boundingBox: { height: 1, width: 1, x:1, y:1 }, label: 'Conversation Area 1 Label', occupantsByID: [], topic: 'Conversation Area 1 Topic' };
    const invalidSessionToken = nanoid();
    const mockListener = mock<CoveyTownListener>();
    mockCoveyTownController.addTownListener(mockListener);

    // Make sure to return 'undefined' regardless of what session token is passed
    mockCoveyTownController.getSessionByToken.mockReturnValueOnce(undefined);

    const failResult = requestHandlers.conversationAreaCreateHandler({
      conversationArea,
      coveyTownID: invalidTownID,
      sessionToken: invalidSessionToken,
    });

    expect(failResult.isOK).toBe(false);
    // expect(mockCoveyTownController.getSessionByToken).toBeCalledWith(invalidSessionToken);

    
    // const validArea = await apiClient.createConversationArea();

    // // Get a valid session token by joining the room
    // const { coveySessionToken: validSessionToken } = await apiClient.joinTown({
    //   coveyTownID: validArea.coveyTownID,
    //   userName: nanoid(),
    // });


    // const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, validSessionToken, nanoid());
    // await socketConnected; // Make sure that the socket actually connects to the server
    // await socketDisconnected;
  });
});