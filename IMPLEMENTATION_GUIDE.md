# Passport Authentication & Authorization — Implementation Guide

## Architecture Summary

```
                    ┌─────────────────────────────────────┐
                    │          API GATEWAY (thin)          │
                    │                                     │
  Client ──HTTP──►  │  Passport Strategies:               │
                    │   • LocalStrategy → TCP → auth-svc  │
                    │   • JwtStrategy   → local verify    │
                    │                                     │
                    │  Guards (thin):                     │
                    │   • LocalAuthGuard                  │
                    │   • JwtAuthGuard                    │
                    │   • RolesGuard                      │
                    └────────────────┬────────────────────┘
                                     │ TCP
                                     ▼
                    ┌─────────────────────────────────────┐
                    │         AUTH SERVICE (thick)         │
                    │                                      │
                    │  • register()                        │
                    │  • validateUser()                    │
                    │  • login() → JWT signing             │
                    │  • refreshToken() → token rotation   │
                    │  • JwtService (sign + verify)        │
                    │  • bcrypt hashing                    │
                    └──────────────────────────────────────┘
```

| Concern                                              | Lives In     | Reason                                 |
| ---------------------------------------------------- | ------------ | -------------------------------------- |
| Passport strategies (local, jwt)                     | API Gateway  | HTTP-layer — must live in HTTP context |
| Guards (LocalAuthGuard, JwtAuthGuard, RolesGuard)    | API Gateway  | HTTP request lifecycle                 |
| `@CurrentUser()`, `@Roles()`, `@Public()` decorators | Shared lib   | Metadata only, reusable                |
| JWT signing (`jwtService.sign()`)                    | Auth-Service | Centralized token authority            |
| JWT verification (access token)                      | API Gateway  | Self-validating via shared secret      |
| Password hashing + comparison                        | Auth-Service | Already exists                         |
| User credential validation                           | Auth-Service | Already exists (`validateUser`)        |
| Refresh token generation + rotation                  | Auth-Service | Business logic                         |
| Redis                                                | **NOT used** | Simplicity                             |

---

## Step 1 — Install Missing Dependencies

Run from the project root:

```bash
npm install passport-jwt @nestjs/jwt
npm install -D @types/passport-jwt
```

This adds:

- `passport-jwt` — JWT Passport strategy
- `@nestjs/jwt` — NestJS JWT module (used by both API Gateway for verification and auth-service for signing)
- `@types/passport-jwt` — TypeScript type definitions

---

## Step 2 — Add JWT Environment Variables

**File:** `.env.example`

Add these lines at the end of the file:

```env
# ─── JWT ─────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=change-me-to-a-256-bit-random-string
JWT_REFRESH_SECRET=change-me-to-another-256-bit-random-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

Also add these to your actual `.env` file with real secrets. Generate secure secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3 — Shared Library (`libs/common/`)

### 3.1 New File: `libs/common/src/constants/auth.constants.ts`

Create this file with the following content:

```typescript
/**
 * Authentication-related constants shared across the monorepo.
 */

/** Metadata key for @Roles() decorator */
export const ROLES_KEY = 'roles';

/** Metadata key for @Public() decorator (skip JWT auth) */
export const IS_PUBLIC_KEY = 'isPublic';
```

---

### 3.2 Modify File: `libs/common/src/constants/index.ts`

Add the `REFRESH_TOKEN` pattern to `AUTH_PATTERNS` and export the new auth constants.

**Before:**

```typescript
export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  VALIDATE_USER: 'auth.validateUser',
  FIND_BY_ID: 'auth.findById',
  FIND_BY_EMAIL: 'auth.findByEmail',
} as const;
```

**After:**

```typescript
export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  VALIDATE_USER: 'auth.validateUser',
  FIND_BY_ID: 'auth.findById',
  FIND_BY_EMAIL: 'auth.findByEmail',
  REFRESH_TOKEN: 'auth.refreshToken',
} as const;
```

**Before (end of file):**

```typescript
export * from './error-codes.constants';
```

**After (end of file):**

```typescript
export * from './error-codes.constants';
export * from './auth.constants';
```

---

### 3.3 Modify File: `libs/common/src/dto/auth.dto.ts`

Add the following two classes at the end of the file (after the existing `ValidateUserDto` class):

```typescript
import { IsJWT, IsNumber, IsObject } from 'class-validator';
import { IUser } from '../interfaces';

