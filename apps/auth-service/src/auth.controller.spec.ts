import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = { email: 'test@test.com', password: 'pass', name: 'Test' };
      mockAuthService.register.mockResolvedValue({ id: '1', email: dto.email });
      const result = await authController.register(dto);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        data: { id: '1', email: dto.email },
      });
    });
  });

  describe('login', () => {
    it('should call authService.login', async () => {
      const dto = { email: 'test@test.com', password: 'pass' };
      mockAuthService.login.mockResolvedValue({ id: '1', email: dto.email });
      const result = await authController.login(dto);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        data: { id: '1', email: dto.email },
      });
    });
  });
});
