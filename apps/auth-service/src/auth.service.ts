import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { LoginDto, RegisterDto, LoginResponseDto } from '@app/common';
import { User, UserDocument } from './schemas/user.schema';
import { DomainException } from '@app/common';
import { ERROR_CODES } from '@app/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds = parseInt(
    process.env.BCRYPT_ROUNDS || '12',
    10,
  );

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Registration
  // ───────────────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new DomainException(
        ERROR_CODES.DUPLICATE_RESOURCE,
        'Email already registered',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.bcryptRounds);
    const user = await this.userModel.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });

    this.logger.log(`User registered: ${user._id}`);
    return this.sanitizeUser(user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Login with JWT token generation
  // ───────────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    // Validate credentials
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new DomainException(
        ERROR_CODES.CREDENTIALS_INVALID,
        'Invalid email or password',
      );
    }

    if (!user.isActive) {
      throw new DomainException(
        ERROR_CODES.ACCESS_DENIED,
        'Account is deactivated',
      );
    }

    this.logger.log(`User logged in: ${user._id}`);

    // Generate token pair
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d'),
      } as any,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: this.sanitizeUser(user),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Refresh token — validate + rotate
  // ───────────────────────────────────────────────────────────────────────────

  async refreshToken(token: string): Promise<LoginResponseDto> {
    let payload: any;

    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (err) {
      this.logger.warn(
        `Refresh token verification failed: ${(err as Error).message}`,
      );
      throw new DomainException(
        ERROR_CODES.TOKEN_INVALID,
        'Invalid or expired refresh token',
      );
    }

    if (payload.type !== 'refresh') {
      throw new DomainException(
        ERROR_CODES.TOKEN_INVALID,
        'Invalid token type',
      );
    }

    const user = await this.findById(payload.sub);
    if (!user) {
      throw new DomainException(ERROR_CODES.UNAUTHORIZED, 'User not found');
    }

    if (!user.isActive) {
      throw new DomainException(
        ERROR_CODES.ACCESS_DENIED,
        'Account is deactivated',
      );
    }

    this.logger.log(`Token refreshed for user: ${user._id}`);

    // Generate new token pair (refresh token rotation)
    const newPayload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(newPayload);

    const refreshToken = this.jwtService.sign(
      { sub: newPayload.sub, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d'),
      } as any,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: this.sanitizeUser(user),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // User validation (used by LocalStrategy via TCP)
  // ───────────────────────────────────────────────────────────────────────────

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ email, deletedAt: null })
      .select('+password');
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // User lookup
  // ───────────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  private sanitizeUser(user: UserDocument) {
    const obj = user.toObject();
    const { password, ...sanitized } = obj;
    return sanitized;
  }
}
