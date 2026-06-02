import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Product ID (MongoDB ObjectId)',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity to order (minimum 1)' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Customer user ID (MongoDB ObjectId)',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Array of order items (minimum 1)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
