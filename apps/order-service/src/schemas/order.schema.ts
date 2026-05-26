import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { OrderStatus } from '@app/common';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
class OrderItem {
  @Prop({ required: true })
  productId: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true })
  customerId: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ customerId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
