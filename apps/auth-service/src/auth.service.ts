import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { LoginDto, RegisterDto } from '@app/common';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds = parseInt(
    process.env.BCRYPT_ROUNDS || '12',
    10,
  );

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new Error('Email already registered');
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

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password');
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user._id}`);
    return this.sanitizeUser(user);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  private sanitizeUser(user: UserDocument) {
    const obj = user.toObject();
    const { password, ...sanitized } = obj;
    return sanitized;
  }
}
