import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyReply } from 'fastify';
import { TestingController } from './testing.controller';

describe('TestingController', () => {
  let controller: TestingController;

  const mockReply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis()
  } as unknown as FastifyReply;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestingController]
    }).compile();
    controller = module.get<TestingController>(TestingController);
  });

  describe('getStatus', () => {
    it('returns enabled: false when ENABLE_TESTING_ENDPOINTS is not "true"', async () => {
      const prev = process.env.ENABLE_TESTING_ENDPOINTS;
      process.env.ENABLE_TESTING_ENDPOINTS = 'false';
      const module = await Test.createTestingModule({
        controllers: [TestingController]
      }).compile();
      const ctrl = module.get<TestingController>(TestingController);
      const result = await ctrl.getStatus();
      expect(result.enabled).toBe(false);
      expect(result.message).toContain('disabled');
      process.env.ENABLE_TESTING_ENDPOINTS = prev;
    });

    it('returns enabled: true when ENABLE_TESTING_ENDPOINTS is "true"', async () => {
      const prev = process.env.ENABLE_TESTING_ENDPOINTS;
      process.env.ENABLE_TESTING_ENDPOINTS = 'true';
      const module = await Test.createTestingModule({
        controllers: [TestingController]
      }).compile();
      const ctrl = module.get<TestingController>(TestingController);
      const result = await ctrl.getStatus();
      expect(result.enabled).toBe(true);
      expect(result.message).toContain('enabled');
      process.env.ENABLE_TESTING_ENDPOINTS = prev;
    });
  });

  describe('dummy endpoints (when disabled)', () => {
    it('bharath returns 404 and does not send success body when disabled', async () => {
      process.env.ENABLE_TESTING_ENDPOINTS = 'false';
      const module = await Test.createTestingModule({
        controllers: [TestingController]
      }).compile();
      const ctrl = module.get<TestingController>(TestingController);
      await (ctrl as any).bharath(mockReply);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.stringContaining('disabled')
        })
      );
    });
  });

  describe('dummy endpoints (when enabled)', () => {
    it('bharath returns 200 and success body when enabled', async () => {
      process.env.ENABLE_TESTING_ENDPOINTS = 'true';
      const module = await Test.createTestingModule({
        controllers: [TestingController]
      }).compile();
      const ctrl = module.get<TestingController>(TestingController);
      const result = await (ctrl as any).bharath(mockReply);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toMatchObject({
        endpoint: 'bharath',
        status: 'success',
        message: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('demon returns 200 with theme when enabled', async () => {
      process.env.ENABLE_TESTING_ENDPOINTS = 'true';
      const module = await Test.createTestingModule({
        controllers: [TestingController]
      }).compile();
      const ctrl = module.get<TestingController>(TestingController);
      const result = await (ctrl as any).demon(mockReply);
      expect(result.endpoint).toBe('demon');
      expect(result.theme).toBe('demon-slayer');
    });
  });
});
