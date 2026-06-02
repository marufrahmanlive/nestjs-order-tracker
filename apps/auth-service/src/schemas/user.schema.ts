import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, index: true })
  email: string;

  // select: false means password is NEVER included in query results by default.
  // Must use .select('+password') explicitly when bcrypt.compare needs the hash.
  // This prevents accidental password leaks in API responses.
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({ default: true })
  isActive: boolean;

  // Soft-delete: users are marked deleted (deletedAt + isActive: false)
  // rather than being permanently removed from the database.
  // Queries should always filter deletedAt: null for active users.
  @Prop({ type: Date, default: null, index: true })
  deletedAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ deletedAt: 1 });
UserSchema.index({ email: 1, deletedAt: 1 });