export class RefreshTokenDto {
  @IsJWT()
  refreshToken!: string;
}

export class LoginResponseDto {
  @IsJWT()
  accessToken!: string;

  @IsJWT()
  refreshToken!: string;

  @IsNumber()
  expiresIn!: number;

  @IsObject()
  user!: IUser;
}
```

Also add the imports at the top:

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsJWT,
  IsNumber,
  IsObject,
} from 'class-validator';
import { IUser } from '../interfaces';
```

---

### 3.4 New File: `libs/common/src/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the authenticated user from the request.
 *
 * Usage in controller:
 *   @Get('profile')
 *   async getProfile(@CurrentUser() user) {
 *     return user;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

### 3.5 New File: `libs/common/src/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/auth.constants';

/**
 * Decorator to specify required roles for a route or controller.
 *
 * Usage:
 *   @Roles('admin')
 *   @Roles('user', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

---

### 3.6 New File: `libs/common/src/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

/**
 * Decorator to mark a route as public (skip JWT authentication).
 *
 * Usage:
 *   @Public()
 *   @Get('health')
 *   healthCheck() { return 'ok'; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

### 3.7 New File: `libs/common/src/decorators/index.ts`

```typescript
export * from './current-user.decorator';
export * from './roles.decorator';
export * from './public.decorator';
```

---

### 3.8 New File: `libs/common/src/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../constants/auth.constants';

/**
 * Guard that checks if the authenticated user has the required roles.
 *
 * Must run AFTER JwtAuthGuard (which populates request.user).
 * Registered as a global guard in main.ts.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator = no role restriction
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

---

### 3.9 New File: `libs/common/src/guards/index.ts`

```typescript
export * from './roles.guard';
```

---

### 3.10 Modify File: `libs/common/src/index.ts`

Add the decorators and guards exports.

**Before:**

```typescript
export * from './common.module';
export * from './common.service';

// DTOs
export * from './dto';

// Interfaces
export * from './interfaces';

// Constants
export * from './constants';

// Exceptions
export * from './exceptions';

// Filters
export * from './filters';
```

**After:**

```typescript
export * from './common.module';
export * from './common.service';

// DTOs
export * from './dto';

// Interfaces
export * from './interfaces';

// Constants
export * from './constants';

// Exceptions
export * from './exceptions';

// Filters
export * from './filters';

// Decorators
export * from './decorators';

// Guards
export * from './guards';
```

---

## Step 4 — Auth-Service: Become the Token Authority

### 4.1 Modify File: `apps/auth-service/src/auth.module.ts`

Add `JwtModule` from `@nestjs/jwt`.

**Before:**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),

    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://root:rootpassword@localhost:27017/order_tracker?authSource=admin',
        ),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

**After:**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),

    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
          issuer: 'order-tracker-auth',
          audience: 'order-tracker-client',
        },
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://root:rootpassword@localhost:27017/order_tracker?authSource=admin',
        ),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

---

### 4.2 Modify File: `apps/auth-service/src/auth.service.ts`

Rewrite the entire file. The `login()` method now generates JWT tokens instead of just returning the user. A new `refreshToken()` method handles refresh token rotation.

```typescript
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
      },
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
      },
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
```

---

### 4.3 Modify File: `apps/auth-service/src/auth.controller.ts`

Update the `LOGIN` handler to handle `DomainException` errors and return token responses. Add a new `REFRESH_TOKEN` handler.

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  LoginDto,
  RegisterDto,
  ValidateUserDto,
  RefreshTokenDto,
} from '@app/common';
import { AuthService } from './auth.service';
import { DomainException } from '@app/common';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  async register(@Payload() dto: RegisterDto) {
    try {
      const user = await this.authService.register(dto);
      return { success: true, data: user };
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        return { success: false, error: error.message, code: error.code };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(@Payload() dto: LoginDto) {
    try {
      const result = await this.authService.login(dto);
      return { success: true, data: result };
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        return { success: false, error: error.message, code: error.code };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_USER)
  async validateUser(@Payload() dto: ValidateUserDto) {
    try {
      const user = await this.authService.validateUser(dto.email, dto.password);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.FIND_BY_ID)
  async findById(@Payload() id: string) {
    try {
      const user = await this.authService.findById(id);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.FIND_BY_EMAIL)
  async findByEmail(@Payload() email: string) {
    try {
      const user = await this.authService.findByEmail(email);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH_TOKEN)
  async refreshToken(@Payload() dto: RefreshTokenDto) {
    try {
      const result = await this.authService.refreshToken(dto.refreshToken);
      return { success: true, data: result };
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        return { success: false, error: error.message, code: error.code };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
```

---

## Step 5 — API Gateway: Thin Passport Layer

### 5.1 Create Directory Structure

Create these directories (they don't exist yet):

```
apps/api-gateway/src/auth/strategies/
apps/api-gateway/src/auth/guards/
```

### 5.2 New File: `apps/api-gateway/src/auth/strategies/local.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * passport-local strategy — validates email/password via auth-service.
 *
 * Follows NestJS passport docs:
 * https://docs.nestjs.com/recipes/passport#implementing-passport-local
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user; // → becomes request.user
  }
}
```

---

### 5.3 New File: `apps/api-gateway/src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * passport-jwt strategy — validates Bearer token using shared secret.
 *
 * No TCP call needed — JWT is self-validating with the shared secret.
 * Only auth-service needs to sign; the gateway only verifies locally.
 *
 * Follows NestJS passport docs:
 * https://docs.nestjs.com/recipes/passport#implementing-passport-jwt
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Passport-jwt has already verified the signature and expiry.
   * Just shape the payload into request.user.
   */
  async validate(payload: { sub: string; email: string; roles: string[] }) {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
```

---

### 5.4 New File: `apps/api-gateway/src/auth/guards/local-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that triggers the 'local' Passport strategy.
 * Used on the login route to validate email/password before issuing tokens.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

---

### 5.5 New File: `apps/api-gateway/src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@app/common';

/**
 * Guard that triggers the 'jwt' Passport strategy.
 *
 * Registered as a GLOBAL guard in main.ts — protects ALL routes by default.
 * Routes marked with @Public() will skip JWT verification.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

---

### 5.6 New File: `apps/api-gateway/src/auth/guards/index.ts`

```typescript
export * from './local-auth.guard';
export * from './jwt-auth.guard';
```

---

### 5.7 Rewrite File: `apps/api-gateway/src/auth/auth.service.ts`

Replace the entire content. This is a **thin** TCP forwarder — no business logic, no JWT, no crypto.

```typescript
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  AUTH_PATTERNS,
  LoginDto,
  RegisterDto,
  LoginResponseDto,
  SERVICES,
  ServiceResponse,
  IUser,
} from '@app/common';

/**
 * Thin service in the API Gateway.
 *
 * All business logic (password hashing, JWT signing, refresh token rotation)
 * lives in auth-service. This service just forwards TCP requests.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(SERVICES.AUTH)
    private readonly authClient: ClientProxy,

    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Validate user credentials via auth-service.
   * Used by LocalStrategy (passport-local).
   */
  async validateUser(email: string, password: string): Promise<IUser | null> {
    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.VALIDATE_USER, { email, password }),
    );

    if (!response.success) {
      this.logger.warn(
        { email, error: response.error },
        'User validation failed',
      );
      return null;
    }

    return response.data ?? null;
  }

  /**
   * Login — called AFTER LocalAuthGuard has validated credentials.
   * Sends credentials to auth-service which generates JWT tokens.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const response = await firstValueFrom<ServiceResponse<LoginResponseDto>>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { email: dto.email, error: response.error },
        'Login failed',
      );
      throw new HttpException(
        response.error || 'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.info({ userId: response.data?.user?._id }, 'Login successful');
    return response.data!;
  }

  /**
   * Register a new user via auth-service.
   */
  async register(dto: RegisterDto): Promise<IUser> {
    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.REGISTER, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { email: dto.email, error: response.error },
        'Registration failed',
      );
      throw new HttpException(
        response.error || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info({ userId: response.data?._id }, 'Registration successful');
    return response.data!;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Auth-service validates the refresh token, rotates it, and returns new pair.
   */
  async refreshToken(token: string): Promise<LoginResponseDto> {
    const response = await firstValueFrom<ServiceResponse<LoginResponseDto>>(
      this.authClient.send(AUTH_PATTERNS.REFRESH_TOKEN, {
        refreshToken: token,
      }),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Token refresh failed');
      throw new HttpException(
        response.error || 'Token refresh failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.info(
      { userId: response.data?.user?._id },
      'Token refreshed successfully',
    );
    return response.data!;
  }
}
```

---

### 5.8 Rewrite File: `apps/api-gateway/src/auth/auth.controller.ts`

Replace the entire content.

```typescript
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { LoginDto, RegisterDto, RefreshTokenDto } from '@app/common';
import { Public } from '@app/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectPinoLogger(AuthController.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * POST /api/v1/auth/register
   * Public — no authentication required.
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    this.logger.info({ email: dto.email }, 'POST /auth/register');
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/login
   *
   * Uses LocalAuthGuard → triggers passport-local strategy.
   * Strategy validates email/password via auth-service.
   * On success, req.user is populated. Then we call authService.login()
   * which sends credentials to auth-service for JWT token generation.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() dto: LoginDto) {
    this.logger.info(
      { userId: req.user?._id },
      'POST /auth/login — user authenticated by LocalStrategy, issuing tokens',
    );
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Public — uses refresh token from body instead of access token.
   * Auth-service validates the refresh token and returns a new token pair.
   */
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    this.logger.info('POST /auth/refresh');
    return this.authService.refreshToken(dto.refreshToken);
  }
}
```

---

### 5.9 New File: `apps/api-gateway/src/auth/auth.module.ts`

**IMPORTANT**: This file must replace the existing `auth.module.ts`. If it's the same path as the controller/service directory, you need to rename or move the existing one first. The file should be:

> **Note**: Based on the current project structure, there is NO existing `apps/api-gateway/src/auth/auth.module.ts` — the auth module logic is currently embedded in `api-gateway.module.ts`. So this is a brand new file.

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { SERVICES } from '@app/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
          issuer: 'order-tracker-auth',
          audience: 'order-tracker-client',
        },
      }),
      inject: [ConfigService],
    }),

    // TCP client for Auth Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.AUTH,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('AUTH_SERVICE_HOST', 'localhost'),
            port: config.get<number>('AUTH_SERVICE_PORT', 3003),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
```

