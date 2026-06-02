import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsJWT,
  IsNumber,
  IsObject,
} from 'class-validator';
import type { IUser } from '../interfaces';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (min 1 char)',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'securePass123',
    description: 'Password (8-128 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name (2-100 characters)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class ValidateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'Valid JWT refresh token',
  })
  @IsJWT()
  refreshToken!: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT access token (short-lived, 15min)',
  })
  @IsJWT()
  accessToken!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT refresh token (long-lived, 7d)',
  })
  @IsJWT()
  refreshToken!: string;

  @ApiProperty({
    example: 900,
    description: 'Access token expiration time in seconds (15 minutes)',
  })
  @IsNumber()
  expiresIn!: number;

  @ApiProperty({
    description: 'Authenticated user profile (password excluded)',
  })
  @IsObject()
  user!: IUser;
}
