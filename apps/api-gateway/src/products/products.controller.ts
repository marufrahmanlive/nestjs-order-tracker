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
} from '@app/common';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(SERVICES.PRODUCT)
    private readonly productClient: ClientProxy,

    @InjectPinoLogger(ProductsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  async create(@Body() dto: CreateProductDto) {
    this.logger.info({ body: dto }, 'POST /products — forwarding to Product Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Product creation failed');
      throw new HttpException(response.error || 'Failed to create product', HttpStatus.BAD_REQUEST);
    }

    this.logger.info({ productId: response.data?._id }, 'Product created successfully via gateway');
    return response.data;
  }

  @Get()
  async findAll() {
    this.logger.info('GET /products — forwarding to Product Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IProduct[]>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Failed to fetch products');
      throw new HttpException(response.error || 'Failed to fetch products', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.info({ count: response.data?.length }, 'Products fetched via gateway');
    return response.data;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info({ productId: id }, 'GET /products/:id — forwarding to Product Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IProduct>>(
      this.productClient.send(PRODUCT_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn({ productId: id, error: response.error }, 'Product not found via gateway');
      throw new HttpException(response.error || 'Product not found', HttpStatus.NOT_FOUND);
    }

    return response.data;
  }
}
