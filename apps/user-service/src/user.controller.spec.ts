import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let userController: UserController;
  let userService: UserService;

  const mockUserService = {
    create: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    userController = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(userController).toBeDefined();
  });

  describe('create', () => {
    it('should call userService.create', async () => {
      const dto = {
        email: 'test@test.com',
        name: 'Test',
        password: 'pass',
      };
      mockUserService.create.mockResolvedValue({
        _id: '1',
        email: dto.email,
        name: dto.name,
      });
      const result = await userController.create(dto);
      expect(userService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        data: {
          _id: '1',
          email: dto.email,
          name: dto.name,
        },
      });
    });
  });

  describe('list', () => {
    it('should call userService.list with defaults', async () => {
      mockUserService.list.mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 20,
      });
      const result = await userController.findAll({});
      expect(userService.list).toHaveBeenCalledWith(0, 20);
      expect(result).toEqual({
        success: true,
        data: { items: [], total: 0, skip: 0, limit: 20 },
      });
    });
  });

  describe('softDelete', () => {
    it('should call userService.softDelete', async () => {
      mockUserService.softDelete.mockResolvedValue({ _id: '1' });
      await userController.softDelete('1');
      expect(userService.softDelete).toHaveBeenCalledWith('1');
    });
  });
});