---

### 5.10 New File: `apps/api-gateway/src/auth/index.ts`

```typescript
export * from './auth.module';
export * from './auth.service';
export * from './auth.controller';
```

---

## Step 6 — Update API Gateway Main Module

### 6.1 Modify File: `apps/api-gateway/src/api-gateway.module.ts`

**Before:** (current file)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';

import { SERVICES } from '@app/common';
import { ProductsController } from './products/products.controller';
import { OrdersController } from './orders/orders.controller';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: false },
              }
            : undefined,
        customLogLevel: (_req, res) => {
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),

    // TCP client for Product Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.PRODUCT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('PRODUCT_SERVICE_HOST', 'localhost'),
            port: config.get<number>('PRODUCT_SERVICE_PORT', 3001),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // TCP client for Order Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.ORDER,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('ORDER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('ORDER_SERVICE_PORT', 3002),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // TCP client for Auth Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.AUTH,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('AUTH_SERVICE_HOST', 'localhost'),
            port: config.get<number>('AUTH_SERVICE_PORT', 3003),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // TCP client for User Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.USER,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('USER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('USER_SERVICE_PORT', 3004),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [
    ProductsController,
    OrdersController,
    AuthController,
    UsersController,
  ],
  providers: [AuthService],
})
export class ApiGatewayModule {}
```

**After:** (import AuthModule, remove auth ClientsModule + AuthService provider)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';

import { SERVICES } from '@app/common';
import { ProductsController } from './products/products.controller';
import { OrdersController } from './orders/orders.controller';
import { UsersController } from './users/users.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: false },
              }
            : undefined,
        customLogLevel: (_req, res) => {
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),

    // Auth module — brings PassportModule, JwtModule, strategies, guards
    // Also includes its own TCP client for AUTH_SERVICE
    AuthModule,

    // TCP client for Product Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.PRODUCT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('PRODUCT_SERVICE_HOST', 'localhost'),
            port: config.get<number>('PRODUCT_SERVICE_PORT', 3001),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // TCP client for Order Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.ORDER,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('ORDER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('ORDER_SERVICE_PORT', 3002),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // TCP client for User Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.USER,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('USER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('USER_SERVICE_PORT', 3004),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [ProductsController, OrdersController, UsersController],
})
export class ApiGatewayModule {}
```

