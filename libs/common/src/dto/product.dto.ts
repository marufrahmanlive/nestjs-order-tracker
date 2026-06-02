import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Mouse', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Ergonomic wireless mouse with USB-C charging',
    description: 'Product description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: 29.99,
    description: 'Product price (must be positive)',
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @ApiProperty({
    example: 100,
    description: 'Initial stock quantity (0 or more)',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;
}

export class ReduceStockDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Product ID (MongoDB ObjectId)',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 3, description: 'Quantity to reduce from stock' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}
