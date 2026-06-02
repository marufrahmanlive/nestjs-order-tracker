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
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class ValidateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

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
