/**
 * Unit tests for HPFeeds Service
 *
 * Tests HPFeeds broker connection, credential management, and message publishing.
 */

import { HPFeedsService } from '../src/services/hpfeeds.service';

describe('HPFeeds Service', () => {
  let service: HPFeedsService;

  beforeEach(() => {
    // Create new service instance for each test
    service = new HPFeedsService('localhost', 20000);
  });

  afterEach(() => {
    // Clean up event listeners
    service.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create service with default config from environment', () => {
      const defaultService = new HPFeedsService();
      const config = defaultService.getConfig();

      expect(config.brokerHost).toBeDefined();
      expect(config.brokerPort).toBeDefined();
      expect(typeof config.brokerPort).toBe('number');
    });

    it('should create service with custom host and port', () => {
      const customService = new HPFeedsService('custom-host', 12345);
      const config = customService.getConfig();

      expect(config.brokerHost).toBe('custom-host');
      expect(config.brokerPort).toBe(12345);
    });

    it('should start in disconnected state', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should start with zero registered sensors', () => {
      expect(service.getRegisteredSensorCount()).toBe(0);
    });
  });

  describe('connect/disconnect', () => {
    it('should connect to broker successfully', async () => {
      const connectedSpy = jest.fn();
      service.on('connected', connectedSpy);

      await service.connect();

      expect(service.isConnected()).toBe(true);
      expect(connectedSpy).toHaveBeenCalledWith({
        host: 'localhost',
        port: 20000,
      });
    });

    it('should disconnect from broker successfully', async () => {
      const disconnectedSpy = jest.fn();
      service.on('disconnected', disconnectedSpy);

      await service.connect();
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should handle multiple connect calls', async () => {
      await service.connect();
      const firstState = service.isConnected();

      await service.connect();
      const secondState = service.isConnected();

      expect(firstState).toBe(true);
      expect(secondState).toBe(true);
    });
  });

  describe('registerSensor', () => {
    const testUuid = '550e8400-e29b-11d4-a716-446655440000';
    const testSecret = 'a1b2c3d4e5f6789012345678901234567890abcd';

    it('should register sensor with correct credentials', async () => {
      const creds = await service.registerSensor(
        testUuid,
        testSecret,
        'dionaea',
      );

      expect(creds).toEqual({
        uuid: testUuid,
        secret: testSecret,
        channel: 'dionaea.capture',
      });
    });

    it('should store registered credentials', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');

      const storedCreds = service.getCredentials(testUuid);
      expect(storedCreds).toBeDefined();
      expect(storedCreds?.uuid).toBe(testUuid);
    });

    it('should emit sensor_registered event when connected', async () => {
      const registeredSpy = jest.fn();
      service.on('sensor_registered', registeredSpy);

      await service.connect();
      await service.registerSensor(testUuid, testSecret, 'dionaea');

      expect(registeredSpy).toHaveBeenCalledWith({
        sensorUuid: testUuid,
        channel: 'dionaea.capture',
      });
    });

    it('should not emit sensor_registered event when disconnected', async () => {
      const registeredSpy = jest.fn();
      service.on('sensor_registered', registeredSpy);

      await service.registerSensor(testUuid, testSecret, 'dionaea');

      expect(registeredSpy).not.toHaveBeenCalled();
    });

    it('should register multiple sensors', async () => {
      const uuid1 = '550e8400-e29b-11d4-a716-446655440001';
      const uuid2 = '550e8400-e29b-11d4-a716-446655440002';

      await service.registerSensor(uuid1, testSecret, 'dionaea');
      await service.registerSensor(uuid2, testSecret, 'cowrie');

      expect(service.getRegisteredSensorCount()).toBe(2);
    });

    it('should update count when sensor is registered', async () => {
      expect(service.getRegisteredSensorCount()).toBe(0);

      await service.registerSensor(testUuid, testSecret, 'dionaea');

      expect(service.getRegisteredSensorCount()).toBe(1);
    });
  });

  describe('getChannelByHoneypot (via registerSensor)', () => {
    it('should assign correct channel for dionaea', async () => {
      const creds = await service.registerSensor('uuid-1', 'secret', 'dionaea');
      expect(creds.channel).toBe('dionaea.capture');
    });

    it('should assign correct channel for cowrie', async () => {
      const creds = await service.registerSensor('uuid-2', 'secret', 'cowrie');
      expect(creds.channel).toBe('cowrie.sessions');
    });

    it('should assign correct channel for conpot', async () => {
      const creds = await service.registerSensor('uuid-3', 'secret', 'conpot');
      expect(creds.channel).toBe('conpot.events');
    });

    it('should assign correct channel for glastopf', async () => {
      const creds = await service.registerSensor(
        'uuid-4',
        'secret',
        'glastopf',
      );
      expect(creds.channel).toBe('glastopf.events');
    });

    it('should assign correct channel for kippo', async () => {
      const creds = await service.registerSensor('uuid-5', 'secret', 'kippo');
      expect(creds.channel).toBe('kippo.sessions');
    });

    it('should assign correct channel for wordpot', async () => {
      const creds = await service.registerSensor('uuid-6', 'secret', 'wordpot');
      expect(creds.channel).toBe('wordpot.events');
    });

    it('should assign correct channel for shockpot', async () => {
      const creds = await service.registerSensor(
        'uuid-7',
        'secret',
        'shockpot',
      );
      expect(creds.channel).toBe('shockpot.events');
    });

    it('should assign correct channel for p0f', async () => {
      const creds = await service.registerSensor('uuid-8', 'secret', 'p0f');
      expect(creds.channel).toBe('p0f.events');
    });

    it('should assign default channel for unknown honeypot type', async () => {
      const creds = await service.registerSensor('uuid-9', 'secret', 'unknown');
      expect(creds.channel).toBe('unknown.events');
    });
  });

  describe('subscribe', () => {
    const testUuid = '550e8400-e29b-11d4-a716-446655440000';
    const testSecret = 'a1b2c3d4e5f6789012345678901234567890abcd';

    it('should subscribe to sensor channel successfully', async () => {
      const subscribedSpy = jest.fn();
      service.on('subscribed', subscribedSpy);

      await service.registerSensor(testUuid, testSecret, 'dionaea');
      await service.subscribe(testUuid);

      expect(subscribedSpy).toHaveBeenCalledWith({
        sensorUuid: testUuid,
        channel: 'dionaea.capture',
      });
    });

    it('should throw error when subscribing to unknown sensor', async () => {
      await expect(service.subscribe('unknown-uuid')).rejects.toThrow(
        'No credentials found for sensor unknown-uuid',
      );
    });

    it('should subscribe to multiple sensors', async () => {
      const uuid1 = '550e8400-e29b-11d4-a716-446655440001';
      const uuid2 = '550e8400-e29b-11d4-a716-446655440002';

      await service.registerSensor(uuid1, testSecret, 'dionaea');
      await service.registerSensor(uuid2, testSecret, 'cowrie');

      await expect(service.subscribe(uuid1)).resolves.not.toThrow();
      await expect(service.subscribe(uuid2)).resolves.not.toThrow();
    });
  });

  describe('publishAttack', () => {
    const testUuid = '550e8400-e29b-11d4-a716-446655440000';
    const testSecret = 'a1b2c3d4e5f6789012345678901234567890abcd';
    const testPayload = {
      src_ip: '192.168.1.100',
      dst_port: 22,
      protocol: 'ssh',
    };

    it('should publish attack message successfully', async () => {
      const publishedSpy = jest.fn();
      service.on('attack_published', publishedSpy);

      await service.connect();
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      await service.publishAttack(testUuid, testPayload);

      expect(publishedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sensorUuid: testUuid,
          channel: 'dionaea.capture',
          payload: testPayload,
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should throw error when publishing without credentials', async () => {
      await service.connect();

      await expect(
        service.publishAttack('unknown-uuid', testPayload),
      ).rejects.toThrow('No credentials found for sensor unknown-uuid');
    });

    it('should throw error when publishing while disconnected', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');

      await expect(
        service.publishAttack(testUuid, testPayload),
      ).rejects.toThrow('Not connected to HPFeeds broker');
    });

    it('should publish multiple messages', async () => {
      const publishedSpy = jest.fn();
      service.on('attack_published', publishedSpy);

      await service.connect();
      await service.registerSensor(testUuid, testSecret, 'dionaea');

      await service.publishAttack(testUuid, testPayload);
      await service.publishAttack(testUuid, {
        ...testPayload,
        src_ip: '10.0.0.1',
      });

      expect(publishedSpy).toHaveBeenCalledTimes(2);
    });

    it('should include timestamp in published message', async () => {
      let publishedMessage: any;
      service.on('attack_published', (msg) => {
        publishedMessage = msg;
      });

      await service.connect();
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      await service.publishAttack(testUuid, testPayload);

      expect(publishedMessage.timestamp).toBeDefined();
      expect(typeof publishedMessage.timestamp).toBe('number');
      expect(publishedMessage.timestamp).toBeGreaterThan(0);
    });
  });

  describe('credential management', () => {
    const testUuid = '550e8400-e29b-11d4-a716-446655440000';
    const testSecret = 'a1b2c3d4e5f6789012345678901234567890abcd';

    it('should get all credentials', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      await service.registerSensor('uuid-2', 'secret-2', 'cowrie');

      const allCreds = service.getAllCredentials();

      expect(allCreds).toHaveLength(2);
      expect(allCreds[0].uuid).toBeDefined();
      expect(allCreds[1].uuid).toBeDefined();
    });

    it('should return empty array when no credentials registered', () => {
      const allCreds = service.getAllCredentials();
      expect(allCreds).toEqual([]);
    });

    it('should get credentials by UUID', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');

      const creds = service.getCredentials(testUuid);

      expect(creds).toBeDefined();
      expect(creds?.uuid).toBe(testUuid);
      expect(creds?.secret).toBe(testSecret);
    });

    it('should return undefined for unknown UUID', () => {
      const creds = service.getCredentials('unknown-uuid');
      expect(creds).toBeUndefined();
    });

    it('should unregister sensor successfully', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      expect(service.getCredentials(testUuid)).toBeDefined();

      await service.unregisterSensor(testUuid);

      expect(service.getCredentials(testUuid)).toBeUndefined();
    });

    it('should emit sensor_unregistered event when connected', async () => {
      const unregisteredSpy = jest.fn();
      service.on('sensor_unregistered', unregisteredSpy);

      await service.connect();
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      await service.unregisterSensor(testUuid);

      expect(unregisteredSpy).toHaveBeenCalledWith({ sensorUuid: testUuid });
    });

    it('should update count when sensor is unregistered', async () => {
      await service.registerSensor(testUuid, testSecret, 'dionaea');
      expect(service.getRegisteredSensorCount()).toBe(1);

      await service.unregisterSensor(testUuid);

      expect(service.getRegisteredSensorCount()).toBe(0);
    });

    it('should handle unregistering unknown sensor gracefully', async () => {
      await expect(
        service.unregisterSensor('unknown-uuid'),
      ).resolves.not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return broker configuration', () => {
      const config = service.getConfig();

      expect(config).toEqual({
        brokerHost: 'localhost',
        brokerPort: 20000,
      });
    });
  });

  describe('getRegisteredSensorCount', () => {
    it('should return 0 initially', () => {
      expect(service.getRegisteredSensorCount()).toBe(0);
    });

    it('should return correct count after registrations', async () => {
      await service.registerSensor('uuid-1', 'secret-1', 'dionaea');
      expect(service.getRegisteredSensorCount()).toBe(1);

      await service.registerSensor('uuid-2', 'secret-2', 'cowrie');
      expect(service.getRegisteredSensorCount()).toBe(2);

      await service.registerSensor('uuid-3', 'secret-3', 'conpot');
      expect(service.getRegisteredSensorCount()).toBe(3);
    });

    it('should return correct count after unregistrations', async () => {
      await service.registerSensor('uuid-1', 'secret-1', 'dionaea');
      await service.registerSensor('uuid-2', 'secret-2', 'cowrie');
      expect(service.getRegisteredSensorCount()).toBe(2);

      await service.unregisterSensor('uuid-1');
      expect(service.getRegisteredSensorCount()).toBe(1);
    });
  });
});
