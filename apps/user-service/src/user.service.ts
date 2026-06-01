import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string): Promise<UserDocument | null> {
    this.logger.log(`Finding user by id: ${id}`);
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    this.logger.log(`Finding user by email: ${email}`);
    return this.userModel.findOne({ email }).exec();
  }

  async create(dto: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
  }): Promise<UserDocument> {
    const user = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      roles: dto.roles || ['user'],
    });
    this.logger.log(`Created user: ${user._id}`);
    return user;
  }

  async update(
    id: string,
    updates: Partial<Pick<User, 'name' | 'roles' | 'isActive'>>,
  ): Promise<UserDocument | null> {
    this.logger.log(`Updating user: ${id}`);
    return this.userModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .exec();
  }

  async softDelete(id: string): Promise<UserDocument | null> {
    this.logger.log(`Soft deleting user: ${id}`);
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { deletedAt: new Date(), isActive: false } },
        { new: true },
      )
      .exec();
  }

  async list(skip = 0, limit = 20) {
    this.logger.log(`Listing users (skip: ${skip}, limit: ${limit})`);
    const [items, total] = await Promise.all([
      this.userModel
        .find({ deletedAt: null })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments({ deletedAt: null }),
    ]);
    return { items, total, skip, limit };
  }
}
