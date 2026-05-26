import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CreateProductDto, ReduceStockDto, PRODUCT_PATTERNS } from '@app/common';
import { ProductService } from './product.service';

@Controller()
export class ProductController {
  constructor(
    private readonly productService: ProductService,

    @InjectPinoLogger(ProductController.name)
    private readonly logger: PinoLogger,
  ) {}

  @MessagePattern(PRODUCT_PATTERNS.CREATE)
  async create(@Payload() dto: CreateProductDto) {
    this.logger.info({ pattern: PRODUCT_PATTERNS.CREATE }, 'TCP message received: create product');
    try {
      const product = await this.productService.create(dto);
      return { success: true, data: product };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to create product');
      return { success: false, error: error.message };
    }
  }

  @MessagePattern(PRODUCT_PATTERNS.FIND_ALL)
  async findAll() {
    this.logger.info({ pattern: PRODUCT_PATTERNS.FIND_ALL }, 'TCP message received: find all products');
    try {
      const products = await this.productService.findAll();
      return { success: true, data: products };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to find all products');
      return { success: false, error: error.message };
    }
  }

  @MessagePattern(PRODUCT_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    this.logger.info({ pattern: PRODUCT_PATTERNS.FIND_ONE, productId: id }, 'TCP message received: find product');
    try {
      const product = await this.productService.findOne(id);
      return { success: true, data: product };
    } catch (error) {
      this.logger.error({ error: error.message, productId: id }, 'Failed to find product');
      return { success: false, error: error.message };
    }
  }

  @MessagePattern(PRODUCT_PATTERNS.REDUCE_STOCK)
  async reduceStock(@Payload() dto: ReduceStockDto) {
    this.logger.info(
      { pattern: PRODUCT_PATTERNS.REDUCE_STOCK, productId: dto.productId, quantity: dto.quantity },
      'TCP message received: reduce stock',
    );
    return this.productService.reduceStock(dto);
  }
}