**Key changes:**

1. Removed `import { AuthController } from './auth/auth.controller'` — now imported via `AuthModule`
2. Removed `import { AuthService } from './auth/auth.service'` — now in `AuthModule`
3. Added `import { AuthModule } from './auth/auth.module'`
4. Added `AuthModule` to `imports` array
5. Removed the auth `ClientsModule.registerAsync` block (now in `AuthModule`)
6. Removed `AuthController` from `controllers` array
7. Removed `providers: [AuthService]`

---

## Step 7 — Register Global Guards in `main.ts`

### 7.1 Modify File: `apps/api-gateway/src/main.ts`

**Before:**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ApiGatewayModule } from './api-gateway.module';
import { HttpExceptionFilter } from '@app/common';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // Global exception filter - handles all exceptions with custom responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}/api/v1`);
}

bootstrap();
```

**After:**

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ApiGatewayModule } from './api-gateway.module';
import { HttpExceptionFilter, RolesGuard } from '@app/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // Global exception filter - handles all exceptions with custom responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Global Guards — applied to ALL routes automatically
  // ───────────────────────────────────────────────────────────────────────────

  const reflector = app.get(Reflector);

  // 1. JwtAuthGuard: Verifies JWT on every request (unless @Public())
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // 2. RolesGuard: Enforces role-based access (@Roles('admin'))
  //    Runs AFTER JwtAuthGuard so request.user is populated
  app.useGlobalGuards(new RolesGuard(reflector));

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}/api/v1`);
}

bootstrap();
```

---

## Step 8 — Protect Routes with Decorators

### 8.1 Modify File: `apps/api-gateway/src/products/products.controller.ts`

Add import and decorators:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  CreateProductDto,
  PRODUCT_PATTERNS,
  SERVICES,
  ServiceResponse,
  IProduct,
  Public,
  Roles,
} from '@app/common';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(SERVICES.PRODUCT)
    private readonly productClient: ClientProxy,

    @InjectPinoLogger(ProductsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateProductDto) {
    this.logger.info(
      { body: dto },
      'POST /products — forwarding to Product Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Product creation failed');
      throw new HttpException(
        response.error || 'Failed to create product',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { productId: response.data?._id },
      'Product created successfully via gateway',
    );
    return response.data;
  }

  @Public()
  @Get()
  async findAll() {
    this.logger.info('GET /products — forwarding to Product Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IProduct[]>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Failed to fetch products');
      throw new HttpException(
        response.error || 'Failed to fetch products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.length },
      'Products fetched via gateway',
    );
    return response.data;
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { productId: id },
      'GET /products/:id — forwarding to Product Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { productId: id, error: response.error },
        'Product not found via gateway',
      );
      throw new HttpException(
        response.error || 'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }
}
```

### 8.2 Modify File: `apps/api-gateway/src/orders/orders.controller.ts`

Add import and decorators:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  CreateOrderDto,
  ORDER_PATTERNS,
  SERVICES,
  ServiceResponse,
  IOrder,
  Roles,
} from '@app/common';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(SERVICES.ORDER)
    private readonly orderClient: ClientProxy,

    @InjectPinoLogger(OrdersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Roles('user', 'admin')
  @Post()
  async create(@Body() dto: CreateOrderDto) {
    this.logger.info(
      { customerId: dto.customerId, itemCount: dto.items.length },
      'POST /orders — forwarding to Order Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IOrder>>(
      this.orderClient.send(ORDER_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Order creation failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to create order',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { orderId: response.data?._id },
      'Order created successfully via gateway',
    );
    return response.data;
  }

  @Roles('admin')
  @Get()
  async findAll() {
    this.logger.info('GET /orders — forwarding to Order Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IOrder[]>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Failed to fetch orders via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.length },
      'Orders fetched via gateway',
    );
    return response.data;
  }

  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { orderId: id },
      'GET /orders/:id — forwarding to Order Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IOrder>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { orderId: id, error: response.error },
        'Order not found via gateway',
      );
      throw new HttpException(
        response.error || 'Order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }
}
```

### 8.3 Modify File: `apps/api-gateway/src/users/users.controller.ts`

Add import and decorators:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  CreateUserDto,
  UpdateUserDto,
  USER_PATTERNS,
  SERVICES,
  ServiceResponse,
  IUser,
  Roles,
} from '@app/common';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(SERVICES.USER)
    private readonly userClient: ClientProxy,

    @InjectPinoLogger(UsersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    this.logger.info(
      { email: dto.email },
      'POST /users — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'User creation failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to create user',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { userId: response.data?._id },
      'User created via gateway',
    );
    return response.data;
  }

  @Roles('admin')
  @Get()
  async findAll(@Query('skip') skip?: string, @Query('limit') limit?: string) {
    this.logger.info('GET /users — forwarding to User Service via TCP');

    const response = await firstValueFrom<
      ServiceResponse<{
        items: IUser[];
        total: number;
        skip: number;
        limit: number;
      }>
    >(
      this.userClient.send(USER_PATTERNS.FIND_ALL, {
        skip: skip ? parseInt(skip, 10) : 0,
        limit: limit ? parseInt(limit, 10) : 20,
      }),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Failed to fetch users via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.total },
      'Users fetched via gateway',
    );
    return response.data;
  }

  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { userId: id },
      'GET /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User not found via gateway',
      );
      throw new HttpException(
        response.error || 'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }

  @Roles('admin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updates: UpdateUserDto) {
    this.logger.info(
      { userId: id },
      'PATCH /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.UPDATE, { id, updates }),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User update failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to update user',
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data;
  }

  @Roles('admin')
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    this.logger.info(
      { userId: id },
      'DELETE /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.SOFT_DELETE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User soft delete failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to delete user',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info({ userId: id }, 'User soft deleted via gateway');
    return response.data;
  }
}
```

---

## Step 9 — Verify and Test

### 9.1 Build Check

```bash
npm run build:api-gateway
npm run build:auth-service
```

Fix any compilation errors before proceeding.

### 9.2 Start Services

```bash
npm run start:auth-service:dev
npm run start:api-gateway:dev
```

### 9.3 Test Flow

**1. Register a user:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

**2. Login to get tokens:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Response:

```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900,
  "user": {
    "_id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "roles": ["user"]
  }
}
```

**3. Access protected route with token:**

```bash
curl http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <accessToken>"
```

**4. Access admin-only route as regular user (should get 403):**

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <accessToken>"
```

**5. Access public route without token:**

```bash
curl http://localhost:3000/api/v1/products
```

**6. Refresh tokens:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

### 9.4 Error Responses

| Scenario                     | HTTP Status      | Response                                          |
| ---------------------------- | ---------------- | ------------------------------------------------- |
| No token on protected route  | 401 Unauthorized | `{"message": "Unauthorized"}`                     |
| Expired token                | 401 Unauthorized | `{"message": "Unauthorized"}`                     |
| Valid token but wrong role   | 403 Forbidden    | (blocked by RolesGuard)                           |
| Invalid credentials on login | 401 Unauthorized | `{"message": "Invalid email or password"}`        |
| Invalid refresh token        | 401 Unauthorized | `{"message": "Invalid or expired refresh token"}` |
| Deactivated account          | 401 Unauthorized | `{"message": "Account is deactivated"}`           |

---

## File Change Summary (At-a-Glance)

| #   | File                                                     | Action                                                                                    |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `package.json`                                           | Run: `npm install passport-jwt @nestjs/jwt && npm install -D @types/passport-jwt`         |
| 2   | `.env.example`                                           | Add JWT secrets/env vars                                                                  |
| 3   | `libs/common/src/constants/auth.constants.ts`            | **New**                                                                                   |
| 4   | `libs/common/src/constants/index.ts`                     | Add `REFRESH_TOKEN` + export `auth.constants`                                             |
| 5   | `libs/common/src/dto/auth.dto.ts`                        | Add `RefreshTokenDto`, `LoginResponseDto`                                                 |
| 6   | `libs/common/src/decorators/current-user.decorator.ts`   | **New**                                                                                   |
| 7   | `libs/common/src/decorators/roles.decorator.ts`          | **New**                                                                                   |
| 8   | `libs/common/src/decorators/public.decorator.ts`         | **New**                                                                                   |
| 9   | `libs/common/src/decorators/index.ts`                    | **New**                                                                                   |
| 10  | `libs/common/src/guards/roles.guard.ts`                  | **New**                                                                                   |
| 11  | `libs/common/src/guards/index.ts`                        | **New**                                                                                   |
| 12  | `libs/common/src/index.ts`                               | Add decorators + guards exports                                                           |
| 13  | `apps/auth-service/src/auth.module.ts`                   | Add `JwtModule.registerAsync`                                                             |
| 14  | `apps/auth-service/src/auth.service.ts`                  | Rewrite — add `login()`, `refreshToken()`, inject `JwtService` + `ConfigService`          |
| 15  | `apps/auth-service/src/auth.controller.ts`               | Update `LOGIN` handler, add `REFRESH_TOKEN` handler                                       |
| 16  | `apps/api-gateway/src/auth/auth.module.ts`               | **New**                                                                                   |
| 17  | `apps/api-gateway/src/auth/auth.service.ts`              | Rewrite — thin TCP forwarder                                                              |
| 18  | `apps/api-gateway/src/auth/auth.controller.ts`           | Rewrite — use guards + service                                                            |
| 19  | `apps/api-gateway/src/auth/strategies/local.strategy.ts` | **New**                                                                                   |
| 20  | `apps/api-gateway/src/auth/strategies/jwt.strategy.ts`   | **New**                                                                                   |
| 21  | `apps/api-gateway/src/auth/guards/local-auth.guard.ts`   | **New**                                                                                   |
| 22  | `apps/api-gateway/src/auth/guards/jwt-auth.guard.ts`     | **New**                                                                                   |
| 23  | `apps/api-gateway/src/auth/guards/index.ts`              | **New**                                                                                   |
| 24  | `apps/api-gateway/src/auth/index.ts`                     | **New**                                                                                   |
| 25  | `apps/api-gateway/src/api-gateway.module.ts`             | Add `AuthModule`, remove auth `ClientsModule` + `AuthService` provider + `AuthController` |
| 26  | `apps/api-gateway/src/main.ts`                           | Register global `JwtAuthGuard` + `RolesGuard`                                             |
| 27  | `apps/api-gateway/src/products/products.controller.ts`   | Add `@Public()`, `@Roles('admin')`                                                        |
| 28  | `apps/api-gateway/src/orders/orders.controller.ts`       | Add `@Roles(...)`                                                                         |
| 29  | `apps/api-gateway/src/users/users.controller.ts`         | Add `@Roles('admin')`                                                                     |

---

## Architecture Patterns Reference (NestJS Docs)

- [Passport Local Strategy](https://docs.nestjs.com/recipes/passport#implementing-passport-local)
- [Passport JWT Strategy](https://docs.nestjs.com/recipes/passport#implementing-passport-jwt)
- [Guards](https://docs.nestjs.com/guards)
- [Custom Decorators](https://docs.nestjs.com/custom-decorators)
